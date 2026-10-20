import "dotenv/config";
import { db } from "../src/lib/db";
async function main() {
  const schoolId = process.env.COUNCIL_SCHOOL_ID || "school";
  await db.school.upsert({ where: { id: schoolId }, create: { id: schoolId }, update: {} });
  await db.department.upsert({ where: { schoolId_slug: { schoolId, slug: "intellectual-development" } },
    create: { schoolId, slug: "intellectual-development", name: "Intellectual Development", ministerName: "Zhanbolat", description: "Развиваем любознательность, обмениваемся знаниями и создаём пространство для смелых идей.", channels: { create: [{ name: "General" }, { name: "Announcements", announcements: true }] } }, update: {} });
  console.log("Base school and department are ready. No user or role was assigned.");
}
main().finally(() => db.$disconnect());
