import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/lib/db";
import { registerAccount, authenticatePassword, acceptGoogleIdentity, setPassword, authLimit } from "../src/server/accounts";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { saveProfile } from "../src/server/admin";
import type { Account } from "next-auth";
const password = "Only a test passphrase 123!";
const account: Account = { provider: "google", type: "oauth", providerAccountId: "verified-test-subject" };
beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE "School" CASCADE');
  await db.authRateLimit.deleteMany();
  await db.school.create({ data: { id: "school" } });
  vi.stubEnv("COUNCIL_SCHOOL_ID", "school");
  vi.stubEnv("GOOGLE_ALLOWED_DOMAIN", "");
});
afterAll(async () => { vi.unstubAllEnvs(); await db.$disconnect(); });
describe("Email registration and Google account identity", () => {
  it("stores a salted scrypt hash and creates only an unprivileged profile", async () => {
    const registration = await registerAccount({ name: "Тестовый ученик", email: " Test@Example.org ", password, confirmPassword: password });
    expect(Object.keys(registration)).toEqual(["id"]);
    const user = await db.user.findUniqueOrThrow({ where: { id: registration.id } });
    expect(user.email).toBe("test@example.org");
    expect(user.globalRole).toBe("STUDENT");
    expect(user.onboarded).toBe(false);
    expect(user.emailVerified).toBeNull();
    expect(user.passwordHash).not.toContain(password);
    expect(await verifyPassword(password, user.passwordHash)).toBe(true);
    expect(await db.membership.count({ where: { userId: user.id } })).toBe(0);
  });
  it("accepts the right password and rejects the wrong password and unknown account", async () => {
    const created = await registerAccount({ name: "Ученик", email: "student@example.org", password, confirmPassword: password });
    expect((await authenticatePassword({ email: "STUDENT@example.org", password }))?.id).toBe(created.id);
    expect(await authenticatePassword({ email: "student@example.org", password: "wrong password" })).toBeNull();
    expect(await authenticatePassword({ email: "unknown@example.org", password })).toBeNull();
  });
  it("rejects duplicates without changing the password or profile", async () => {
    await registerAccount({ name: "Первое имя", email: "test@example.org", password, confirmPassword: password });
    await expect(registerAccount({ name: "Второе имя", email: "TEST@example.org", password: "Another valid password", confirmPassword: "Another valid password" })).rejects.toThrow("уже существует");
    expect((await authenticatePassword({ email: "test@example.org", password }))?.name).toBe("Первое имя");
  });
  it("validates lengths, matching confirmation and rejects role injection", async () => {
    await expect(registerAccount({ name: "Ученик", email: "test@example.org", password: "short", confirmPassword: "short" })).rejects.toThrow();
    await expect(registerAccount({ name: "Ученик", email: "test@example.org", password, confirmPassword: "Does not match" })).rejects.toThrow();
    await expect(registerAccount({ name: "Ученик", email: "test@example.org", password, confirmPassword: password, globalRole: "SCHOOL_ADMIN" })).rejects.toThrow();
    expect(await db.user.count()).toBe(0);
  });
  it("uses different salts and handles malformed or missing hashes safely", async () => {
    const a = await hashPassword(password), b = await hashPassword(password);
    expect(a).not.toBe(b);
    expect(await verifyPassword(password, "invalid")).toBe(false);
    expect(await verifyPassword(password, null)).toBe(false);
  });
  it("repairs a legacy Google-only identity without changing its role or duplicating it", async () => {
    const user = await db.user.create({ data: { name: "Ученик", email: "legacy@example.org", schoolId: "school", globalRole: "PRESIDENT" } });
    expect(await acceptGoogleIdentity(account, { email: "legacy@example.org", email_verified: true } as never)).toBe(true);
    expect(await db.user.count()).toBe(1);
    expect((await db.account.findUniqueOrThrow({ where: { provider_providerAccountId: { provider: "google", providerAccountId: account.providerAccountId } } })).userId).toBe(user.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).globalRole).toBe("PRESIDENT");
    await acceptGoogleIdentity(account, { email: "legacy@example.org", email_verified: true } as never);
    expect(await db.account.count()).toBe(1);
  });
  it("does not silently link Google to a password account with the same email", async () => {
    await registerAccount({ name: "Ученик", email: "test@example.org", password, confirmPassword: password });
    await acceptGoogleIdentity(account, { email: "test@example.org", email_verified: true } as never);
    // Auth.js must require the existing user's signed-in session before linking.
    expect(await db.account.count()).toBe(0);
  });
  it("refuses unverified Google emails and enforces the configured domain", async () => {
    expect(await acceptGoogleIdentity(account, { email: "test@example.org", email_verified: false } as never)).toBe("/login?error=UnverifiedGoogleEmail");
    vi.stubEnv("GOOGLE_ALLOWED_DOMAIN", "school.example");
    expect(await acceptGoogleIdentity(account, { email: "test@example.org", email_verified: true } as never)).toBe("/login?error=SchoolDomain");
    expect(await db.user.count()).toBe(0);
  });
  it("fails closed when the database cannot persist a verified Google identity", async () => {
    const originalTransaction = db.$transaction;
    const mock = vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("Database unavailable"));
    try {
      await expect(acceptGoogleIdentity(account, { email: "test@example.org", email_verified: true } as never)).rejects.toThrow();
    } finally {
      mock.mockRestore();
      // Prisma exposes this method through a proxy; restore its resolved function.
      db.$transaction = originalTransaction;
    }
  });
  it("requires the current password and never returns password hashes to profile callers", async () => {
    const registration = await registerAccount({ name: "Ученик", email: "test@example.org", password, confirmPassword: password });
    const user = await db.user.findUniqueOrThrow({ where: { id: registration.id } });
    await expect(setPassword(user, { currentPassword: "wrong password", password: "A new long passphrase", confirmPassword: "A new long passphrase" })).rejects.toThrow("неверен");
    const updated = await saveProfile(user, { name: "Ученик", classroom: "10 A", interests: "Наука", image: "" });
    expect(updated).not.toHaveProperty("passwordHash");
    await setPassword(user, { currentPassword: password, password: "A new long passphrase", confirmPassword: "A new long passphrase" });
    expect(await authenticatePassword({ email: "test@example.org", password })).toBeNull();
    expect((await authenticatePassword({ email: "test@example.org", password: "A new long passphrase" }))?.id).toBe(user.id);
  });
  it("rate limits attempts atomically even when concurrent", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => authLimit("test", "same identity", 10, 900000)));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(10);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(2);
  });
});
