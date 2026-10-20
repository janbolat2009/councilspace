import "dotenv/config";
const url = process.env.TEST_DATABASE_URL || "postgresql://council:council@127.0.0.1:5432/council_test";
if (!new URL(url).pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test.");
process.env.DATABASE_URL = url;

