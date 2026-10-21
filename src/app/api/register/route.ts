import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerAccount } from "@/server/accounts";
import { DomainError, isAllowedOrigin } from "@/lib/policy";
export async function POST(req: NextRequest) {
  try {
    if (!isAllowedOrigin(req)) throw new DomainError("Откройте форму на основном адресе сайта.", 403);
    if (!req.headers.get("content-type")?.startsWith("application/json")) throw new DomainError("Ожидается JSON.", 415);
    const raw = await req.text();
    if (raw.length > 8000) throw new DomainError("Запрос слишком большой.", 413);
    const user = await registerAccount(JSON.parse(raw));
    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
  } catch(e) {
    if(e instanceof z.ZodError) return NextResponse.json({error:e.issues[0]?.message || "Проверьте поля."},{status:400});
    if(e instanceof DomainError) return NextResponse.json({error:e.message},{status:e.status});
    if(e instanceof SyntaxError) return NextResponse.json({error:"Некорректный запрос."},{status:400});
    return NextResponse.json({error:"Не удалось создать аккаунт. Попробуйте позже."},{status:503});
  }
}
