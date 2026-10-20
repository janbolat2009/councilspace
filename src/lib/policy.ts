import { Prisma, type User } from "@prisma/client";
import { db } from "./db";
export class DomainError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type Tx = Prisma.TransactionClient;
export const isGlobalManager = (role: string) => ["SCHOOL_ADMIN", "PRESIDENT", "VICE_PRESIDENT"].includes(role);
export async function access(tx: Tx, actor: User, departmentId: string, management = false) {
  const [department, fresh] = await Promise.all([
    tx.department.findUnique({ where: { id: departmentId } }),
    tx.user.findUnique({ where: { id: actor.id } })
  ]);
  if (!department || !fresh || fresh.schoolId !== department.schoolId) throw new DomainError("Нет доступа к департаменту.", 403);
  const member = await tx.membership.findUnique({ where: { userId_departmentId: { userId: actor.id, departmentId } } });
  const manager = isGlobalManager(fresh.globalRole) || (member?.status === "ACTIVE" && member.role !== "MEMBER");
  if (!manager && (management || member?.status !== "ACTIVE")) throw new DomainError("Нет доступа к этому действию.", 403);
  return { department, manager, member, user: fresh };
}
export async function admin(tx: Tx, actor: User) {
  const fresh = await tx.user.findUnique({ where: { id: actor.id } });
  if (!fresh || fresh.globalRole !== "SCHOOL_ADMIN") throw new DomainError("Действие доступно администратору школы.", 403);
  return fresh;
}
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }); }
    catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(e.code) && attempt < 4) continue;
      throw e;
    }
  }
  throw new DomainError("Повторите запрос.", 409);
}
export async function audit(tx: Tx, actorId: string, departmentId: string | null, action: string, objectId: string, reason: string) {
  await tx.auditLog.create({ data: { actorId, departmentId, action, objectId, reason } });
}
export async function notify(tx: Tx, userIds: string[], title: string, href: string) {
  if (userIds.length) await tx.notification.createMany({ data: [...new Set(userIds)].map(userId => ({ userId, title, href })) });
}
export async function managers(tx: Tx, departmentId: string) {
  const dept = await tx.department.findUniqueOrThrow({ where: { id: departmentId } });
  const users = await tx.user.findMany({ where: {
    schoolId: dept.schoolId,
    OR: [{ globalRole: { in: ["SCHOOL_ADMIN", "PRESIDENT", "VICE_PRESIDENT"] } }, {
      memberships: { some: { departmentId, status: "ACTIVE", role: { in: ["MINISTER", "VICE_MINISTER"] } } }
    }]
  }, select: { id: true } });
  return users.map(u => u.id);
}
export type Serialized<T> = T extends Date | bigint | Prisma.Decimal ? string : T extends Array<infer U> ? Serialized<U>[] : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T;
export function serialize<T>(value: T): Serialized<T> {
  return JSON.parse(JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v)) as Serialized<T>;
}
