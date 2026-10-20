"use client";
import { useState, type ReactNode } from "react";
import { Button, PendingButton } from "./ui";
export type Field = { name: string; label: string; type?: string; required?: boolean; placeholder?: string; options?: { value: string; label: string }[]; value?: string | number; help?: string; min?: number; max?: number; step?: number };
export function Form({ fields, onSubmit, submitLabel = "Сохранить", children, columns = false }: {
  fields: Field[]; onSubmit: (values: Record<string, string>) => Promise<void>; submitLabel?: string; children?: ReactNode; columns?: boolean;
}) {
  const [pending, setPending] = useState(false), [error,setError] = useState("");
  return <form onSubmit={async e => { e.preventDefault(); if (pending) return; setPending(true); setError(""); const fd = new FormData(e.currentTarget); const values = Object.fromEntries(fd.entries()) as Record<string,string>; for (const f of fields.filter(f=>f.type==="multiple")) values[f.name]=fd.getAll(f.name).join(","); try { await onSubmit(values); } catch(e) { setError(e instanceof Error ? e.message : "Не удалось сохранить."); } finally { setPending(false); } }}>
    <fieldset disabled={pending} className={columns ? "form-fields two-columns" : "form-fields"}>{fields.map(f => <label key={f.name} className={f.type === "textarea" ? "field full" : "field"}><span>{f.label}{f.required && <span className="required"> *</span>}</span>
      {f.options ? <select name={f.name} multiple={f.type==="multiple"} defaultValue={f.type==="multiple"?String(f.value||"").split(","):f.value} required={f.required}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type === "textarea" ? <textarea name={f.name} defaultValue={f.value} required={f.required} placeholder={f.placeholder} rows={3} maxLength={5000}/> : <input name={f.name} type={f.type || "text"} defaultValue={f.value} required={f.required} placeholder={f.placeholder} min={f.min} max={f.max} step={f.step}/>}
      {f.help && <small>{f.help}</small>}</label>)}</fieldset>{children}{error && <p className="form-error" role="alert">{error}</p>}<div className="form-footer"><small>* Обязательные поля</small><PendingButton pending={pending}>{submitLabel}</PendingButton></div>
  </form>;
}
export function ConfirmAction({ label, description, action, danger = false }: { label: string; description: string; action: () => Promise<void>; danger?: boolean }) {
  const [confirm,setConfirm] = useState(false), [pending,setPending] = useState(false), [error,setError] = useState("");
  return <div>{!confirm ? <Button variant={danger ? "danger" : "outline"} onClick={() => setConfirm(true)}>{label}</Button> : <div className="confirm-box"><p>{description}</p><div className="row"><Button variant={danger ? "danger" : "primary"} disabled={pending} onClick={async () => { setPending(true); try { await action(); setConfirm(false); } catch(e) { setError((e as Error).message); } finally { setPending(false); } }}>Подтвердить</Button><Button variant="ghost" onClick={() => setConfirm(false)}>Отмена</Button></div>{error && <p role="alert" className="form-error">{error}</p>}</div>}</div>;
}
