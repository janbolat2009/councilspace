"use client";
import dynamic from "next/dynamic";
import type { WorkspaceData } from "@/server/queries";

const Workspace = dynamic(
  () => import("@/components/workspace").then((mod) => mod.Workspace),
  {
    ssr: false,
    loading: () => (
      <main id="main" className="loading-screen">
        <img src="/logo.png" alt="Student Council" />
        <p>Открываем рабочее пространство…</p>
        <div className="loading-line" />
      </main>
    ),
  }
);

export function WorkspaceClient({
  initialData,
  view,
}: {
  initialData: WorkspaceData;
  view: string;
}) {
  return <Workspace initialData={initialData} view={view} />;
}
