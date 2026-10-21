import { NextRequest, NextResponse } from "next/server";
import { Prisma, type User } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { DomainError, isAllowedOrigin, serialize } from "@/lib/policy";
import { db } from "@/lib/db";
import { getWorkspace } from "@/server/queries";
import { apply, decideApplication } from "@/server/applications";
import { saveReport, decideReport } from "@/server/reports";
import { createTask, updateTask, commentTask, createEvent, updateEvent } from "@/server/work";
import { readChat, sendMessage, editMessage, markChannelRead } from "@/server/chat";
import { saveProfile, updateMembership, updateGlobalRole, createDepartment, updateRate, updateSchool } from "@/server/admin";
import { setPassword } from "@/server/accounts";
export const dynamic = "force-dynamic";
function failure(e: unknown) {
  if (e instanceof SyntaxError) return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "Такая запись уже существует. Обновите страницу." }, { status: 409 });
  // Never emit request bodies, database details, OAuth tokens, or profiles.
  return NextResponse.json({ error: "Не удалось выполнить запрос. Проверьте соединение и попробуйте ещё раз." }, { status: 500 });
}
export async function GET(req: NextRequest) {
  try {
    const actor = await requireUser();
    const params = req.nextUrl.searchParams;
    const data = params.get("resource") === "chat" ? await readChat(actor, params) : await getWorkspace(actor, params.get("department") || undefined, params);
    return NextResponse.json(serialize(data), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return failure(e); }
}
export async function POST(req: NextRequest) {
  try {
    if (!isAllowedOrigin(req)) throw new DomainError("Недопустимый источник запроса.", 403);
    if (!req.headers.get("content-type")?.startsWith("application/json")) throw new DomainError("Ожидается JSON.", 415);
    if (Number(req.headers.get("content-length") || "0") > 64000) throw new DomainError("Запрос слишком большой.", 413);
    const raw = await req.text();
    if (raw.length > 64000) throw new DomainError("Запрос слишком большой.", 413);
    const { action, data } = z.object({ action: z.string(), data: z.unknown() }).strict().parse(JSON.parse(raw));
    const actor = await requireUser();
    const actions: Record<string, (actor: User, data: unknown) => Promise<unknown>> = {
      apply, decideApplication, saveReport, decideReport, createTask, updateTask, commentTask, createEvent, updateEvent,
      sendMessage, editMessage, markChannelRead, saveProfile, updateMembership, updateGlobalRole, createDepartment, updateRate, updateSchool, setPassword,
      async readNotifications(user, value) {
        const input = z.object({ id: z.string().optional() }).strict().parse(value);
        return db.notification.updateMany({ where: { userId: user.id, ...(input.id ? { id: input.id } : {}) }, data: { readAt: new Date() } });
      }
    };
    if (!Object.hasOwn(actions, action)) throw new DomainError("Неизвестное действие.", 404);
    const result = await actions[action](actor, data);
    return NextResponse.json({ ok: true, data: serialize(result) });
  } catch (e) { return failure(e); }
}
