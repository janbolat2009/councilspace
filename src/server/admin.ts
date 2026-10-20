import { z } from "zod";
import type { User } from "@prisma/client";
import { access, admin, audit, DomainError, transaction } from "@/lib/policy";
import { id, text, reason, profileSchema, webUrl } from "@/lib/validation";
export async function saveProfile(actor: User, input: unknown) {
  const data = profileSchema.parse(input);
  return transaction(tx => tx.user.update({ where: { id: actor.id }, data: { ...data, onboarded: true } }));
}
export async function updateMembership(actor: User, input: unknown) {
  const data = z.object({ userId: id, departmentId: id, role: z.enum(["MINISTER", "VICE_MINISTER", "MEMBER"]), status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]), reason }).strict().parse(input);
  return transaction(async tx => {
    const { user } = await access(tx, actor, data.departmentId, true);
    if (data.userId === actor.id) throw new DomainError("Свою роль изменяет другой руководитель.", 403);
    const target = await tx.user.findUnique({ where: { id: data.userId } });
    if (!target || target.schoolId !== actor.schoolId) throw new DomainError("Пользователь недоступен.", 403);
    const old = await tx.membership.findUnique({ where: { userId_departmentId: { userId: data.userId, departmentId: data.departmentId } } });
    if ((data.role !== (old?.role ?? "MEMBER") || old?.role === "MINISTER" || data.role === "MINISTER" || !old) && user.globalRole !== "SCHOOL_ADMIN") throw new DomainError("Назначение руководства и нового членства доступно администратору.", 403);
    const result = await tx.membership.upsert({ where: { userId_departmentId: { userId: data.userId, departmentId: data.departmentId } }, create: { userId: data.userId, departmentId: data.departmentId, role: data.role, status: data.status }, update: { role: data.role, status: data.status } });
    await audit(tx, actor.id, data.departmentId, "MEMBERSHIP_CHANGED", result.id, `${data.role} / ${data.status}: ${data.reason}`);
    return result;
  });
}
export async function updateGlobalRole(actor: User, input: unknown) {
  const data = z.object({ userId: id, role: z.enum(["STUDENT", "SCHOOL_ADMIN", "PRESIDENT", "VICE_PRESIDENT"]), reason }).strict().parse(input);
  return transaction(async tx => {
    await admin(tx, actor);
    if (data.userId === actor.id) throw new DomainError("Свою роль изменяет другой администратор.", 403);
    const target = await tx.user.findUnique({ where: { id: data.userId } });
    if (!target || target.schoolId !== actor.schoolId) throw new DomainError("Пользователь недоступен.", 403);
    await audit(tx, actor.id, null, "GLOBAL_ROLE_CHANGED", data.userId, `${data.role}: ${data.reason}`);
    return tx.user.update({ where: { id: data.userId }, data: { globalRole: data.role } });
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
