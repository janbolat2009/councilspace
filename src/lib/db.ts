import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalDb = globalThis as unknown as { prisma?: PrismaClient };

const connectionString = process.env.DATABASE_URL;
const isRemote = Boolean(connectionString && !connectionString.includes("127.0.0.1") && !connectionString.includes("localhost"));

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    })
  : undefined;

export const db = globalDb.prisma ?? new PrismaClient({
  adapter: pool ? new PrismaPg(pool) : new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  log: ["error"]
});
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
