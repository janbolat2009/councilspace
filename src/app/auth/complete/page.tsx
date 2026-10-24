import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { isGlobalManager } from "@/lib/policy";
export const dynamic = "force-dynamic";
export default async function AuthComplete({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?error=SessionExpired");
  if (isGlobalManager(user.globalRole)) {
    redirect("/workspace");
  }
  const { mode } = await searchParams;
  redirect(!user.onboarded || !user.classroom.trim() || mode === "register" ? "/onboarding" : "/workspace");
}
