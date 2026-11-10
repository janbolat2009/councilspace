import { createHash } from "node:crypto";
import approved from "../../config/approved-ministers.json";
import { audit, transaction } from "@/lib/policy";

// These fingerprints are identifiers, not credentials. Never use them as proof of identity.
export function approvedMinisterDepartment(email: string) {
  const fingerprint = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return Object.entries(approved).find(([, value]) => value === fingerprint)?.[0];
}

// Google Account rows are created only after the verified-email OAuth check.
// A password registration or a chosen department can never claim this grant.
export async function provisionApprovedMinister(userId: string, apply = false) {
  return transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { accounts: { select: { provider: true } } } });
    if (!user || user.isDemo || user.schoolId !== (process.env.COUNCIL_SCHOOL_ID || "school") || !user.email) return "ineligible";
    const slug = approvedMinisterDepartment(user.email);
    if (!slug || !user.accounts.some(account => account.provider === "google")) return "ineligible";
    const department = await tx.department.findUniqueOrThrow({ where: { schoolId_slug: { schoolId: user.schoolId, slug } } });
    const previous = await tx.membership.findUnique({ where: { userId_departmentId: { userId, departmentId: department.id } } });
    if (previous && previous.status !== "ACTIVE") return "disabled";
    // Once consumed, an administrator's later demotion/revocation takes precedence.
    if (await tx.auditLog.findFirst({ where: { actorId: userId, departmentId: department.id, action: "APPROVED_MINISTER_PROVISIONED", objectId: userId } })) return "already_processed";
    if (!apply) return "ready";
    await tx.membership.upsert({
      where: { userId_departmentId: { userId, departmentId: department.id } },
      create: { userId, departmentId: department.id, role: "MINISTER" },
      update: { role: "MINISTER" }
    });
    // This is the administrator's explicit department assignment, not form input.
    await tx.user.update({ where: { id: userId }, data: { registrationDepartmentId: department.id } });
    await audit(tx, userId, department.id, "APPROVED_MINISTER_PROVISIONED", userId, "Approved minister configuration; Google mailbox verified; " + (previous?.role || "no membership") + " -> MINISTER");
    return "assigned";
  });
}
