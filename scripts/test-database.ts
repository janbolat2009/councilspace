import "dotenv/config";
import pg from "pg";
import { spawnSync } from "node:child_process";
async function main() {
  const target=process.env.TEST_DATABASE_URL||"postgresql://council:council@127.0.0.1:5432/council_test";
  const url=new URL(target),name=url.pathname.slice(1);
  if(!/^[a-zA-Z0-9_]+_test$/.test(name))throw new Error("Test database name must end in _test.");
  url.pathname="/postgres";
  const client=new pg.Client({connectionString:url.toString()});await client.connect();
  if(!(await client.query("SELECT 1 FROM pg_database WHERE datname=$1",[name])).rowCount)await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
  const result=spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{stdio:"inherit",env:{...process.env,DATABASE_URL:target}});
  if(result.status!==0)throw new Error("Test migration failed.");
  console.log("Dedicated test database is ready.");
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
