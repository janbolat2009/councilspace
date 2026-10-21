import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getWorkspace } from "@/server/queries";
import { Workspace } from "@/components/workspace";
import { DomainError } from "@/lib/policy";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function WorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect("/login?error=SessionRequired");
  if (!user.onboarded) redirect("/onboarding");
  const params = await searchParams;
  const result = await getWorkspace(user, params.department, new URLSearchParams(Object.entries(params).filter((p): p is [string, string] => typeof p[1] === "string"))).catch((e: unknown) => { if (e instanceof DomainError) return e; throw e; });
  if (result instanceof DomainError) return <main id="main" className="standalone-message"><img src="/logo.png" alt="Student Council"/><h1>Доступ изменился</h1><p>{result.message}</p><Link className="button button-primary" href="/workspace">Открыть доступное пространство</Link></main>;
  return <Workspace initialData={result} view={params.view || "overview"}/>;
}
