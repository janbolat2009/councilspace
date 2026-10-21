import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ensureSchoolDepartments } from "@/server/accounts";
import { Onboarding } from "@/components/onboarding";
export const dynamic = "force-dynamic";
export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/login?error=SessionRequired");
  const departments = await ensureSchoolDepartments(user.schoolId);
  return <Onboarding user={{ name: user.name || "", classroom: user.classroom, interests: user.interests, image: user.image || "", onboarded: user.onboarded }} departments={departments}/>;
}
