import { z } from "zod";
import type { User } from "@prisma/client";
import { access, audit, DomainError, managers, notify, transaction } from "@/lib/policy";
import { applicationSchema, id, optionalText } from "@/lib/validation";
export async function apply(actor: User, input: unknown) {
  const data = applicationSchema.parse(input);
  return transaction(async tx => {
    const department = await tx.department.findUnique({ where: { id: data.departmentId } });
    if (!department || department.schoolId !== actor.schoolId) throw new DomainError("Департамент не найден.", 404);
    const user = await tx.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!user.onboarded) throw new DomainError("Сначала заполните профиль.");
    const membership = await tx.membership.findUnique({ where: { userId_departmentId: { userId: actor.id, departmentId: data.departmentId } } });
    if (membership && membership.status !== "REVOKED") throw new DomainError("У вас уже есть членство в департаменте.");
    const pending = await tx.application.findFirst({ where: { userId: actor.id, departmentId: data.departmentId, status: "PENDING" } });
    if (pending) throw new DomainError("Активная заявка уже существует.", 409);
    const result = await tx.application.create({ data: { ...data, userId: actor.id } });
    await notify(tx, await managers(tx, data.departmentId), "Новая заявка в департамент", `/workspace?view=applications&department=${data.departmentId}`);
    return result;
  });
}
export async function decideApplication(actor: User, input: unknown) {
  const data = z.object({ id, status: z.enum(["APPROVED", "REJECTED", "WITHDRAWN"]), comment: optionalText(1500) }).strict().parse(input);
  return transaction(async tx => {
    const application = await tx.application.findUnique({ where: { id: data.id } });
    if (!application) throw new DomainError("Заявка не найдена.", 404);
    if (data.status === "WITHDRAWN") {
      if (application.userId !== actor.id) throw new DomainError("Это не ваша заявка.", 403);
    } else {
      await access(tx, actor, application.departmentId, true);
      if (application.userId === actor.id) throw new DomainError("Свою заявку рассматривает другой руководитель.", 403);
    }
    if (application.status !== "PENDING") throw new DomainError("Заявка уже рассмотрена.", 409);
    if (data.status === "REJECTED" && !data.comment) throw new DomainError("Укажите причину отказа.");
    const result = await tx.application.update({ where: { id: data.id }, data: { status: data.status, comment: data.comment, reviewerId: actor.id, decidedAt: new Date() } });
    if (data.status === "APPROVED") await tx.membership.upsert({
      where: { userId_departmentId: { userId: application.userId, departmentId: application.departmentId } },
      create: { userId: application.userId, departmentId: application.departmentId },
      update: { status: "ACTIVE", role: "MEMBER" }
    });
    await audit(tx, actor.id, application.departmentId, `APPLICATION_${data.status}`, application.id, data.comment);
    await notify(tx, [application.userId], data.status === "APPROVED" ? "Ваша заявка принята. Добро пожаловать!" : `Решение по заявке: ${data.comment || "заявка отозвана"}`, "/workspace?view=profile");
    return result;
  });
}
