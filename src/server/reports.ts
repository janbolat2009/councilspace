import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { access, audit, DomainError, managers, notify, transaction } from "@/lib/policy";
import { reportSchema, decisionSchema } from "@/lib/validation";
import { schoolDate } from "@/lib/time";
export async function saveReport(actor: User, input: unknown) {
  const data = reportSchema.parse(input);
  return transaction(async tx => {
    const task = await tx.task.findUnique({ where: { id: data.taskId } });
    if (!task) throw new DomainError("Задача не найдена.", 404);
    await access(tx, actor, task.departmentId);
    const school = await tx.school.findUniqueOrThrow({ where: { id: actor.schoolId } });
    if (data.performedOn > schoolDate(new Date(), school.timezone)) throw new DomainError("Нельзя отчитываться за будущую дату.");
    if (data.id) {
      const previous = await tx.report.findUnique({ where: { id: data.id } });
      if (!previous || previous.userId !== actor.id || previous.taskId !== data.taskId) throw new DomainError("Нет доступа к отчёту.", 403);
      if (!["DRAFT", "CHANGES_REQUESTED"].includes(previous.status)) throw new DomainError("Этот отчёт уже отправлен. Для изменения нужно решение проверяющего.", 409);
    }
    if (data.submit) {
      const day = await tx.report.aggregate({ where: {
        userId: actor.id, performedOn: new Date(data.performedOn), id: { not: data.id ?? "" }, status: { in: ["PENDING", "APPROVED"] }
      }, _sum: { claimedMinutes: true } });
      if ((day._sum.claimedMinutes ?? 0) + data.claimedMinutes > school.dailyLimit) throw new DomainError(`Сумма отчётов за этот день превышает ${school.dailyLimit / 60} ч. Исправьте длительность.`);
    }
    const fields = { taskId: data.taskId, userId: actor.id, summary: data.summary, performedOn: new Date(data.performedOn), claimedMinutes: data.claimedMinutes, evidenceUrl: data.evidenceUrl, comment: data.comment, status: data.submit ? "PENDING" as const : "DRAFT" as const };
    const report = data.id ? await tx.report.update({ where: { id: data.id }, data: fields }) : await tx.report.create({ data: fields });
    if (data.submit) {
      await notify(tx, (await managers(tx, task.departmentId)).filter(u => u !== actor.id), "Новый отчёт ожидает проверки", `/workspace?view=review&department=${task.departmentId}`);
    }
    return report;
  });
}
export async function decideReport(actor: User, input: unknown) {
  const data = decisionSchema.parse(input);
  return transaction(async tx => {
    const report = await tx.report.findUnique({ where: { id: data.id }, include: { task: true } });
    if (!report) throw new DomainError("Отчёт не найден.", 404);
    const { department } = await access(tx, actor, report.task.departmentId, true);
    if (report.userId === actor.id) throw new DomainError("Собственный отчёт проверяет другой руководитель.", 403);
    if (data.action === "APPROVE" && report.status === "APPROVED") return report;
    if (data.action === "REVERSE") {
      if (!data.reason) throw new DomainError("Укажите причину отмены подтверждения.");
      if (report.status !== "APPROVED") {
        const reversed = await tx.ledgerEntry.findFirst({ where: { reportId: report.id, kind: "REVERSAL" } });
        if (reversed && report.status === "CHANGES_REQUESTED") return report;
        throw new DomainError("Отчёт не подтверждён.", 409);
      }
      const credit = await tx.ledgerEntry.findUniqueOrThrow({ where: { reportId_revision_kind: { reportId: report.id, revision: report.revision, kind: "CREDIT" } } });
      await tx.ledgerEntry.create({ data: { reportId: report.id, userId: report.userId, revision: report.revision, kind: "REVERSAL", minutes: -credit.minutes, points: credit.points.negated(), rate: credit.rate, ruleVersion: credit.ruleVersion, performedOn: credit.performedOn, reason: data.reason } });
      await tx.reportDecision.create({ data: { reportId: report.id, reviewerId: actor.id, action: data.action, reason: data.reason, revision: report.revision } });
      await audit(tx, actor.id, department.id, "REPORT_REVERSED", report.id, data.reason);
      await notify(tx, [report.userId], "Подтверждение отчёта отменено: " + data.reason, `/workspace?view=reports&department=${department.id}`);
      return tx.report.update({ where: { id: report.id }, data: { status: "CHANGES_REQUESTED", approvedMinutes: null, reviewComment: data.reason } });
    }
    if (report.status !== "PENDING") throw new DomainError("Отчёт уже рассмотрен или ещё не отправлен.", 409);
    let approvedMinutes: number | null = null;
    let revision = report.revision;
    if (data.action === "APPROVE") {
      approvedMinutes = data.approvedMinutes ?? report.claimedMinutes;
      if (approvedMinutes !== report.claimedMinutes && !data.reason) throw new DomainError("Объясните изменение подтверждённого времени.");
      const school = await tx.school.findUniqueOrThrow({ where: { id: actor.schoolId } });
      const daily = await tx.ledgerEntry.aggregate({ where: { userId: report.userId, performedOn: report.performedOn }, _sum: { minutes: true } });
      if ((daily._sum.minutes ?? 0) + approvedMinutes > school.dailyLimit && !data.overrideReason) throw new DomainError("Превышен суточный предел. Укажите отдельное обоснование исключения.");
      revision++;
      const points = new Prisma.Decimal(approvedMinutes).mul(department.rate).div(60).toDecimalPlaces(4);
      await tx.ledgerEntry.create({ data: { reportId: report.id, userId: report.userId, revision, kind: "CREDIT", minutes: approvedMinutes, points, rate: department.rate, ruleVersion: department.ruleVersion, performedOn: report.performedOn, reason: [data.reason, data.overrideReason].filter(Boolean).join(" · ") } });
    } else if (!data.reason) throw new DomainError("Добавьте комментарий к решению.");
    const status = data.action === "APPROVE" ? "APPROVED" : data.action === "CHANGES" ? "CHANGES_REQUESTED" : "REJECTED";
    const result = await tx.report.update({ where: { id: report.id }, data: { status, approvedMinutes, revision, reviewComment: data.reason } });
    await tx.reportDecision.create({ data: { reportId: report.id, reviewerId: actor.id, action: data.action, reason: [data.reason, data.overrideReason].filter(Boolean).join(" · "), approvedMinutes, revision } });
    await audit(tx, actor.id, department.id, `REPORT_${status}`, report.id, data.reason);
    await notify(tx, [report.userId], `Проверен отчёт «${report.task.title}»`, `/workspace?view=reports&department=${department.id}`);
    return result;
  });
}
