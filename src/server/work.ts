import { z } from "zod";
import type { User } from "@prisma/client";
import { access, audit, DomainError, notify, transaction, type Tx } from "@/lib/policy";
import { taskSchema, eventSchema, id, text, optionalText, instant } from "@/lib/validation";
async function checkMembers(tx: Tx, ids: string[], departmentId: string) {
  const unique = [...new Set(ids)];
  const count = await tx.membership.count({ where: { userId: { in: unique }, departmentId, status: "ACTIVE" } });
  if (count !== unique.length) throw new DomainError("Назначать можно только активных участников департамента.");
}
export async function createTask(actor: User, input: unknown) {
  const data = taskSchema.parse(input);
  return transaction(async tx => {
    const { manager } = await access(tx, actor, data.departmentId);
    if (!manager && data.assigneeIds.some(u => u !== actor.id)) throw new DomainError("Участник может назначить только себя.", 403);
    await checkMembers(tx, data.assigneeIds, data.departmentId);
    if (data.eventId && !await tx.event.findFirst({ where: { id: data.eventId, departmentId: data.departmentId } })) throw new DomainError("Мероприятие другого департамента.", 403);
    const { assigneeIds, checklist, ...rest } = data;
    const task = await tx.task.create({ data: { ...rest, dueDate: data.dueDate ? new Date(data.dueDate) : null, authorId: actor.id, assignees: { create: [...new Set(assigneeIds)].map(userId => ({ userId })) }, checklist: { create: checklist.map(text => ({ text })) } } });
    await notify(tx, assigneeIds, `Вы назначены: ${task.title}`, `/workspace?view=tasks&department=${data.departmentId}&focus=${task.id}`);
    return task;
  });
}
export async function updateTask(actor: User, input: unknown) {
  const data = z.object({ id, status: z.enum(["TODO", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "CANCELLED"]).optional(), dueAt: instant.nullable().optional(), dueDate: z.iso.date().nullable().optional(), assigneeIds: z.array(id).max(100).optional(), checklistId: id.optional(), done: z.boolean().optional() }).strict().parse(input);
  return transaction(async tx => {
    const task = await tx.task.findUnique({ where: { id: data.id }, include: { assignees: true } });
    if (!task) throw new DomainError("Задача не найдена.", 404);
    const { manager } = await access(tx, actor, task.departmentId);
    if (!manager && task.authorId !== actor.id && !task.assignees.some(a => a.userId === actor.id)) throw new DomainError("Нет доступа к управлению задачей.", 403);
    if (data.assigneeIds) {
      if (!manager && (data.assigneeIds.some(u => u !== actor.id) || task.assignees.some(a => a.userId !== actor.id))) throw new DomainError("Назначение команды доступно руководству.", 403);
      await checkMembers(tx, data.assigneeIds, task.departmentId);
      await tx.taskAssignee.deleteMany({ where: { taskId: task.id } });
      await tx.taskAssignee.createMany({ data: [...new Set(data.assigneeIds)].map(userId => ({ taskId: task.id, userId })) });
      await notify(tx, data.assigneeIds.filter(u => !task.assignees.some(a => a.userId === u)), `Вы назначены: ${task.title}`, `/workspace?view=tasks&department=${task.departmentId}&focus=${task.id}`);
    }
    if (data.checklistId) {
      const changed = await tx.checklistItem.updateMany({ where: { id: data.checklistId, taskId: task.id }, data: { done: data.done ?? false } });
      if (!changed.count) throw new DomainError("Пункт не найден.", 404);
    }
    if (data.dueAt && data.dueDate) throw new DomainError("Выберите один вид дедлайна.");
    const changedDeadline = data.dueAt !== undefined || data.dueDate !== undefined;
    const updated = await tx.task.update({ where: { id: task.id }, data: { status: data.status, ...(changedDeadline ? { dueAt: data.dueAt ?? null, dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}) } });
    if (changedDeadline) await notify(tx, task.assignees.map(a => a.userId), `Изменён дедлайн: ${task.title}`, `/workspace?view=tasks&department=${task.departmentId}&focus=${task.id}`);
    return updated;
  });
}
export async function commentTask(actor: User, input: unknown) {
  const data = z.object({ taskId: id, text: text(3000) }).strict().parse(input);
  return transaction(async tx => {
    const task = await tx.task.findUnique({ where: { id: data.taskId } });
    if (!task) throw new DomainError("Задача не найдена.", 404);
    await access(tx, actor, task.departmentId);
    return tx.taskComment.create({ data: { ...data, userId: actor.id } });
  });
}
export async function createEvent(actor: User, input: unknown) {
  const data = eventSchema.parse(input);
  return transaction(async tx => {
    const { manager } = await access(tx, actor, data.departmentId);
    if (!manager && data.memberIds.some(u => u !== actor.id)) throw new DomainError("Команду назначает руководство.", 403);
    if (!manager && data.guests.some(g => g.status !== "UNCONFIRMED")) throw new DomainError("Статус приглашения гостя подтверждает руководство.", 403);
    await checkMembers(tx, data.memberIds, data.departmentId);
    const { memberIds, guests, ...rest } = data;
    return tx.event.create({ data: { ...rest, leadId: actor.id, status: "PROPOSED", members: { create: [...new Set(memberIds)].map(userId => ({ userId })) }, guests: { create: guests } } });
  });
}
export async function updateEvent(actor: User, input: unknown) {
  const data = z.object({ id, status: z.enum(["DRAFT", "PROPOSED", "CONFIRMED", "COMPLETED", "CANCELLED"]), isPublic: z.boolean(), startAt: instant.optional(), endAt: instant.optional(), reason: optionalText(1500), createChannel: z.boolean().default(false) }).strict().parse(input);
  return transaction(async tx => {
    const event = await tx.event.findUnique({ where: { id: data.id }, include: { members: true } });
    if (!event) throw new DomainError("Мероприятие не найдено.", 404);
    await access(tx, actor, event.departmentId, true);
    const startAt = data.startAt ? new Date(data.startAt) : event.startAt;
    const endAt = data.endAt ? new Date(data.endAt) : event.endAt;
    if (endAt <= startAt) throw new DomainError("Проверьте даты мероприятия.");
    if ((data.status === "CANCELLED" || data.startAt) && !data.reason) throw new DomainError("Укажите причину переноса или отмены.");
    const updated = await tx.event.update({ where: { id: event.id }, data: { status: data.status, isPublic: data.isPublic, startAt, endAt } });
    if (data.createChannel) await tx.channel.upsert({ where: { departmentId_name: { departmentId: event.departmentId, name: event.title } }, create: { departmentId: event.departmentId, eventId: event.id, name: event.title }, update: {} });
    await audit(tx, actor.id, event.departmentId, "EVENT_UPDATED", event.id, data.reason || data.status);
    await notify(tx, [...event.members.map(m => m.userId), event.leadId], `Обновление мероприятия: ${event.title}`, `/workspace?view=events&department=${event.departmentId}`);
    return updated;
  });
}
