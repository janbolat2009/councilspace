import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
async function main() {
  const path = resolve(".local/postgres");
  mkdirSync(resolve(".local"), { recursive: true });
  const pg = new EmbeddedPostgres({ databaseDir: path, user: "council", password: "council", port: 5432, persistent: true,
    authMethod: "scram-sha-256", postgresFlags: ["-c", "listen_addresses=127.0.0.1"], onLog: () => {}, onError: () => {} });
  if (!existsSync(resolve(path, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient(); await client.connect();
  const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", ["council"]);
  if (!found.rowCount) await pg.createDatabase("council");
  await client.end();
  console.log("Local PostgreSQL is ready at 127.0.0.1:5432. Ctrl+C stops it; data stays in .local/postgres.");
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await pg.stop(); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  setInterval(() => {}, 60000);
}
main().catch(() => { console.error("Local PostgreSQL failed. Check that port 5432 is available and the local data directory is writable."); process.exit(1); });
