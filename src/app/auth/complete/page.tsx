import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function AuthComplete({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?error=SessionExpired");
  if (user.globalRole === "SCHOOL_ADMIN") {
    redirect("/workspace");
  }
  const { mode } = await searchParams;
  redirect(!user.onboarded || !user.classroom.trim() || mode === "register" ? "/onboarding" : "/workspace");
}
