import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

// Dedicated local-only QA server. Does not read or modify deployment credentials.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL explicitly to a local *_test database.");
const target = new URL(connectionString);
if (!target.pathname.endsWith("_test") || !["localhost", "127.0.0.1"].includes(target.hostname)) throw new Error("QA server requires a local *_test database.");
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "localhost"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: connectionString,
    NEXTAUTH_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    ENABLE_DEMO: "false",
    ENABLE_DEV_LOGIN: "false"
  }
});
server.on("exit", code => { process.exitCode = code || 0; });
