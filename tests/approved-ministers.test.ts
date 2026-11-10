import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/lib/db";
import { access } from "../src/lib/policy";
import { ensureSchoolDepartments, registerAccount } from "../src/server/accounts";
import { approvedMinisterDepartment, provisionApprovedMinister } from "../src/server/approved-ministers";

vi.mock("../config/approved-ministers.json", async () => {
  const { createHash } = await import("node:crypto");
  return { default: { sport: createHash("sha256").update("approved@example.invalid").digest("hex") } };
});

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE "School" CASCADE');
  await db.authRateLimit.deleteMany();
  vi.stubEnv("COUNCIL_SCHOOL_ID", "school");
  await ensureSchoolDepartments();
});
afterAll(async () => { vi.unstubAllEnvs(); await db.$disconnect(); });

async function candidate(google = true, email = "approved@example.invalid") {
  return db.user.create({ data: { schoolId: "school", email, accounts: google ? { create: { type: "oauth", provider: "google", providerAccountId: email } } : undefined } });
}

describe("Approved minister grants", () => {
  it("normalizes identifiers and rejects unlisted addresses", () => {
    expect(approvedMinisterDepartment(" APPROVED@EXAMPLE.INVALID ")).toBe("sport");
    expect(approvedMinisterDepartment("other@example.invalid")).toBeUndefined();
  });
  it("does not grant a role to an unverified password registration", async () => {
    const password = "Synthetic password 123!";
    const user = await registerAccount({ name: "Synthetic minister", email: "approved@example.invalid", department: "sport", password, confirmPassword: password });
    expect(await provisionApprovedMinister(user.id, true)).toBe("ineligible");
    expect(await db.membership.count({ where: { userId: user.id } })).toBe(0);
  });
  it("assigns only the approved department with no global escalation, and is idempotent", async () => {
    const user = await candidate();
    expect(await provisionApprovedMinister(user.id)).toBe("ready");
    expect(await db.membership.count()).toBe(0);
    expect(await provisionApprovedMinister(user.id, true)).toBe("assigned");
    expect(await provisionApprovedMinister(user.id, true)).toBe("already_processed");
    const sport = await db.department.findUniqueOrThrow({ where: { schoolId_slug: { schoolId: "school", slug: "sport" } } });
    const other = await db.department.findUniqueOrThrow({ where: { schoolId_slug: { schoolId: "school", slug: "management" } } });
    expect((await access(db, user, sport.id, true)).manager).toBe(true);
    await expect(access(db, user, other.id, true)).rejects.toThrow();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).globalRole).toBe("STUDENT");
    expect(await db.auditLog.count({ where: { actorId: user.id } })).toBe(1);
  });
  it("honors an administrator's later demotion and revocation", async () => {
    const user = await candidate();
    await provisionApprovedMinister(user.id, true);
    await db.membership.updateMany({ where: { userId: user.id }, data: { role: "MEMBER" } });
    expect(await provisionApprovedMinister(user.id, true)).toBe("already_processed");
    expect((await db.membership.findFirstOrThrow({ where: { userId: user.id } })).role).toBe("MEMBER");
    await db.membership.updateMany({ where: { userId: user.id }, data: { status: "REVOKED" } });
    expect(await provisionApprovedMinister(user.id, true)).toBe("disabled");
  });
  it("does not reactivate a suspended membership", async () => {
    const user = await candidate();
    const department = await db.department.findUniqueOrThrow({ where: { schoolId_slug: { schoolId: "school", slug: "sport" } } });
    await db.membership.create({ data: { userId: user.id, departmentId: department.id, status: "SUSPENDED" } });
    expect(await provisionApprovedMinister(user.id, true)).toBe("disabled");
  });
  it("rejects demo users, other schools and unlisted verified emails", async () => {
    const user = await candidate();
    await db.user.update({ where: { id: user.id }, data: { isDemo: true } });
    expect(await provisionApprovedMinister(user.id, true)).toBe("ineligible");
    await db.school.create({ data: { id: "other" } });
    await db.user.update({ where: { id: user.id }, data: { isDemo: false, schoolId: "other" } });
    expect(await provisionApprovedMinister(user.id, true)).toBe("ineligible");
    expect(await provisionApprovedMinister((await candidate(true, "other@example.invalid")).id, true)).toBe("ineligible");
  });
  it("uses the explicit approved assignment while preserving historic membership", async () => {
    const user = await candidate();
    const original = await db.department.findUniqueOrThrow({ where: { schoolId_slug: { schoolId: "school", slug: "intellectual-development" } } });
    await db.user.update({ where: { id: user.id }, data: { registrationDepartmentId: original.id } });
    await db.membership.create({ data: { userId: user.id, departmentId: original.id, role: "MEMBER" } });
    await provisionApprovedMinister(user.id, true);
    expect(await db.membership.count({ where: { userId: user.id } })).toBe(2);
    expect((await db.membership.findUniqueOrThrow({ where: { userId_departmentId: { userId: user.id, departmentId: original.id } } })).role).toBe("MEMBER");
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { registrationDepartment: true } })).registrationDepartment?.slug).toBe("sport");
  });
});
