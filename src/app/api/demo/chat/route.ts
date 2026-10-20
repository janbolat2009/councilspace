import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readChat } from "@/server/chat";
import { serialize, DomainError } from "@/lib/policy";
export async function GET(req: NextRequest) {
  if (process.env.ENABLE_DEMO !== "true") return new NextResponse(null,{status:404});
  try {
    const user=await db.user.findUniqueOrThrow({where:{id:"demo-minister"}});
    if(!user.isDemo||user.schoolId!=="demo-school")return new NextResponse(null,{status:404});
    return NextResponse.json(serialize(await readChat(user,req.nextUrl.searchParams)),{headers:{"Cache-Control":"no-store"}});
  } catch(e) {return NextResponse.json({error:e instanceof DomainError?e.message:"Демо-чат недоступен."},{status:e instanceof DomainError?e.status:400});}
}
