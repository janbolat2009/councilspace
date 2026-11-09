import "dotenv/config";
import { db } from "../src/lib/db";
import { ensureSchoolDepartments } from "../src/server/accounts";
async function main() {
  await ensureSchoolDepartments();
  console.log("All seven departments are ready. Existing data and roles were preserved.");
}
main().finally(() => db.$disconnect());
