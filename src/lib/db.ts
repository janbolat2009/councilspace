import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";
import { parse } from "pg-connection-string";

const globalDb = globalThis as unknown as { prisma?: PrismaClient };

function createPool(): Pool | undefined {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return undefined;

  const isRemote = !connectionString.includes("127.0.0.1") && !connectionString.includes("localhost");
  if (isRemote) {
    const parsed = parse(connectionString);
    delete (parsed as Record<string, unknown>).sslmode;
    delete (parsed as Record<string, unknown>).ssl;
    const config: PoolConfig = {
      user: parsed.user,
      password: parsed.password,
      host: parsed.host ?? undefined,
      port: parsed.port ? parseInt(parsed.port, 10) : undefined,
      database: parsed.database ?? undefined,
      ssl: { rejectUnauthorized: false },
      max: 5,
    };
    return new Pool(config);
  }

  return new Pool({ connectionString });
}

const pool = createPool();

export const db = globalDb.prisma ?? new PrismaClient({
  adapter: pool ? new PrismaPg(pool) : new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  log: []
});

globalDb.prisma = db;
