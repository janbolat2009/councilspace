import { z } from "zod";
import type { GlobalRole, User } from "@prisma/client";
import { access, admin, audit, COUNCIL_ROLES, DomainError, isGlobalManager, isSpecialAdminEmail, transaction } from "@/lib/policy";
import { id, text, reason, optionalText, profileSchema, webUrl } from "@/lib/validation";
const GLOBAL_ROLES = ["STUDENT", "SCHOOL_ADMIN", "PRESIDENT", "VICE_PRESIDENT", "PRIME_MINISTER", "COUNSELOR"] as const;
const SINGLE_COUNCIL_ROLES = new Set<string>(COUNCIL_ROLES);
export async function saveProfile(actor: User, input: unknown) {
  const data = profileSchema.parse(input);
  return transaction(tx => tx.user.update({ where: { id: actor.id }, data: { ...data, onboarded: true }, select: { id: true, name: true, image: true, classroom: true, interests: true, onboarded: true } }));
}
export async function updateMembership(actor: User, input: unknown) {
  const data = z.object({
    userId: id,
    departmentId: id,
    role: z.enum(["MINISTER", "VICE_MINISTER", "MEMBER"]),
    globalRole: z.enum(GLOBAL_ROLES).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]),
    reason: optionalText(1500)
  }).strict().parse(input);
  return transaction(async tx => {
    const { user } = await access(tx, actor, data.departmentId, true);
    if (data.userId === actor.id && data.status !== "ACTIVE") throw new DomainError("Нельзя приостановить или отозвать собственное участие.", 400);
    const target = await tx.user.findUnique({ where: { id: data.userId } });
    if (!target || target.schoolId !== actor.schoolId) throw new DomainError("Пользователь недоступен.", 403);
    const canAssignLeadership = user.globalRole === "SCHOOL_ADMIN" || isGlobalManager(user.globalRole) || isSpecialAdminEmail(user.email);
    const old = await tx.membership.findUnique({ where: { userId_departmentId: { userId: data.userId, departmentId: data.departmentId } } });
    if (!old && !canAssignLeadership) throw new DomainError("Назначение нового членства доступно руководству совета.", 403);
    if (data.globalRole && data.globalRole !== target.globalRole) {
      if (data.globalRole === "SCHOOL_ADMIN" && user.globalRole !== "SCHOOL_ADMIN" && !isSpecialAdminEmail(user.email)) {
        throw new DomainError("Назначение администратора школы доступно администратору.", 403);
      }
      if (SINGLE_COUNCIL_ROLES.has(data.globalRole)) {
        await tx.user.updateMany({
          where: { schoolId: actor.schoolId, globalRole: data.globalRole as GlobalRole, id: { not: data.userId } },
          data: { globalRole: "STUDENT" }
        });
      }
      await tx.user.update({ where: { id: data.userId }, data: { globalRole: data.globalRole as GlobalRole } });
      await audit(tx, actor.id, data.departmentId, "GLOBAL_ROLE_CHANGED", data.userId, `${data.globalRole}: ${data.reason || "Назначение роли в команде"}`);
    }
    const result = await tx.membership.upsert({
      where: { userId_departmentId: { userId: data.userId, departmentId: data.departmentId } },
      create: { userId: data.userId, departmentId: data.departmentId, role: data.role, status: data.status },
      update: { role: data.role, status: data.status }
    });
    await audit(tx, actor.id, data.departmentId, "MEMBERSHIP_CHANGED", result.id, `${data.role}${data.globalRole ? ` (${data.globalRole})` : ""} / ${data.status}: ${data.reason || "Обновление роли"}`);
    return result;
  });
}
export async function updateGlobalRole(actor: User, input: unknown) {
  const data = z.object({ userId: id, role: z.enum(GLOBAL_ROLES), reason: optionalText(1500) }).strict().parse(input);
  return transaction(async tx => {
    const fresh = await tx.user.findUnique({ where: { id: actor.id } });
    if (!fresh || (!isGlobalManager(fresh.globalRole) && !isSpecialAdminEmail(fresh.email))) throw new DomainError("Действие доступно руководству школы.", 403);
    if (data.role === "SCHOOL_ADMIN" && fresh.globalRole !== "SCHOOL_ADMIN" && !isSpecialAdminEmail(fresh.email)) {
      throw new DomainError("Действие доступно администратору школы.", 403);
    }
    const target = await tx.user.findUnique({ where: { id: data.userId } });
    if (!target || target.schoolId !== actor.schoolId) throw new DomainError("Пользователь недоступен.", 403);
    if (SINGLE_COUNCIL_ROLES.has(data.role)) {
      await tx.user.updateMany({
        where: { schoolId: actor.schoolId, globalRole: data.role as GlobalRole, id: { not: data.userId } },
        data: { globalRole: "STUDENT" }
      });
    }
    await audit(tx, actor.id, null, "GLOBAL_ROLE_CHANGED", data.userId, `${data.role}: ${data.reason || "Назначение роли"}`);
    return tx.user.update({ where: { id: data.userId }, data: { globalRole: data.role as GlobalRole }, select: { id: true, globalRole: true } });
  });
}
export async function createDepartment(actor: User, input: unknown) {
  const data = z.object({ name: text(120), slug: z.string().regex(/^[a-z0-9-]{2,60}$/), description: text(3000), ministerName: z.string().max(100).default("") }).strict().parse(input);
  return transaction(async tx => {
    await admin(tx, actor);
    const department = await tx.department.create({ data: { ...data, schoolId: actor.schoolId, channels: { create: [{ name: "General" }, { name: "Announcements", announcements: true }] } } });
    await audit(tx, actor.id, department.id, "DEPARTMENT_CREATED", department.id, data.name);
    return department;
  });
}
export async function updateRate(actor: User, input: unknown) {
  const data = z.object({ departmentId: id, rate: z.number().min(0).max(10000).multipleOf(0.01), reason }).strict().parse(input);
  return transaction(async tx => {
    await access(tx, actor, data.departmentId, true);
    const result = await tx.department.update({ where: { id: data.departmentId }, data: { rate: data.rate, ruleVersion: { increment: 1 } } });
    await audit(tx, actor.id, data.departmentId, "RATE_CHANGED", data.departmentId, `${data.rate} / час, v${result.ruleVersion}: ${data.reason}`);
    return result;
  });
}
export async function updateSchool(actor: User, input: unknown) {
  const monthDay = z.string().regex(/^\d{2}-\d{2}$/).refine(v => {
    const d = new Date(`2024-${v}T00:00:00Z`);
    return !isNaN(d.getTime()) && d.toISOString().slice(5, 10) === v;
  }, "Некорректная дата.");
  const data = z.object({
    name: text(120), logoUrl: z.union([z.literal("/logo.png"), webUrl]), navy: z.string().regex(/^#[0-9a-fA-F]{6}$/), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), cream: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    timezone: z.string().refine(v => { try { new Intl.DateTimeFormat("ru", { timeZone: v }); return true; } catch { return false; } }, "Неизвестный часовой пояс."),
    dailyLimit: z.number().int().min(60).max(1440), academicStart: monthDay, terms: z.array(z.tuple([monthDay, monthDay])).length(4)
  }).strict().parse(input);
  // The quarters must partition all calendar days, including leap day.
  for (let d = new Date("2024-01-01T00:00:00Z"); d.getUTCFullYear() === 2024; d.setUTCDate(d.getUTCDate() + 1)) {
    const md = d.toISOString().slice(5, 10);
    if (data.terms.filter(([s,e]) => s <= e ? md >= s && md <= e : md >= s || md <= e).length !== 1) throw new DomainError("Четверти должны покрывать весь год без пересечений.");
  }
  return transaction(async tx => {
    await admin(tx, actor);
    await audit(tx, actor.id, null, "SCHOOL_SETTINGS_CHANGED", actor.schoolId, "Обновлены настройки школы");
    return tx.school.update({ where: { id: actor.schoolId }, data });
  });
}
