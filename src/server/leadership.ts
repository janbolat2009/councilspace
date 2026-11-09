import { z } from "zod";
import { DEPARTMENTS } from "@/lib/departments";
import { audit, DomainError, transaction } from "@/lib/policy";
import { emailSchema } from "./accounts";

const configuration = z.record(
  z.string().refine(slug => DEPARTMENTS.some(d => d.slug === slug), "Неизвестный департамент."),
  z.object({ ministers: z.array(emailSchema), viceMinisters: z.array(emailSchema) }).strict()
);

// Operator-only command. Never imported by a route or invoked during registration/login.
export async function syncLeadership(input: unknown, apply = false, schoolId = process.env.COUNCIL_SCHOOL_ID || "school") {
  const config = configuration.parse(input);
  return transaction(async tx => {
    const plan: { userId: string; email: string; departmentId: string; department: string; role: "MINISTER" | "VICE_MINISTER" }[] = [];
    for (const [slug, entries] of Object.entries(config)) {
      const department = await tx.department.findUnique({ where: { schoolId_slug: { schoolId, slug } } });
      if (!department) throw new DomainError(`Сначала примените миграции и seed: ${slug}.`);
      const seen = new Set<string>();
      for (const [role, emails] of [["MINISTER", entries.ministers], ["VICE_MINISTER", entries.viceMinisters]] as const) {
        for (const email of emails) {
          if (seen.has(email)) throw new DomainError(`Email указан дважды в ${slug}: ${email}.`);
          seen.add(email);
          const user = await tx.user.findFirst({ where: { schoolId, email: { equals: email, mode: "insensitive" }, isDemo: false }, include: { accounts: { select: { provider: true } } } });
          if (!user || !user.accounts.some(a => a.provider === "google")) throw new DomainError(`Сначала нужен подтверждённый вход через Google: ${email}. Для парольного аккаунта подключите Google в профиле или назначьте роль через администратора.`);
          if (user.registrationDepartmentId && user.registrationDepartmentId !== department.id) throw new DomainError(`У ${email} выбран другой департамент. Перевод должен выполнить администратор.`);
          plan.push({ userId: user.id, email, departmentId: department.id, department: department.name, role });
        }
      }
    }
    if (apply) for (const assignment of plan) {
      const previous = await tx.membership.findUnique({ where: { userId_departmentId: { userId: assignment.userId, departmentId: assignment.departmentId } } });
      if (previous?.role === assignment.role && previous.status === "ACTIVE") continue;
      await tx.membership.upsert({
        where: { userId_departmentId: { userId: assignment.userId, departmentId: assignment.departmentId } },
        create: { userId: assignment.userId, departmentId: assignment.departmentId, role: assignment.role },
        update: { role: assignment.role, status: "ACTIVE" }
      });
      await tx.user.updateMany({ where: { id: assignment.userId, registrationDepartmentId: null }, data: { registrationDepartmentId: assignment.departmentId } });
      await audit(tx, assignment.userId, assignment.departmentId, "LEADERSHIP_CONFIG_ASSIGNED", assignment.userId, `Operator CLI: ${previous?.role || "no membership"} -> ${assignment.role}`);
    }
    return plan;
  });
}

