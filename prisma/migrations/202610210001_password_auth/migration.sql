ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "User_email_case_insensitive" ON "User" (LOWER(email)) WHERE email IS NOT NULL;
CREATE TABLE "AuthRateLimit" (
  "key" TEXT PRIMARY KEY,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuthRateLimit_windowStart_idx" ON "AuthRateLimit" ("windowStart");
