import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { DEPARTMENTS } from "../src/lib/departments";
import { hashPassword } from "../src/lib/password";
import { schoolDate } from "../src/lib/time";

const base = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const target = new URL(process.env.DATABASE_URL || "");
if (!target.pathname.endsWith("_test") || !["localhost", "127.0.0.1"].includes(target.hostname) || new URL(base).hostname !== "localhost") throw new Error("HTTP verification requires a local server and a dedicated *_test database.");
const password = randomBytes(24).toString("hex");
const run = randomBytes(6).toString("hex");

class Client {
  cookies = new Map<string, string>();
  async request(path: string, init: RequestInit = {}) {
    const response = await fetch(base + path, { ...init, redirect: "manual", headers: { origin: base, cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "), ...init.headers } });
    for (const value of response.headers.getSetCookie()) {
      const [key, ...parts] = value.split(";")[0].split("=");
      this.cookies.set(key, parts.join("="));
    }
    return response;
  }
  async login(email: string) {
    const csrf = await (await this.request("/api/auth/csrf")).json();
    await this.request("/api/auth/callback/password", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, json: "true", callbackUrl: base + "/workspace" }) });
    const session = await (await this.request("/api/auth/session")).json();
    assert.equal(session.user?.email, email, "Password login must create a real NextAuth session");
  }
  async action(action: string, data: unknown, status = 200) {
    const response = await this.request("/api/council", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
    const result = await response.json();
    assert.equal(response.status, status, `${action}: ${result.error || response.status}`);
    return result.data;
  }
}

async function main() {
  const anonymous = new Client();
  assert.equal((await anonymous.request("/api/council")).status, 401);
  const identities: { member: Client; minister: Client; vice: Client; departmentId: string; taskId: string; reportId: string; email: string }[] = [];
  const hash = await hashPassword(password);
  for (const [index, department] of DEPARTMENTS.entries()) {
    const member = new Client(), minister = new Client(), vice = new Client();
    const email = `http-${run}-${index}@example.invalid`;
    const form = { name: "HTTP Test Member", email, password, confirmPassword: password, department: department.slug };
    assert.equal((await member.request("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, role: "MINISTER" }) })).status, 400);
    const registration = await member.request("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    assert.equal(registration.status, 201, await registration.text());
    await member.login(email);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const dept = await db.department.findUniqueOrThrow({ where: { id: user.registrationDepartmentId! } });
    assert.equal(dept.slug, department.slug);
    assert.equal(user.globalRole, "STUDENT");
    for (const [client, role] of [[minister, "MINISTER"], [vice, "VICE_MINISTER"]] as const) {
      const leaderEmail = `${role.toLowerCase()}-${run}-${index}@example.invalid`;
      await db.user.create({ data: { schoolId: user.schoolId, name: `HTTP ${role}`, email: leaderEmail, passwordHash: hash, onboarded: true, classroom: "10 A", registrationDepartmentId: dept.id, memberships: { create: { departmentId: dept.id, role } } } });
      await client.login(leaderEmail);
    }
    assert.equal((await member.request(`/api/council?department=${dept.id}`)).status, 403);
    await member.action("saveProfile", { name: "HTTP Test Member", classroom: "10 A", interests: "Projects", image: "" });
    const application = await member.action("apply", { departmentId: dept.id, motivation: "School contribution", direction: "Projects", skills: "Organisation", weeklyHours: 3, idea: "School event" });
    await minister.action("decideApplication", { id: application.id, status: "APPROVED" });
    const workspace = await (await member.request("/api/council")).json();
    assert.deepEqual(workspace.departments.map((d: { id: string }) => d.id), [dept.id]);
    const task = await member.action("createTask", { departmentId: dept.id, title: `HTTP ${department.slug}`, priority: "MEDIUM", assigneeIds: [user.id] });
    const report = await member.action("saveReport", { taskId: task.id, summary: "HTTP verified result", performedOn: schoolDate(new Date(), "Asia/Qyzylorda"), claimedMinutes: 90, submit: true });
    await member.action("decideReport", { id: report.id, action: "APPROVE" }, 403);
    await vice.action("decideReport", { id: report.id, action: "APPROVE" });
    const second = await member.action("saveReport", { taskId: task.id, summary: "HTTP second result", performedOn: schoolDate(new Date(), "Asia/Qyzylorda"), claimedMinutes: 30, submit: true });
    await minister.action("decideReport", { id: second.id, action: "REJECT", reason: "Please add evidence" });
    const updated = await (await member.request("/api/council")).json();
    assert.equal(updated.leaderboard.find((entry: { user: { id: string } }) => entry.user.id === user.id).minutes, 90);
    assert.equal(updated.tasks.every((entry: { departmentId: string }) => entry.departmentId === dept.id), true);
    identities.push({ member, minister, vice, departmentId: dept.id, taskId: task.id, reportId: report.id, email });
    console.log(`PASS ${department.slug}: registration, login, application, task, report, minister/vice moderation, leaderboard`);
  }
  for (let i = 0; i < identities.length; i++) {
    const current = identities[i], other = identities[(i + 1) % identities.length];
    for (const client of [current.member, current.minister, current.vice]) {
      assert.equal((await client.request(`/api/council?department=${other.departmentId}`)).status, 403);
      await client.action("saveReport", { taskId: other.taskId, summary: "Cross department attack", performedOn: schoolDate(new Date(), "Asia/Qyzylorda"), claimedMinutes: 10, submit: true }, 403);
      await client.action("decideReport", { id: other.reportId, action: "APPROVE" }, 403);
    }
    await current.minister.action("updateGlobalRole", { userId: "anyone", role: "PRESIDENT" }, 403);
  }
  await mkdir(".local", { recursive: true });
  await writeFile(".local/http-verification-login.json", JSON.stringify({ email: identities[0].email, password, base }, null, 2));
  console.log("PASS HTTP isolation and escalation checks for all seven departments. Synthetic UI login saved in ignored .local/http-verification-login.json.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "HTTP verification failed"); process.exitCode = 1; }).finally(() => db.$disconnect());
