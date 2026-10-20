import "dotenv/config";
import { db } from "../src/lib/db";
import { decideReport } from "../src/server/reports";
async function main() {
  if (process.env.ENABLE_DEMO !== "true") throw new Error("Set ENABLE_DEMO=true explicitly to seed the isolated demo school.");
  const schoolId = "demo-school";
  await db.school.upsert({ where: { id: schoolId }, create: { id: schoolId, name: "Student Council · Демо" }, update: {} });
  const dept = await db.department.upsert({ where: { id: "demo-intellectual" },
    create: { id: "demo-intellectual", schoolId, slug: "intellectual-development", name: "Intellectual Development", ministerName: "Zhanbolat", description: "Место, где любопытство становится действием.", channels: { create: [{ id: "demo-general", name: "General" }, { id: "demo-announcements", name: "Announcements", announcements: true }] } }, update: {} });
  const profiles = [
    ["demo-admin", "Демо · администратор", "admin@demo.invalid", "SCHOOL_ADMIN"],
    ["demo-minister", "Демо · министр", "minister@demo.invalid", "STUDENT"],
    ["demo-member-1", "Демо · участник 01", "member@demo.invalid", "STUDENT"],
    ["demo-member-2", "Демо · участник 02", "member2@demo.invalid", "STUDENT"],
    ["demo-member-3", "Демо · участник 03", "member3@demo.invalid", "STUDENT"],
    ["demo-candidate", "Демо · кандидат", "candidate@demo.invalid", "STUDENT"]
  ] as const;
  for (const [id, name, email, globalRole] of profiles) {
    await db.user.upsert({ where: { id }, create: { id, name, email, globalRole, schoolId, isDemo: true, classroom: "10 A", onboarded: true, interests: "Демонстрационный профиль. Наука, дебаты, организация мероприятий." }, update: {} });
    if (id !== "demo-candidate") await db.membership.upsert({ where: { userId_departmentId: { userId: id, departmentId: dept.id } }, create: { userId: id, departmentId: dept.id, role: id === "demo-minister" ? "MINISTER" : "MEMBER" }, update: {} });
  }
  const anchor = new Date(); anchor.setUTCHours(10, 0, 0, 0);
  const day = (offset: number) => { const d = new Date(anchor); d.setUTCDate(d.getUTCDate() + offset); return d; };
  const eventNames = ["Интеллектуальная игра «Что? Где? Когда?»", "Science Fair", "Встреча с выпускниками", "Математический футбол", "Кейс-чемпионат"];
  for (let i = 0; i < eventNames.length; i++) {
    const startAt = day(3 + i * 4), endAt = new Date(startAt.getTime() + 7200000);
    await db.event.upsert({ where: { id: `demo-event-${i}` }, create: { id: `demo-event-${i}`, departmentId: dept.id, leadId: "demo-minister", title: eventNames[i], description: "Демонстрационное мероприятие для знакомства с платформой. Дата и место условные.", goal: "Обменяться знаниями и попробовать новые форматы командной работы.", startAt, endAt, location: i % 2 ? "Библиотека · демо" : "Актовый зал · демо", audience: "Ученики 9–12 классов", status: i < 2 ? "CONFIRMED" : "PROPOSED", backupPlan: "Провести встречу онлайн.", members: { create: [{ userId: "demo-member-1" }, { userId: "demo-member-2" }] }, guests: { create: i === 2 ? [{ name: "Гость · не назначен", status: "UNCONFIRMED" }] : [] } }, update: {} });
  }
  const titles = ["Подготовить вопросы для интеллектуальной игры", "Собрать заявки на Science Fair", "Разработать афишу встречи", "Согласовать правила математического футбола", "Подготовить кейс для чемпионата", "Составить план работы департамента"];
  const statuses = ["IN_PROGRESS", "TODO", "SUBMITTED", "TODO", "IN_PROGRESS", "COMPLETED"] as const;
  for (let i = 0; i < titles.length; i++) {
    await db.task.upsert({ where: { id: `demo-task-${i}` }, create: { id: `demo-task-${i}`, departmentId: dept.id, authorId: "demo-minister", eventId: `demo-event-${i % 5}`, title: titles[i], description: "Демонстрационная задача. Согласуйте материалы с командой и приложите результат в отчёте.", priority: i === 0 ? "HIGH" : "MEDIUM", status: statuses[i], dueDate: day(i + 1), assignees: { create: [{ userId: i === 5 ? "demo-minister" : `demo-member-${i % 3 + 1}` }] }, checklist: { create: [{ text: "Обсудить идею с командой", done: i % 2 === 0 }, { text: "Подготовить материалы" }, { text: "Отправить результат на проверку" }] } }, update: {} });
  }
  const minister = await db.user.findUniqueOrThrow({ where: { id: "demo-minister" } });
  const admin = await db.user.findUniqueOrThrow({ where: { id: "demo-admin" } });
  for (let i = 0; i < 6; i++) {
    const existing = await db.report.findUnique({ where: { id: `demo-report-${i}` } });
    if (existing) continue;
    await db.report.create({ data: { id: `demo-report-${i}`, taskId: `demo-task-${i}`, userId: i === 5 ? minister.id : `demo-member-${i % 3 + 1}`, summary: "Демонстрационный отчёт: подготовлены материалы и обсуждены с командой.", performedOn: day(-i - 1), claimedMinutes: [90, 120, 60, 45, 75, 150][i], evidenceUrl: "", status: "PENDING" } });
    if ([0,1,5].includes(i)) await decideReport(i === 5 ? admin : minister, { id: `demo-report-${i}`, action: "APPROVE", reason: "Демонстрационное начисление" });
    if (i === 3) await decideReport(minister, { id: `demo-report-${i}`, action: "CHANGES", reason: "Добавьте описание результата и ссылку." });
    if (i === 4) await decideReport(minister, { id: `demo-report-${i}`, action: "REJECT", reason: "Демонстрационный пример отклонённого отчёта." });
  }
  await db.application.upsert({ where: { id: "demo-application" }, create: { id: "demo-application", departmentId: dept.id, userId: "demo-candidate", motivation: "Хочу помогать с интеллектуальными играми и развивать навыки организации. Демонстрационная заявка.", direction: "Интеллектуальные игры", skills: "Исследование, презентации", weeklyHours: 4, idea: "Межклассный турнир по логике" }, update: {} });
  const messages = ["Добро пожаловать в демонстрационное пространство! Здесь команда обсуждает идеи и подготовку мероприятий.", "Добавил черновик вопросов к интеллектуальной игре. Можно обсудить на ближайшей встрече.", "В отчёте укажите фактическое время и ссылку на результат — после проверки появятся часы и баллы."];
  for (let i = 0; i < messages.length; i++) await db.message.upsert({ where: { id: `demo-message-${i}` }, create: { id: `demo-message-${i}`, channelId: "demo-general", userId: i === 1 ? "demo-member-1" : minister.id, text: messages[i] }, update: {} });
  console.log("Isolated demo school is ready. All profiles and activity are explicitly fictional.");
}
main().finally(() => db.$disconnect());
