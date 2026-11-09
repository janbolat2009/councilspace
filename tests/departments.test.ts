import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/lib/db";
import { DEPARTMENTS } from "../src/lib/departments";
import { access } from "../src/lib/policy";
import { registerAccount, authenticatePassword, ensureSchoolDepartments, selectDepartment } from "../src/server/accounts";
import { apply, decideApplication } from "../src/server/applications";
import { saveProfile, updateMembership, updateGlobalRole } from "../src/server/admin";
import { createTask, commentTask, createEvent } from "../src/server/work";
import { saveReport, decideReport } from "../src/server/reports";
import { sendMessage, readChat } from "../src/server/chat";
import { getWorkspace } from "../src/server/queries";
import { syncLeadership } from "../src/server/leadership";

const password = "Synthetic department test 123!";
const signup = (department: string, email = "member@example.invalid") => ({ name: "Ученик Тестовый", email, password, confirmPassword: password, department });
beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE "School" CASCADE');
  await db.authRateLimit.deleteMany();
  vi.stubEnv("COUNCIL_SCHOOL_ID", "school");
  await ensureSchoolDepartments();
});
afterAll(async () => { vi.unstubAllEnvs(); await db.$disconnect(); });

async function fixture(slug = "sport") {
  const department = await db.department.findUniqueOrThrow({ where: { schoolId_slug: { schoolId: "school", slug } } });
  const registration = await registerAccount(signup(slug));
  const member = await db.user.findUniqueOrThrow({ where: { id: registration.id } });
  const minister = await db.user.create({ data: { schoolId: "school", name: "Министр", email: "minister@example.invalid", onboarded: true, registrationDepartmentId: department.id, memberships: { create: { departmentId: department.id, role: "MINISTER" } } } });
  const vice = await db.user.create({ data: { schoolId: "school", name: "Вице-министр", onboarded: true, registrationDepartmentId: department.id, memberships: { create: { departmentId: department.id, role: "VICE_MINISTER" } } } });
  await saveProfile(member, { name: member.name!, classroom: "10 A", image: "", interests: "Проекты" });
  const application = await apply(member, { departmentId: department.id, motivation: "Хочу участвовать", direction: "Проекты", skills: "Организация", weeklyHours: 3, idea: "Школьный проект" });
  await decideApplication(vice, { id: application.id, status: "APPROVED" });
  return { department, member, minister, vice };
}

describe("Seven independent department workspaces", () => {
  it.each(DEPARTMENTS)("registers, signs in, submits and moderates in $name", async ({ slug }) => {
    const { department, member, minister, vice } = await fixture(slug);
    expect(member.registrationDepartmentId).toBe(department.id);
    expect(member.globalRole).toBe("STUDENT");
    expect((await authenticatePassword({ email: member.email, password }))?.id).toBe(member.id);
    expect((await access(db, member, department.id)).manager).toBe(false);
    expect((await getWorkspace(member)).departments.map(d => d.id)).toEqual([department.id]);
    const task = await createTask(member, { departmentId: department.id, title: "Подготовка проекта", priority: "MEDIUM", assigneeIds: [member.id] });
    const report = await saveReport(member, { taskId: task.id, summary: "Подготовлены материалы", performedOn: "2026-10-01", claimedMinutes: 90, submit: true });
    await expect(decideReport(member, { id: report.id, action: "APPROVE" })).rejects.toThrow();
    await decideReport(vice, { id: report.id, action: "APPROVE" });
    expect((await getWorkspace(member, department.id, new URLSearchParams({ period: "custom", from: "2026-10-01", to: "2026-10-31" }))).leaderboard[0].minutes).toBe(90);
    const rejected = await saveReport(member, { taskId: task.id, summary: "Ещё один результат", performedOn: "2026-10-02", claimedMinutes: 30, submit: true });
    await decideReport(minister, { id: rejected.id, action: "REJECT", reason: "Добавьте результат" });
    expect((await db.report.findUniqueOrThrow({ where: { id: rejected.id } })).status).toBe("REJECTED");
    await updateMembership(vice, { userId: member.id, departmentId: department.id, role: "MEMBER", status: "SUSPENDED" });
    await expect(getWorkspace(member, department.id)).rejects.toThrow();
  });

  it("denies reads, forged resource IDs and writes across departments, including other ministers", async () => {
    const { department, member, minister } = await fixture();
    const other = await db.department.findUniqueOrThrow({ where: { schoolId_slug: { schoolId: "school", slug: "mass-media" } } });
    const outsider = await db.user.create({ data: { schoolId: "school", name: "Другой министр", onboarded: true, registrationDepartmentId: other.id, memberships: { create: { departmentId: other.id, role: "MINISTER" } } } });
    const task = await createTask(outsider, { departmentId: other.id, title: "Чужая задача", priority: "MEDIUM", assigneeIds: [outsider.id] });
    const report = await saveReport(outsider, { taskId: task.id, summary: "Чужой отчёт", performedOn: "2026-10-01", claimedMinutes: 30, submit: true });
    const channel = await db.channel.findFirstOrThrow({ where: { departmentId: other.id } });
    await sendMessage(outsider, { channelId: channel.id, text: "Чужое сообщение" });
    for (const actor of [member, minister]) {
      await expect(getWorkspace(actor, other.id)).rejects.toThrow();
      await expect(readChat(actor, new URLSearchParams({ channel: channel.id }))).rejects.toThrow();
      await expect(commentTask(actor, { taskId: task.id, text: "Атака" })).rejects.toThrow();
      await expect(saveReport(actor, { taskId: task.id, summary: "Атака", performedOn: "2026-10-01", claimedMinutes: 10, submit: true })).rejects.toThrow();
      await expect(decideReport(actor, { id: report.id, action: "APPROVE" })).rejects.toThrow();
      await expect(updateMembership(actor, { userId: outsider.id, departmentId: other.id, role: "MEMBER", status: "REVOKED" })).rejects.toThrow();
    }
    const workspace = await getWorkspace(member, department.id);
    expect(workspace.tasks).toHaveLength(0);
    expect(workspace.members.some(m => m.userId === outsider.id)).toBe(false);
    expect(workspace.allDepartments.map(d => d.id)).toEqual([department.id]);
    await expect(createTask(minister, { departmentId: department.id, title: "Атака", priority: "MEDIUM", assigneeIds: [outsider.id] })).rejects.toThrow();
    await expect(createEvent(minister, { departmentId: department.id, title: "Атака", goal: "Тест", location: "Школа", startAt: "2026-12-01T09:00:00Z", endAt: "2026-12-01T10:00:00Z", memberIds: [outsider.id] })).rejects.toThrow();
  });

  it("rejects missing/unknown departments, role injection and unverified admin email spoofing", async () => {
    const { department: omitted, ...missing } = signup("sport");
    expect(omitted).toBe("sport");
    await expect(registerAccount(missing)).rejects.toThrow();
    await expect(registerAccount(signup("made-up"))).rejects.toThrow();
    for (const injected of [{ globalRole: "SCHOOL_ADMIN" }, { role: "MINISTER" }, { schoolId: "other" }, { departmentId: "other" }]) {
      await expect(registerAccount({ ...signup("sport"), ...injected })).rejects.toThrow();
    }
    const registration = await registerAccount(signup("sport", "janbolatique.kz@gmail.com"));
    const spoof = await db.user.findUniqueOrThrow({ where: { id: registration.id } });
    expect(spoof.globalRole).toBe("STUDENT");
    expect(await db.membership.count({ where: { userId: spoof.id } })).toBe(0);
    await expect(syncLeadership({ sport: { ministers: [spoof.email], viceMinisters: [] } }, true)).rejects.toThrow("Google");
  });

  it("prevents department changes and escalation through profile, applications and management forms", async () => {
    const { department, member, minister, vice } = await fixture();
    const other = await db.department.findFirstOrThrow({ where: { slug: "management" } });
    await expect(selectDepartment(member, { departmentId: other.id })).rejects.toThrow("уже выбран");
    await expect(apply(member, { departmentId: other.id, motivation: "Тест", direction: "Тест", skills: "Тест", weeklyHours: 2, idea: "Тест" })).rejects.toThrow();
    await expect(saveProfile(member, { name: "Тест", classroom: "10 A", image: "", globalRole: "SCHOOL_ADMIN" })).rejects.toThrow();
    for (const actor of [minister, vice]) {
      await expect(updateGlobalRole(actor, { userId: actor.id, role: "PRESIDENT" })).rejects.toThrow();
      await expect(updateMembership(actor, { userId: member.id, departmentId: department.id, role: "MEMBER", globalRole: "PRESIDENT", status: "ACTIVE" })).rejects.toThrow();
      await expect(updateMembership(actor, { userId: actor.id, departmentId: department.id, role: "MINISTER", status: "ACTIVE", globalRole: "SCHOOL_ADMIN" })).rejects.toThrow();
    }
  });

  it("lets a new Google identity choose once without granting roles or membership", async () => {
    const user = await db.user.create({ data: { schoolId: "school", name: "Google ученик" } });
    const department = await db.department.findFirstOrThrow({ where: { slug: "mentorship" } });
    await selectDepartment(user, { departmentId: department.id });
    await selectDepartment(user, { departmentId: department.id });
    expect(await db.membership.count({ where: { userId: user.id } })).toBe(0);
    const anotherSchool = await db.school.create({ data: { id: "other-school" } });
    const foreign = await db.department.create({ data: { schoolId: anotherSchool.id, slug: "sport", name: "Спорт" } });
    await expect(selectDepartment(user, { departmentId: foreign.id })).rejects.toThrow();
    await expect(db.user.update({ where: { id: user.id }, data: { registrationDepartmentId: foreign.id } })).rejects.toThrow();
  });

  it("previews and atomically applies verified leadership from private configuration", async () => {
    const { department, member } = await fixture();
    await db.account.create({ data: { userId: member.id, type: "oauth", provider: "google", providerAccountId: "verified-member-subject" } });
    const config = { sport: { ministers: [], viceMinisters: [member.email] } };
    expect(await syncLeadership(config)).toHaveLength(1);
    expect((await access(db, member, department.id)).manager).toBe(false);
    await syncLeadership(config, true);
    expect((await access(db, member, department.id)).member?.role).toBe("VICE_MINISTER");
    expect((await db.user.findUniqueOrThrow({ where: { id: member.id } })).globalRole).toBe("STUDENT");
    await syncLeadership(config, true);
    expect(await db.auditLog.count({ where: { action: "LEADERSHIP_CONFIG_ASSIGNED" } })).toBe(1);
    await expect(syncLeadership({ sport: { ministers: [member.email], viceMinisters: [member.email] } }, true)).rejects.toThrow("дважды");
  });

  it("keeps existing department IDs, names, rates, channels, roles and work when seeding again", async () => {
    const { department, member, minister } = await fixture("intellectual-development");
    await db.department.update({ where: { id: department.id }, data: { name: "Existing Intellectual", ministerName: "Existing Minister", rate: 17 } });
    const task = await createTask(member, { departmentId: department.id, title: "Историческая задача", priority: "MEDIUM" });
    await ensureSchoolDepartments(); await ensureSchoolDepartments();
    expect(await db.department.count()).toBe(7);
    expect(await db.channel.count()).toBe(14);
    expect((await db.department.findUniqueOrThrow({ where: { id: department.id } })).name).toBe("Existing Intellectual");
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).departmentId).toBe(department.id);
    expect((await access(db, minister, department.id)).member?.role).toBe("MINISTER");
  });

  it("enables database RLS on every application table, closing direct Data API access", async () => {
    const tables = await db.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'`;
    expect(tables.length).toBeGreaterThan(20);
    expect(tables.filter(table => !table.relrowsecurity)).toEqual([]);
  });

  it("blocks a non-server SQL role even if table SELECT privileges are accidentally granted", async () => {
    await fixture();
    // Everything, including the temporary PostgreSQL role, rolls back at the end.
    await expect(db.$transaction(async tx => {
      await tx.$executeRawUnsafe("CREATE ROLE councilspace_rls_probe NOLOGIN");
      await tx.$executeRawUnsafe("GRANT USAGE ON SCHEMA public TO councilspace_rls_probe");
      await tx.$executeRawUnsafe('GRANT SELECT ON "User", "Membership", "Task" TO councilspace_rls_probe');
      await tx.$executeRawUnsafe("SET LOCAL ROLE councilspace_rls_probe");
      expect(await tx.$queryRawUnsafe('SELECT id FROM "User"')).toEqual([]);
      expect(await tx.$queryRawUnsafe('SELECT id FROM "Membership"')).toEqual([]);
      expect(await tx.$queryRawUnsafe('SELECT id FROM "Task"')).toEqual([]);
      throw new Error("rollback RLS probe");
    })).rejects.toThrow("rollback RLS probe");
  });
});
