"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { X, ArrowUpRight, Inbox, Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
export const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));
const button = cva("button", { variants: { variant: { primary: "button-primary", outline: "button-outline", ghost: "button-ghost", danger: "button-danger" } }, defaultVariants: { variant: "primary" } });
export function Button({ asChild, variant, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; variant?: "primary"|"outline"|"ghost"|"danger" }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(button({ variant }), className)} {...props}/>;
}
export function Modal({ title, description, open, onClose, children }: { title: string; description?: string; open: boolean; onClose: () => void; children: ReactNode }) {
  return <Dialog.Root open={open} onOpenChange={v => !v && onClose()}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className="modal-content">
    <div className="modal-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description || "Данные сохраняются в рабочем пространстве департамента."}</Dialog.Description></div><Dialog.Close className="icon-button" aria-label="Закрыть"><X size={20}/></Dialog.Close></div>{children}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Badge({ children, tone = "" }: { children: ReactNode; tone?: string }) { return <span className={cn("badge", tone)}>{children}</span>; }
export const statuses: Record<string,string> = { TODO:"К выполнению", IN_PROGRESS:"В работе", SUBMITTED:"На проверке", COMPLETED:"Завершено", CANCELLED:"Отменено", DRAFT:"Черновик", PROPOSED:"Предложено", CONFIRMED:"Подтверждено", PENDING:"На проверке", CHANGES_REQUESTED:"Доработка", APPROVED:"Подтверждено", REJECTED:"Отклонено", WITHDRAWN:"Отозвано", ACTIVE:"Активен", SUSPENDED:"Приостановлен", REVOKED:"Отозван", MEMBER:"Участник", MINISTER:"Министр", VICE_MINISTER:"Вице-министр", SCHOOL_ADMIN:"Администратор", PRESIDENT:"Президент", VICE_PRESIDENT:"Вице-президент", STUDENT:"Ученик", LOW:"Низкий", MEDIUM:"Средний", HIGH:"Высокий" };
export function Status({ value }: { value: string }) { return <Badge tone={["APPROVED","COMPLETED","ACTIVE","CONFIRMED"].includes(value) ? "green" : ["REJECTED","CANCELLED","HIGH","REVOKED"].includes(value) ? "red" : ["IN_PROGRESS","PENDING","SUBMITTED","PROPOSED"].includes(value) ? "blue" : "neutral"}>{statuses[value] ?? value}</Badge>; }
export function Avatar({ name, image, small = false }: { name: string | null; image?: string | null; small?: boolean }) {
  return <span className={cn("avatar", small && "small")}>{image ? <img src={image} alt="" referrerPolicy="no-referrer"/> : (name?.replace("Демо · ", "").slice(0,2) || "SC").toUpperCase()}</span>;
}
export function Empty({ title = "Здесь пока пусто", children }: { title?: string; children?: ReactNode }) { return <div className="empty"><Inbox size={30}/><h3>{title}</h3><p>{children || "Новые записи появятся здесь, когда команда начнёт работу."}</p></div>; }
export function Panel({ title, subtitle, action, children, className }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) { return <section className={cn("panel", className)}>{title && <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>}{children}</section>; }
export function SectionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="text-link" onClick={onClick}>{children}<ArrowUpRight size={15}/></button>; }
export function PendingButton({ pending, children }: { pending: boolean; children: ReactNode }) { return <Button type="submit" disabled={pending}>{pending && <Loader2 size={16} className="spin"/>}{pending ? "Сохраняем…" : children}</Button>; }
