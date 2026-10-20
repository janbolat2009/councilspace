import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { access, audit, DomainError, transaction } from "@/lib/policy";
import { id, text, optionalText } from "@/lib/validation";
export async function readChat(actor: User, params: URLSearchParams) {
  const channelId = id.parse(params.get("channel"));
  const sequence = z.string().regex(/^\d{1,19}$/).optional();
  const after = sequence.parse(params.get("after") ?? undefined);
  const before = sequence.parse(params.get("before") ?? undefined);
  const since = z.iso.datetime({ offset: true }).optional().parse(params.get("since") ?? undefined);
  const watermark = new Date().toISOString();
  const channel = await db.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new DomainError("Канал не найден.", 404);
  await access(db, actor, channel.departmentId);
  const messages = await db.message.findMany({ where: { channelId, ...(after ? { sequence: { gt: BigInt(after) } } : before ? { sequence: { lt: BigInt(before) } } : {}) }, orderBy: { sequence: after ? "asc" : "desc" }, take: 50,
    include: { user: { select: { id: true, name: true, image: true } }, replyTo: { select: { id: true, text: true, deletedAt: true, user: { select: { name: true } } } } }
  });
  const changes = since && after ? await db.message.findMany({
    where: { channelId, sequence: { lte: BigInt(after) }, OR: [{ editedAt: { gte: new Date(since) } }, { deletedAt: { gte: new Date(since) } }] },
    include: { user: { select: { id: true, name: true, image: true } }, replyTo: { select: { id: true, text: true, deletedAt: true, user: { select: { name: true } } } } }
  }) : [];
  return { messages: after ? messages : messages.reverse(), changes, watermark, hasMore: messages.length === 50 };
}
export async function sendMessage(actor: User, input: unknown) {
  const data = z.object({ channelId: id, text: text(3000), replyToId: id.nullable().default(null) }).strict().parse(input);
  return transaction(async tx => {
    const channel = await tx.channel.findUnique({ where: { id: data.channelId } });
    if (!channel) throw new DomainError("Канал не найден.", 404);
    const { manager } = await access(tx, actor, channel.departmentId);
    if (channel.announcements && !manager) throw new DomainError("В объявлениях публикует руководство.", 403);
    // Serialize creation per channel: a later visible sequence cannot overtake an uncommitted one.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`channel:${channel.id}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.id}))`;
    const recent = await tx.message.count({ where: { userId: actor.id, createdAt: { gt: new Date(Date.now() - 60000) } } });
    if (recent >= 20) throw new DomainError("Не больше 20 сообщений в минуту. Попробуйте чуть позже.", 429);
    if (data.replyToId && !await tx.message.findFirst({ where: { id: data.replyToId, channelId: data.channelId, deletedAt: null } })) throw new DomainError("Сообщение для ответа недоступно.");
    return tx.message.create({ data: { ...data, userId: actor.id } });
  });
}
export async function editMessage(actor: User, input: unknown) {
  const data = z.object({ id, text: optionalText(3000), remove: z.boolean().default(false), reason: optionalText(1500) }).strict().parse(input);
  return transaction(async tx => {
    const message = await tx.message.findUnique({ where: { id: data.id }, include: { channel: true } });
    if (!message || message.deletedAt) throw new DomainError("Сообщение недоступно.", 404);
    const { manager } = await access(tx, actor, message.channel.departmentId);
    if (message.userId !== actor.id && !(manager && data.remove)) throw new DomainError("Можно редактировать только свои сообщения.", 403);
    if (message.channel.announcements && !manager) throw new DomainError("Изменять объявления может руководство.", 403);
    if (!data.remove && !data.text) throw new DomainError("Сообщение не может быть пустым.");
    if (data.remove && message.userId !== actor.id) {
      if (!data.reason) throw new DomainError("Укажите причину модераторского удаления.");
      await audit(tx, actor.id, message.channel.departmentId, "MESSAGE_REMOVED", message.id, data.reason);
    }
    return tx.message.update({ where: { id: message.id }, data: data.remove ? { text: "", deletedAt: new Date() } : { text: data.text, editedAt: new Date() } });
  });
}
export async function markChannelRead(actor: User, input: unknown) {
  const data = z.object({ channelId: id, sequence: z.string().regex(/^\d{1,19}$/) }).strict().parse(input);
  return transaction(async tx => {
    const channel = await tx.channel.findUnique({ where: { id: data.channelId } });
    if (!channel) throw new DomainError("Канал не найден.", 404);
    await access(tx, actor, channel.departmentId);
    const latest = await tx.message.findFirst({ where: { channelId: channel.id }, orderBy: { sequence: "desc" } });
    const seq = BigInt(data.sequence);
    if (seq > (latest?.sequence ?? 0n)) throw new DomainError("Некорректная отметка прочтения.");
    const previous = await tx.channelRead.findUnique({ where: { userId_channelId: { userId: actor.id, channelId: channel.id } } });
    if ((previous?.lastSequence ?? 0n) >= seq) return previous;
    return tx.channelRead.upsert({ where: { userId_channelId: { userId: actor.id, channelId: channel.id } }, create: { userId: actor.id, channelId: channel.id, lastSequence: seq }, update: { lastSequence: seq } });
  });
}
