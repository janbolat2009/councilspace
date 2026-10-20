import { z } from "zod";
export const id = z.string().min(1).max(100);
export const text = (max = 3000) => z.string().trim().min(1, "Заполните поле.").max(max);
export const optionalText = (max = 3000) => z.string().trim().max(max).default("");
export const webUrl = z.union([z.literal(""), z.url().refine(v => /^https?:\/\//.test(v), "Используйте http или https.")]).default("");
export const dateOnly = z.iso.date();
export const instant = z.iso.datetime({ offset: true });
export const reason = text(1500);
export const profileSchema = z.object({ name: text(80), classroom: text(30), interests: optionalText(1500), image: webUrl }).strict();
export const applicationSchema = z.object({ departmentId: id, motivation: text(), direction: text(200), skills: text(1500), weeklyHours: z.number().int().min(1).max(40), idea: text(2000) }).strict();
export const taskSchema = z.object({
  departmentId: id, title: text(180), description: optionalText(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]), dueAt: instant.nullable().default(null), dueDate: dateOnly.nullable().default(null),
  eventId: id.nullable().default(null), assigneeIds: z.array(id).max(100).default([]), checklist: z.array(text(250)).max(30).default([])
}).strict().refine(d => !(d.dueAt && d.dueDate), "Выберите дату или точное время дедлайна.");
export const eventSchema = z.object({
  departmentId: id, title: text(180), description: optionalText(5000), goal: text(1500),
  startAt: instant, endAt: instant, location: text(300), audience: optionalText(500), backupPlan: optionalText(2000),
  memberIds: z.array(id).max(100).default([]), guests: z.array(z.object({ name: text(150), status: z.enum(["UNCONFIRMED", "INVITED", "CONFIRMED", "DECLINED"]) })).max(30).default([])
}).strict().refine(d => new Date(d.endAt) > new Date(d.startAt), "Окончание должно быть позже начала.");
export const reportSchema = z.object({
  id: id.optional(), taskId: id, summary: text(5000), performedOn: dateOnly,
  claimedMinutes: z.number().int().min(1).max(1440), evidenceUrl: webUrl, comment: optionalText(2000), submit: z.boolean()
}).strict();
export const decisionSchema = z.object({
  id, action: z.enum(["APPROVE", "CHANGES", "REJECT", "REVERSE"]), reason: optionalText(1500),
  approvedMinutes: z.number().int().min(1).max(1440).optional(), overrideReason: optionalText(1500)
}).strict();
