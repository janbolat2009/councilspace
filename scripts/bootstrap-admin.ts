import "dotenv/config";
import { db } from "../src/lib/db";
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Usage: npm run admin:bootstrap -- owner@example.org");
  await db.$transaction(async tx => {
    const schoolId = process.env.COUNCIL_SCHOOL_ID || "school";
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bootstrap:${schoolId}`}))`;
    if (await tx.user.count({ where: { schoolId, globalRole: "SCHOOL_ADMIN" } })) throw new Error("An administrator already exists. Use the administration interface.");
    const user = await tx.user.findUnique({ where: { email }, include: { accounts: true } });
    if (!user || user.schoolId !== schoolId || user.isDemo || !user.accounts.some(a => a.provider === "google")) throw new Error("The owner must first sign in with their verified Google account.");
    await tx.user.update({ where: { id: user.id }, data: { globalRole: "SCHOOL_ADMIN" } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "ADMIN_BOOTSTRAPPED", objectId: user.id, reason: "Explicit operator bootstrap via server CLI" } });
  }, { isolationLevel: "Serializable" });
  console.log("First administrator assigned. Existing sessions use the updated role immediately.");
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
