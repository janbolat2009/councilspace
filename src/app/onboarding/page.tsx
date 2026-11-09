import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ensureSchoolDepartments } from "@/server/accounts";
import { Onboarding } from "@/components/onboarding";
export const dynamic = "force-dynamic";
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ department?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?error=SessionRequired");
  const departments = await ensureSchoolDepartments(user.schoolId);
  const { department } = await searchParams;
  const available = user.registrationDepartmentId ? departments.filter(d => d.id === user.registrationDepartmentId) : departments;
  return <Onboarding user={{ name: user.name || "", classroom: user.classroom, interests: user.interests, image: user.image || "", onboarded: user.onboarded }} departments={available} initialDepartmentId={user.registrationDepartmentId || available.find(d => d.slug === department)?.id || ""} locked={!!user.registrationDepartmentId}/>;
}
