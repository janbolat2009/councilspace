import { z } from "zod";
import type { Account, Profile } from "next-auth";
import { Prisma, type User } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { DomainError, transaction } from "@/lib/policy";
import { hashPassword, verifyPassword } from "@/lib/password";
import { DEPARTMENTS } from "@/lib/departments";
export const emailSchema = z.string().trim().toLowerCase().email("Проверьте адрес email.").max(254);
export const passwordSchema = z.string().min(10, "Пароль должен содержать минимум 10 символов.").max(128, "Пароль не длиннее 128 символов.");
export const registrationSchema = z.object({
  name: z.string().trim().min(2, "Укажите ваше имя.").max(80),
  email: emailSchema, password: passwordSchema, confirmPassword: z.string(),
  department: z.string().refine(value => DEPARTMENTS.some(d => d.slug === value), "Выберите департамент из списка.")
}).strict().refine(v => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Пароли не совпадают." });

// Schema changes belong to migrations, never to authentication requests.
export async function ensureAuthEnvironment(schoolId = process.env.COUNCIL_SCHOOL_ID || "school") {
  await db.school.upsert({ where: { id: schoolId }, create: { id: schoolId }, update: {} });
}
export async function ensureSchoolDepartments(schoolId = process.env.COUNCIL_SCHOOL_ID || "school") {
  await ensureAuthEnvironment(schoolId);
  for (const department of DEPARTMENTS) {
    await db.department.upsert({
      where: { schoolId_slug: { schoolId, slug: department.slug } },
      create: { ...department, schoolId, channels: { create: [{ name: "General" }, { name: "Announcements", announcements: true }] } },
      update: {}
    });
  }
  return db.department.findMany({ where: { schoolId }, select: { id: true, slug: true, name: true, description: true }, orderBy: { name: "asc" } });
}
const memoryRateLimits = new Map<string, { attempts: number; windowStart: number }>();

export async function authLimit(scope: string, value: string, maximum: number, windowMs: number) {
  const key = createHash("sha256").update(scope + ":" + value).digest("hex");
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  let dbOk = false;

  try {
    await ensureAuthEnvironment();
    const rows = await db.$queryRaw<{ attempts: number }[]>(Prisma.sql`
      INSERT INTO "AuthRateLimit" ("key", "attempts", "windowStart") VALUES (${key}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "attempts" = CASE WHEN "AuthRateLimit"."windowStart" <= ${cutoff} THEN 1 ELSE "AuthRateLimit"."attempts" + 1 END,
        "windowStart" = CASE WHEN "AuthRateLimit"."windowStart" <= ${cutoff} THEN ${now} ELSE "AuthRateLimit"."windowStart" END
      RETURNING "attempts"`);
    if (rows && rows.length > 0) {
      dbOk = true;
      if (rows[0].attempts > maximum) {
        throw new DomainError("Слишком много попыток. Попробуйте через 15 минут.", 429);
      }
    }
  } catch (err) {
    if (err instanceof DomainError) throw err;
    console.warn("Database rate-limit fallback to memory for", scope, err);
  }

  if (!dbOk) {
    const nowMs = now.getTime();
    const existing = memoryRateLimits.get(key);
    if (!existing || existing.windowStart <= (nowMs - windowMs)) {
      memoryRateLimits.set(key, { attempts: 1, windowStart: nowMs });
    } else {
      existing.attempts += 1;
      if (existing.attempts > maximum) {
        throw new DomainError("Слишком много попыток. Попробуйте через 15 минут.", 429);
      }
    }
  }
}
export async function registerAccount(input: unknown) {
  const data = registrationSchema.parse(input);
  await authLimit("signup-email", data.email, 5, 900000);
  await authLimit("signup-global", "all", 100, 900000);
  const passwordHash = await hashPassword(data.password);
  const schoolId = process.env.COUNCIL_SCHOOL_ID || "school";
  const departments = await ensureSchoolDepartments(schoolId);
  const department = departments.find(d => d.slug === data.department)!;
  try {
    const user = await db.user.create({ data: {
      name: data.name,
      email: data.email,
      passwordHash,
      schoolId,
      registrationDepartmentId: department.id,
      globalRole: "STUDENT",
      onboarded: false,
    }, select: { id: true } });
    return user;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new DomainError("Аккаунт с таким email уже существует. Войдите с паролем или через Google.", 409);
    throw e;
  }
}
// Google users choose once during onboarding. This never grants membership or a role.
export async function selectDepartment(actor: User, input: unknown) {
  const data = z.object({ departmentId: z.string().min(1).max(100) }).strict().parse(input);
  return transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: actor.id } });
    const department = await tx.department.findUnique({ where: { id: data.departmentId } });
    if (!department || department.schoolId !== user.schoolId) throw new DomainError("Департамент недоступен.", 403);
    if (user.registrationDepartmentId && user.registrationDepartmentId !== department.id) throw new DomainError("Департамент уже выбран. Для перевода обратитесь к администратору.", 403);
    return tx.user.update({ where: { id: user.id }, data: { registrationDepartmentId: department.id }, select: { registrationDepartmentId: true } });
  });
}
export async function authenticatePassword(input: unknown) {
  const parsed = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).safeParse(input);
  if (!parsed.success) return null;
  await authLimit("signin-email", parsed.data.email, 10, 900000);
  await authLimit("signin-global", "all", 300, 900000);
  const user = await db.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" }, schoolId: process.env.COUNCIL_SCHOOL_ID || "school", isDemo: false } });
  if (!await verifyPassword(parsed.data.password, user?.passwordHash ?? null)) return null;
  return user;
}
export async function acceptGoogleIdentity(account: Account, profile?: Profile) {
  const google = profile as { email?: string; email_verified?: boolean } | undefined;
  if (!google?.email_verified || !google.email) return "/login?error=UnverifiedGoogleEmail";
  const email = emailSchema.parse(google.email);
  const domain = process.env.GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase();
  if (domain && email.split("@")[1] !== domain) return "/login?error=SchoolDomain";
  // Repair legacy Google-only users created without Account rows by an earlier implementation.
  // A verified Google mailbox may recover only a Google-only identity; passwords are never auto-linked.
  await ensureAuthEnvironment();
  await transaction(async tx => {
    const existing = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, include: { accounts: true } });
    if (existing && !existing.passwordHash && !existing.isDemo && existing.schoolId === (process.env.COUNCIL_SCHOOL_ID || "school") && !existing.accounts.length) {
      await tx.account.create({ data: { userId: existing.id, type: "oauth", provider: "google", providerAccountId: account.providerAccountId } });
      await tx.user.update({ where: { id: existing.id }, data: { email, emailVerified: new Date() } });
    }
  });
  return true;
}
export async function setPassword(actor: User, input: unknown) {
  const data = z.object({ currentPassword: z.string().max(128).default(""), password: passwordSchema, confirmPassword: z.string() }).strict().refine(v => v.password === v.confirmPassword, "Пароли не совпадают.").parse(input);
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (user.isDemo) throw new DomainError("Пароль демопрофиля изменить нельзя.");
  await authLimit("password-change", user.id, 10, 900000);
  if (user.passwordHash && !await verifyPassword(data.currentPassword, user.passwordHash)) throw new DomainError("Текущий пароль неверен.", 403);
  if (!user.passwordHash && !await db.account.findFirst({ where: { userId: user.id, provider: "google" } })) throw new DomainError("Сначала войдите через Google.", 403);
  const passwordHash = await hashPassword(data.password);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
  return { ok: true };
}
