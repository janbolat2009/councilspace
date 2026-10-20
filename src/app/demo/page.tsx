import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/server/queries";
import { Workspace } from "@/components/workspace";
export const dynamic="force-dynamic";
export default async function DemoPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  if(process.env.ENABLE_DEMO!=="true")notFound();
  const user=await db.user.findUnique({where:{id:"demo-minister"}});
  if(!user||!user.isDemo||user.schoolId!=="demo-school")notFound();
  const params=await searchParams;
  const data=await getWorkspace(user,undefined,new URLSearchParams(Object.entries(params).filter((p):p is [string,string]=>typeof p[1]==="string")));
  return <Workspace initialData={data} view={params.view||"overview"} demo/>;
}
