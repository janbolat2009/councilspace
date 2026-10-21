import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getWorkspace } from "@/server/queries";
import { Workspace } from "@/components/workspace";
import { DomainError } from "@/lib/policy";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  let user;
  try {
    user = await currentUser();
  } catch (err) {
    console.error("WorkspacePage currentUser error:", err);
  }
  if (!user) redirect("/login");

  const params = await searchParams;
  try {
    const result = await getWorkspace(
      user,
      params.department,
      new URLSearchParams(Object.entries(params).filter((p): p is [string, string] => typeof p[1] === "string"))
    );
    return <Workspace initialData={result} view={params.view || (!user.onboarded ? "profile" : "overview")} />;
  } catch (e: unknown) {
    if (e instanceof DomainError) {
      return (
        <main id="main" className="standalone-message">
          <img src="/logo.png" alt="Student Council" />
          <h1>Доступ изменился</h1>
          <p>{e.message}</p>
          <Link className="button button-primary" href="/workspace">Открыть доступное пространство</Link>
        </main>
      );
    }
    console.error("WorkspacePage getWorkspace error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return (
      <main id="main" className="standalone-message">
        <img src="/logo.png" alt="Student Council" />
        <h1>Не удалось загрузить пространство</h1>
        <p>Произошла ошибка при загрузке данных: {errorMessage}</p>
        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          <Link className="button button-primary" href="/workspace">Повторить попытку</Link>
          <Link className="button button-outline" href="/">На главную</Link>
        </div>
      </main>
    );
  }
}
