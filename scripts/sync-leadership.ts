import "dotenv/config";
import { readFile } from "node:fs/promises";
import { syncLeadership } from "../src/server/leadership";

import { db } from "../src/lib/db";

async function main() {
  const path = process.env.LEADERSHIP_CONFIG_PATH || ".local/department-leadership.json";
  const apply = process.argv.includes("--apply");
  const plan = await syncLeadership(JSON.parse(await readFile(path, "utf8")), apply);
  console.table(plan.map(({ email, department, role }) => ({ email, department, role })));
  console.log(apply ? "Assignments applied. Global roles and all work records were preserved." : "Preview only. Run with --apply to assign these department roles.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Leadership configuration failed."); process.exitCode = 1; }).finally(() => db.$disconnect());
