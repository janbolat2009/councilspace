import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { access } from "../src/lib/policy";
import { apply, decideApplication } from "../src/server/applications";
import { saveReport, decideReport } from "../src/server/reports";
import { createTask, updateTask, createEvent, updateEvent, commentTask } from "../src/server/work";
import { sendMessage, readChat, editMessage, markChannelRead } from "../src/server/chat";
import { updateMembership, updateGlobalRole, updateRate, saveProfile, updateSchool } from "../src/server/admin";
import { getWorkspace } from "../src/server/queries";
import { localToUtc, periodBounds, schoolDate } from "../src/lib/time";
import type { User } from "@prisma/client";
let member:User, minister:User, admin:User, candidate:User, outsider:User;
const performedOn=schoolDate(new Date(Date.now()-86400000),"Asia/Qyzylorda");
async function taskFor(actor=member){return createTask(actor,{departmentId:"dept",title:"Рабочая задача",priority:"MEDIUM",assigneeIds:[actor.id]});}
async function reportFor(actor=member,minutes=90,submit=true){
  const task=await taskFor(actor);
  return saveReport(actor,{taskId:task.id,summary:"Подготовлены материалы",performedOn,claimedMinutes:minutes,submit});
}
async function totals(userId=member.id){return db.ledgerEntry.aggregate({where:{userId},_sum:{minutes:true,points:true}});}
beforeEach(async()=>{
  // setup.ts refuses any database whose name does not end in _test.
  await db.$executeRawUnsafe('TRUNCATE TABLE "School" CASCADE');
  await db.school.create({data:{id:"test-school"}});
  const make=(id:string,globalRole:"STUDENT"|"SCHOOL_ADMIN"="STUDENT")=>db.user.create({data:{id,name:id,email:`${id}@example.invalid`,schoolId:"test-school",globalRole,onboarded:true,classroom:"10 A"}});
  [member,minister,admin,candidate,outsider]=await Promise.all([make("member"),make("minister"),make("admin","SCHOOL_ADMIN"),make("candidate"),make("outsider")]);
  await db.department.create({data:{id:"dept",schoolId:"test-school",name:"Intellectual",slug:"intellectual",channels:{create:[{id:"general",name:"General"},{id:"announcements",name:"Announcements",announcements:true}]}}});
  await db.department.create({data:{id:"other-dept",schoolId:"test-school",name:"Other",slug:"other",channels:{create:{id:"other-chat",name:"General"}}}});
  await db.membership.createMany({data:[{userId:member.id,departmentId:"dept"},{userId:minister.id,departmentId:"dept",role:"MINISTER"},{userId:admin.id,departmentId:"dept"},{userId:outsider.id,departmentId:"other-dept",role:"MINISTER"}]});
});
afterAll(()=>db.$disconnect());
describe("PostgreSQL-backed authorization and work flows",()=>{
  it("admits only an approved applicant and prevents duplicate active applications",async()=>{
    const input={departmentId:"dept",motivation:"Хочу участвовать",direction:"Наука",skills:"Исследования",weeklyHours:3,idea:"Турнир"};
    await expect(access(db,candidate,"dept")).rejects.toThrow();
    const app=await apply(candidate,input);
    await expect(apply(candidate,input)).rejects.toThrow("Активная заявка");
    await decideApplication(minister,{id:app.id,status:"APPROVED",comment:"Добро пожаловать"});
    expect((await access(db,candidate,"dept")).member?.role).toBe("MEMBER");
    expect(await db.notification.count({where:{userId:candidate.id}})).toBe(1);
  });
  it("rejected and withdrawn applicants do not gain access",async()=>{
    const app=await apply(candidate,{departmentId:"dept",motivation:"Мотивация",direction:"Наука",skills:"Письмо",weeklyHours:2,idea:"Дебаты"});
    await decideApplication(minister,{id:app.id,status:"REJECTED",comment:"Уточните направление"});
    await expect(readChat(candidate,new URLSearchParams({channel:"general"}))).rejects.toThrow();
    await expect(getWorkspace(candidate,"dept")).rejects.toThrow();
    expect((await getWorkspace(candidate)).reports).toHaveLength(0);
  });
  it("90 minutes earn exactly 15 points only after approval, including concurrent requests",async()=>{
    const report=await reportFor();
    expect((await totals())._sum.minutes).toBeNull();
    await Promise.all([decideReport(minister,{id:report.id,action:"APPROVE"}),decideReport(admin,{id:report.id,action:"APPROVE"})]);
    await decideReport(minister,{id:report.id,action:"APPROVE"});
    const sum=await totals();
    expect(sum._sum.minutes).toBe(90);
    expect(sum._sum.points?.toString()).toBe("15");
    expect(await db.ledgerEntry.count({where:{reportId:report.id}})).toBe(1);
  });
  it("administrators and ministers cannot approve their own reports",async()=>{
    for(const actor of [minister,admin]){
      const report=await reportFor(actor);
      await expect(decideReport(actor,{id:report.id,action:"APPROVE"})).rejects.toThrow("Собственный");
      expect((await db.report.findUniqueOrThrow({where:{id:report.id}})).status).toBe("PENDING");
    }
  });
  it("allows requested corrections and resubmission, protects approved content",async()=>{
    const report=await reportFor();
    await decideReport(minister,{id:report.id,action:"CHANGES",reason:"Добавьте результат"});
    await saveReport(member,{id:report.id,taskId:report.taskId,summary:"Исправлено и дополнено",performedOn,claimedMinutes:90,evidenceUrl:"https://example.org/result",submit:true});
    await decideReport(minister,{id:report.id,action:"APPROVE"});
    await expect(saveReport(member,{id:report.id,taskId:report.taskId,summary:"Незаметное изменение",performedOn,claimedMinutes:120,submit:true})).rejects.toThrow("уже отправлен");
    expect(await db.reportDecision.count({where:{reportId:report.id}})).toBe(2);
  });
  it("retains historical rates and reverses rather than deleting credits",async()=>{
    const first=await reportFor();
    await decideReport(minister,{id:first.id,action:"APPROVE"});
    await updateRate(minister,{departmentId:"dept",rate:20,reason:"Новое правило"});
    const second=await reportFor();
    await decideReport(minister,{id:second.id,action:"APPROVE"});
    expect((await totals())._sum.points?.toString()).toBe("45");
    await Promise.all([decideReport(minister,{id:first.id,action:"REVERSE",reason:"Исправление"}),decideReport(admin,{id:first.id,action:"REVERSE",reason:"Исправление"})]);
    expect((await totals())._sum.points?.toString()).toBe("30");
    const firstEntries=await db.ledgerEntry.findMany({where:{reportId:first.id}});
    expect(firstEntries).toHaveLength(2);
    expect(firstEntries.map(e=>e.rate.toString())).toEqual(["10","10"]);
    await saveReport(member,{id:first.id,taskId:first.taskId,summary:"Исправлено",performedOn,claimedMinutes:90,submit:true});
    await decideReport(minister,{id:first.id,action:"APPROVE"});
    expect((await totals())._sum.points?.toString()).toBe("60");
    expect((await db.report.findUniqueOrThrow({where:{id:first.id}})).revision).toBe(2);
  });
  it("requires a reason for adjusted minutes and stores claimed separately",async()=>{
    const report=await reportFor();
    await expect(decideReport(minister,{id:report.id,action:"APPROVE",approvedMinutes:60})).rejects.toThrow("Объясните");
    await decideReport(minister,{id:report.id,action:"APPROVE",approvedMinutes:60,reason:"Подтверждена только основная часть"});
    const saved=await db.report.findUniqueOrThrow({where:{id:report.id}});
    expect(saved.claimedMinutes).toBe(90);expect(saved.approvedMinutes).toBe(60);
  });
  it("enforces the daily sum across reports and records an explained review exception",async()=>{
    const first=await reportFor(member,700);
    await expect(reportFor(member,30)).rejects.toThrow("Сумма отчётов");
    await decideReport(minister,{id:first.id,action:"APPROVE",approvedMinutes:720,reason:"Уточнённое время"});
    const second=await reportFor(member,20);
    await expect(decideReport(minister,{id:second.id,action:"APPROVE"})).rejects.toThrow("суточный предел");
    await decideReport(minister,{id:second.id,action:"APPROVE",overrideReason:"Документированное исключение"});
    expect((await totals())._sum.minutes).toBe(740);
  });
  it("blocks cross-department reads, task mutations, reports and message replies",async()=>{
    const task=await taskFor(),report=await reportFor();
    await expect(getWorkspace(outsider,"dept")).rejects.toThrow();
    await expect(readChat(outsider,new URLSearchParams({channel:"general"}))).rejects.toThrow();
    await expect(updateTask(outsider,{id:task.id,status:"COMPLETED"})).rejects.toThrow();
    await expect(decideReport(outsider,{id:report.id,action:"APPROVE"})).rejects.toThrow();
    const msg=await sendMessage(outsider,{channelId:"other-chat",text:"Закрытый канал"});
    await expect(sendMessage(member,{channelId:"general",text:"Ответ",replyToId:msg.id})).rejects.toThrow();
  });
  it("revocation takes effect using the same cached actor and preserves work history",async()=>{
    const report=await reportFor();
    await decideReport(minister,{id:report.id,action:"APPROVE"});
    await updateMembership(minister,{userId:member.id,departmentId:"dept",role:"MEMBER",status:"REVOKED",reason:"Участие завершено"});
    await expect(readChat(member,new URLSearchParams({channel:"general"}))).rejects.toThrow();
    await expect(sendMessage(member,{channelId:"general",text:"Недоступное сообщение"})).rejects.toThrow();
    expect((await totals())._sum.points?.toString()).toBe("15");
  });
  it("a member cannot grant leadership, assign others or change another person's task",async()=>{
    await expect(updateMembership(member,{userId:member.id,departmentId:"dept",role:"MINISTER",status:"ACTIVE",reason:"Самоназначение"})).rejects.toThrow();
    await expect(updateGlobalRole(member,{userId:member.id,role:"SCHOOL_ADMIN",reason:"Самоназначение"})).rejects.toThrow();
    await expect(createTask(member,{departmentId:"dept",title:"Задача",priority:"HIGH",assigneeIds:[minister.id]})).rejects.toThrow();
    const other=await taskFor(minister);
    await expect(updateTask(member,{id:other.id,status:"COMPLETED"})).rejects.toThrow();
    await expect(saveProfile(member,{name:"Имя",classroom:"10",interests:"",globalRole:"SCHOOL_ADMIN"})).rejects.toThrow();
  });
  it("persists chat, paginates, tracks unread, propagates edits and audits moderation",async()=>{
    const first=await sendMessage(member,{channelId:"general",text:"<script>alert(1)</script>"});
    const initial=await readChat(member,new URLSearchParams({channel:"general"}));
    expect(initial.messages[0].text).toBe("<script>alert(1)</script>");
    const before=initial.watermark;
    await editMessage(member,{id:first.id,text:"Исправленное сообщение"});
    const delta=await readChat(minister,new URLSearchParams({channel:"general",after:first.sequence.toString(),since:before}));
    expect(delta.messages).toHaveLength(0);expect(delta.changes[0].text).toBe("Исправленное сообщение");
    await expect(sendMessage(member,{channelId:"announcements",text:"Не моё объявление"})).rejects.toThrow();
    await sendMessage(minister,{channelId:"announcements",text:"Объявление"});
    await markChannelRead(minister,{channelId:"general",sequence:first.sequence.toString()});
    expect((await getWorkspace(minister,"dept")).channels.find(c=>c.id==="general")?.unread).toBe(0);
    await editMessage(minister,{id:first.id,remove:true,reason:"Тест модерации"});
    expect((await db.message.findUniqueOrThrow({where:{id:first.id}})).text).toBe("");
    expect(await db.auditLog.count({where:{action:"MESSAGE_REMOVED"}})).toBe(1);
    await db.message.createMany({data:Array.from({length:55},(_,i)=>({channelId:"general",userId:member.id,text:`История ${i}`}))});
    const page=await readChat(member,new URLSearchParams({channel:"general"}));
    expect(page.messages).toHaveLength(50);expect(page.hasMore).toBe(true);
    const older=await readChat(member,new URLSearchParams({channel:"general",before:page.messages[0].sequence.toString()}));
    expect(older.messages).toHaveLength(6);
    await expect(sendMessage(member,{channelId:"general",text:"Лимит"})).rejects.toThrow("20 сообщений");
  });
  it("requires moderation before publishing an event and ties channel access to department",async()=>{
    const event=await createEvent(member,{departmentId:"dept",title:"Игра",goal:"Обмен знаниями",location:"Кабинет",startAt:"2026-11-01T10:00:00Z",endAt:"2026-11-01T11:00:00Z",memberIds:[member.id]});
    expect(event.status).toBe("PROPOSED");expect(event.isPublic).toBe(false);
    await expect(updateEvent(member,{id:event.id,status:"CONFIRMED",isPublic:true})).rejects.toThrow();
    await updateEvent(minister,{id:event.id,status:"CONFIRMED",isPublic:true,createChannel:true});
    const channel=await db.channel.findFirstOrThrow({where:{eventId:event.id}});
    await expect(readChat(outsider,new URLSearchParams({channel:channel.id}))).rejects.toThrow();
  });
  it("keeps date-only deadlines and timezone conversions distinct",async()=>{
    const task=await createTask(member,{departmentId:"dept",title:"По дате",priority:"LOW",dueDate:"2026-11-03",assigneeIds:[member.id]});
    expect(task.dueAt).toBeNull();expect(task.dueDate?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(localToUtc("2026-11-03T09:00","Asia/Qyzylorda")).toBe("2026-11-03T04:00:00.000Z");
    expect(schoolDate(new Date("2026-10-31T20:00:00Z"),"Asia/Qyzylorda")).toBe("2026-11-01");
    await expect(createTask(member,{departmentId:"dept",title:"Некорректный",priority:"LOW",dueAt:"2026-11-03T10:00:00Z",dueDate:"2026-11-03"})).rejects.toThrow();
  });
  it("filters leaderboard by work date, excludes pending and reversed credits",async()=>{
    const report=await reportFor();
    await decideReport(minister,{id:report.id,action:"APPROVE"});
    await reportFor(member,60);
    const include=await getWorkspace(minister,"dept",new URLSearchParams({period:"custom",from:performedOn,to:performedOn}));
    expect(include.leaderboard[0].points).toBe("15");expect(include.leaderboard[0].reportCount).toBe(1);
    const exclude=await getWorkspace(minister,"dept",new URLSearchParams({period:"custom",from:"2020-01-01",to:"2020-01-31"}));
    expect(exclude.leaderboard).toHaveLength(0);
    await decideReport(minister,{id:report.id,action:"REVERSE",reason:"Пересчёт"});
    expect((await getWorkspace(minister,"dept")).leaderboard).toHaveLength(0);
  });
  it("does not reveal other authors' reports to ordinary members",async()=>{
    await reportFor(minister);
    await reportFor(member);
    const workspace=await getWorkspace(member,"dept");
    expect(workspace.reports).toHaveLength(1);expect(workspace.reports[0].userId).toBe(member.id);
    expect(workspace.audits).toHaveLength(0);expect(workspace.schoolUsers).toHaveLength(0);
  });
  it("rejects invalid duration, unsafe links and unprivileged object operations",async()=>{
    await expect(reportFor(member,0)).rejects.toThrow();
    const task=await taskFor();
    await expect(saveReport(member,{taskId:task.id,summary:"Текст",performedOn,claimedMinutes:30,evidenceUrl:"javascript:alert(1)",submit:true})).rejects.toThrow();
    await expect(commentTask(candidate,{taskId:task.id,text:"Нет доступа"})).rejects.toThrow();
    await expect(updateRate(member,{departmentId:"dept",rate:100,reason:"Нет доступа"})).rejects.toThrow();
  });
  it("calculates configurable quarters/year and rejects overlapping school terms",async()=>{
    const school=await db.school.findUniqueOrThrow({where:{id:"test-school"}});
    expect(periodBounds("year",school,new Date("2026-01-12T10:00:00Z"))).toEqual({from:"2025-09-01",to:"2026-08-31"});
    expect(periodBounds("quarter",school,new Date("2026-10-20T10:00:00Z"))).toEqual({from:"2026-09-01",to:"2026-10-31"});
    await expect(updateSchool(admin,{name:school.name,logoUrl:school.logoUrl,navy:school.navy,accent:school.accent,cream:school.cream,timezone:school.timezone,dailyLimit:school.dailyLimit,academicStart:school.academicStart,terms:[["01-01","12-31"],["01-01","12-31"],["01-01","12-31"],["01-01","12-31"]]})).rejects.toThrow("пересечений");
  });
});
