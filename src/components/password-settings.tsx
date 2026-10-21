"use client";
import { signIn } from "next-auth/react";
import { useWorkspace } from "./workspace-context";
import { Form } from "./forms";
import { Panel, Button, Badge } from "./ui";
export function PasswordSettings() {
  const { data, mutate } = useWorkspace();
  if (data.user.isDemo) return null;
  return <Panel title="Способы входа" subtitle="Google и пароль ведут в один профиль"><div className="padded">
    {data.user.hasGoogle ? <p><Badge tone="green">Google подключён</Badge></p> : data.user.googleAvailable && <Button variant="outline" onClick={() => signIn("google", { callbackUrl: "/auth/complete" })}>Подключить мой Google-аккаунт</Button>}
    <h3 className="password-settings-heading">{data.user.hasPassword ? "Изменить пароль" : "Добавить пароль"}</h3>
    <Form fields={[...(data.user.hasPassword ? [{ name: "currentPassword", label: "Текущий пароль", type: "password", required: true }] : []), { name: "password", label: "Новый пароль", type: "password", required: true, help: "От 10 до 128 символов." }, { name: "confirmPassword", label: "Повторите новый пароль", type: "password", required: true }]} onSubmit={values => mutate("setPassword", values)} submitLabel="Сохранить пароль"/>
  </div></Panel>;
}
