"use client";
import { createContext, useContext } from "react";
import type { WorkspaceData } from "@/server/queries";
export type ModalState = { type: string; id?: string } | null;
export type WorkspaceContextValue = { data: WorkspaceData; demo: boolean; mutate: (action: string, data: unknown) => Promise<void>; open: (modal: ModalState) => void; navigate: (view: string, extra?: Record<string,string>) => void; search: string };
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace context missing");
  return context;
}
