import "dotenv/config";
import approved from "../config/approved-ministers.json";
import { db } from "../src/lib/db";
import { approvedMinisterDepartment, provisionApprovedMinister } from "../src/server/approved-ministers";

async function main() {
  const apply = process.argv.includes("--apply");
  const candidates = await db.user.findMany({
    where: { schoolId: process.env.COUNCIL_SCHOOL_ID || "school", isDemo: false, accounts: { some: { provider: "google" } } },
    select: { id: true, email: true }
  });
  const results: Record<string, string> = Object.fromEntries(Object.keys(approved).map(slug => [slug, "pending_verified_google_login"]));
  for (const user of candidates) {
    const slug = user.email && approvedMinisterDepartment(user.email);
    if (slug) results[slug] = await provisionApprovedMinister(user.id, apply);
  }
  console.table(results);
  console.log(apply ? "Verified minister grants processed; pending grants activate after Google sign-in." : "Dry run. Use --apply to assign roles.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Minister provisioning failed."); process.exitCode = 1; }).finally(() => db.$disconnect());
