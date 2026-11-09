import "dotenv/config";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import pg from "pg";

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || "postgresql://council:council@127.0.0.1:5432/council_test");
  if (!url.pathname.endsWith("_test") || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Migration verification requires a local *_test database.");
  const database = `council_migration_${randomBytes(6).toString("hex")}_test`;
  url.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
  url.pathname = `/${database}`;
  const client = new pg.Client({ connectionString: url.toString() });
  try {
    await client.connect();
    const migrations = (await readdir("prisma/migrations", { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    const current = migrations.find(name => name.endsWith("_department_workspaces"))!;
    for (const migration of migrations.filter(name => name < current)) await client.query(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    await client.query(`
      INSERT INTO "School" (id) VALUES ('legacy-school');
      INSERT INTO "Department" (id, "schoolId", slug, name, "ministerName", rate) VALUES ('legacy-dept','legacy-school','intellectual-development','Original Intellectual','Original Minister',17);
      INSERT INTO "User" (id, email, "schoolId", "globalRole", onboarded) VALUES ('legacy-user','legacy@example.invalid','legacy-school','SCHOOL_ADMIN',true),('legacy-candidate','candidate@example.invalid','legacy-school','STUDENT',false);
      INSERT INTO "Membership" (id,"userId","departmentId",role) VALUES ('legacy-membership','legacy-user','legacy-dept','MINISTER');
      INSERT INTO "Task" (id,"departmentId","authorId",title,"updatedAt") VALUES ('legacy-task','legacy-dept','legacy-user','Original task',now());
      INSERT INTO "Report" (id,"taskId","userId",summary,"performedOn","claimedMinutes","approvedMinutes",status,revision,"updatedAt") VALUES ('legacy-report','legacy-task','legacy-user','Original report','2026-10-01',90,90,'APPROVED',1,now());
      INSERT INTO "LedgerEntry" (id,"reportId","userId",revision,kind,minutes,points,rate,"ruleVersion","performedOn") VALUES ('legacy-credit','legacy-report','legacy-user',1,'CREDIT',90,25.5,17,1,'2026-10-01');
      INSERT INTO "Channel" (id,"departmentId",name) VALUES ('legacy-channel','legacy-dept','General');
      INSERT INTO "Message" (id,"channelId","userId",text) VALUES ('legacy-message','legacy-channel','legacy-user','Original message');
    `);
    const tables = ["School", "Department", "User", "Membership", "Task", "Report", "LedgerEntry", "Message"];
    const before = new Map<string, unknown>();
    for (const table of tables) before.set(table, (await client.query(`SELECT to_jsonb(t) AS value FROM "${table}" t ORDER BY id`)).rows);
    await client.query(await readFile(`prisma/migrations/${current}/migration.sql`, "utf8"));
    for (const table of tables) {
      const value = table === "User" ? "to_jsonb(t)-'registrationDepartmentId'" : "to_jsonb(t)";
      const filter = table === "Department" ? "WHERE id='legacy-dept'" : "";
      assert.deepEqual((await client.query(`SELECT ${value} AS value FROM "${table}" t ${filter} ORDER BY id`)).rows, before.get(table), `${table} history changed`);
    }
    assert.equal((await client.query('SELECT count(*)::int AS count FROM "Department"')).rows[0].count, 7);
    assert.equal((await client.query('SELECT count(*)::int AS count FROM "Channel"')).rows[0].count, 14);
    assert.equal((await client.query('SELECT count(*)::int AS count FROM "User" WHERE "registrationDepartmentId"=\'legacy-dept\'')).rows[0].count, 2);
    console.log("PASS migration replay: legacy accounts, roles, department ID/settings, tasks, approved reports, credits and chat preserved; all seven departments and channels added; legacy candidate gains no membership.");
  } finally {
    await client.end();
    await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Migration verification failed"); process.exitCode = 1; });
