import { Prisma, type User } from "@prisma/client";
import { db } from "@/lib/db";
import { access, isGlobalManager, serialize, DomainError } from "@/lib/policy";
import { periodBounds, schoolDate } from "@/lib/time";
import { z } from "zod";
const person = { id: true, name: true, image: true, classroom: true, interests: true, isDemo: true } as const;
export async function getWorkspace(actor: User, departmentId?: string, params = new URLSearchParams()) {
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  const school = await db.school.findUniqueOrThrow({ where: { id: user.schoolId } });
  const allDepartments = await db.department.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } });
  const memberships = await db.membership.findMany({ where: { userId: user.id, status: "ACTIVE" } });
  const departments = allDepartments.filter(d => isGlobalManager(user.globalRole) || memberships.some(m => m.departmentId === d.id));
  if (departmentId && !departments.some(d => d.id === departmentId)) throw new DomainError("Доступ к департаменту закрыт.", 403);
  const currentDepartment = departments.find(d => d.id === departmentId) ?? departments[0] ?? null;
  const permission = currentDepartment ? await access(db, user, currentDepartment.id) : null;
  const deptId = currentDepartment?.id ?? "__none__";
  const manager = !!permission?.manager;
  const period = params.get("period") || "month";
  let range = periodBounds(period, school);
  if (period === "custom") {
    range = { from: z.iso.date().parse(params.get("from")), to: z.iso.date().parse(params.get("to")) };
    if (range.from > range.to) throw new DomainError("Начало периода позже окончания.");
  }
  const [tasks, events, reports, applications, members, channels, notifications, ledger, audits, schoolUsers] = await Promise.all([
    db.task.findMany({ where: { departmentId: deptId }, orderBy: { createdAt: "desc" }, include: { assignees: { include: { user: { select: person } } }, checklist: true, comments: { orderBy: { createdAt: "asc" }, include: { user: { select: person } } }, author: { select: person } } }),
    db.event.findMany({ where: { departmentId: deptId }, orderBy: { startAt: "asc" }, include: { lead: { select: person }, members: { include: { user: { select: person } } }, guests: true, tasks: { select: { id: true, status: true } } } }),
    db.report.findMany({ where: { task: { departmentId: deptId }, ...(manager ? {} : { userId: user.id }) }, orderBy: { createdAt: "desc" }, include: { task: { select: { title: true, departmentId: true } }, user: { select: person }, decisions: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { name: true } } } }, ledger: true } }),
    db.application.findMany({ where: manager ? { departmentId: deptId } : { userId: user.id }, orderBy: { createdAt: "desc" }, include: { user: { select: person }, department: { select: { name: true } } } }),
    db.membership.findMany({ where: { departmentId: deptId, ...(manager ? {} : { status: "ACTIVE" as const }) }, include: { user: { select: person } }, orderBy: { joinedAt: "asc" } }),
    db.channel.findMany({ where: { departmentId: deptId }, include: { reads: { where: { userId: user.id } }, messages: { orderBy: { sequence: "desc" }, take: 1, select: { sequence: true } } }, orderBy: { name: "asc" } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.ledgerEntry.findMany({ where: { report: { task: { departmentId: deptId } }, performedOn: { gte: new Date(range.from), lte: new Date(range.to) } }, include: { user: { select: person } } }),
    manager ? db.auditLog.findMany({ where: { OR: [{ departmentId: deptId }, ...(user.globalRole === "SCHOOL_ADMIN" ? [{ departmentId: null, actor: { schoolId: user.schoolId } }] : [])] }, orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } }) : Promise.resolve([]),
    user.globalRole === "SCHOOL_ADMIN" ? db.user.findMany({ where: { schoolId: user.schoolId }, select: { ...person, globalRole: true, email: true } }) : Promise.resolve([])
  ]);
  const allCredits = currentDepartment ? await db.ledgerEntry.aggregate({ where: { userId: user.id, report: { task: { departmentId: deptId } } }, _sum: { minutes: true, points: true } }) : null;
  const standings = new Map<string, { user: typeof members[number]["user"]; minutes: number; points: Prisma.Decimal; reports: Set<string> }>();
  for (const row of ledger) {
    const item = standings.get(row.userId) ?? { user: row.user, minutes: 0, points: new Prisma.Decimal(0), reports: new Set<string>() };
    item.minutes += row.minutes; item.points = item.points.add(row.points);
    if (row.kind === "CREDIT") item.reports.add(`${row.reportId}:${row.revision}`);
    else item.reports.delete(`${row.reportId}:${row.revision}`);
    standings.set(row.userId, item);
  }
  // Ledger reversal order must not affect approved report counts.
  for (const item of standings.values()) item.reports.clear();
  const creditGroups = new Map<string, { userId: string; minutes: number; reportId: string }>();
  for (const row of ledger) {
    const key = `${row.reportId}:${row.revision}`;
    const entry = creditGroups.get(key) ?? { userId: row.userId, minutes: 0, reportId: row.reportId };
    entry.minutes += row.minutes; creditGroups.set(key, entry);
  }
  for (const row of creditGroups.values()) if (row.minutes > 0) standings.get(row.userId)?.reports.add(row.reportId);
  const sort = params.get("sort") === "hours" ? "hours" : "points";
  const leaderboard = [...standings.values()].filter(s => s.minutes > 0).sort((a,b) => sort === "hours" ? b.minutes - a.minutes : b.points.cmp(a.points)).map(s => ({ ...s, reportCount: s.reports.size, reports: undefined }));
  const unreadChannels = await Promise.all(channels.map(async c => ({
    id: c.id, name: c.name, announcements: c.announcements, eventId: c.eventId,
    unread: await db.message.count({ where: { channelId: c.id, userId: { not: user.id }, sequence: { gt: c.reads[0]?.lastSequence ?? 0n } } })
  })));
  const today = schoolDate(new Date(), school.timezone);
  return serialize({
    user: { id: user.id, name: user.name, image: user.image, classroom: user.classroom, interests: user.interests, onboarded: user.onboarded, globalRole: user.globalRole, isDemo: user.isDemo },
    school, departments, allDepartments, department: currentDepartment, manager, membership: permission?.member ?? null,
    tasks, events, reports, applications, members, channels: unreadChannels, notifications, leaderboard, audits, schoolUsers, range, period, sort,
    stats: { minutes: allCredits?._sum.minutes ?? 0, points: allCredits?._sum.points?.toString() ?? "0",
      pending: reports.filter(r => r.status === "PENDING").length,
      overdue: tasks.filter(t => !["COMPLETED", "CANCELLED"].includes(t.status) && (t.dueAt ? t.dueAt < new Date() : t.dueDate ? t.dueDate.toISOString().slice(0,10) < today : false)).length,
      applications: applications.filter(a => a.status === "PENDING").length }
  });
}
export type WorkspaceData = Awaited<ReturnType<typeof getWorkspace>>;
export async function publicData() {
  const schoolId = process.env.COUNCIL_SCHOOL_ID || "school";
  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) return null;
  const [departments, events, leaders] = await Promise.all([
    db.department.findMany({ where: { schoolId }, select: { id: true, slug: true, name: true, description: true, ministerName: true } }),
    db.event.findMany({ where: { department: { schoolId }, isPublic: true, status: { in: ["CONFIRMED", "COMPLETED"] } }, select: { id: true, title: true, description: true, startAt: true, endAt: true, location: true, audience: true, status: true }, orderBy: { startAt: "asc" } }),
    db.user.findMany({ where: { schoolId, globalRole: { in: ["PRESIDENT", "VICE_PRESIDENT"] } }, select: { name: true, image: true, globalRole: true } })
  ]);
  return serialize({ school, departments, events, leaders });
}
