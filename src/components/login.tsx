"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Loader2, Eye, EyeOff, Mail, UserPlus, LogIn } from "lucide-react";
import { Button } from "./ui";
export const authErrors: Record<string, string> = {
  AccessDenied: "Не удалось разрешить вход. Используйте подтверждённый Google-аккаунт школы.",
  SchoolDomain: "Для Google-входа нужен аккаунт разрешённого школьного домена.",
  UnverifiedGoogleEmail: "Сначала подтвердите адрес почты в Google.",
  Configuration: "Сервис входа пока не настроен. Обратитесь к администратору.",
  OAuthSignin: "Не удалось открыть Google. Попробуйте ещё раз или зарегистрируйтесь вручную по Email.",
  OAuthCallback: "Не удалось завершить Google-вход. Откройте сайт по основному адресу или войдите по Email.",
  OAuthCreateAccount: "Не удалось создать профиль через Google. Попробуйте ещё раз или зарегистрируйтесь вручную.",
  Callback: "Не удалось завершить вход. Попробуйте ещё раз.",
  OAuthAccountNotLinked: "Этот email уже зарегистрирован с паролем. Войдите по Email и паролю ниже, затем при желании подключите Google в профиле.",
  CredentialsSignin: "Неверный email или пароль. Проверьте данные или создайте новый аккаунт.",
  TooManyAttempts: "Слишком много попыток. Пожалуйста, подождите 15 минут.",
  ServiceUnavailable: "Сервис входа временно недоступен. Попробуйте ещё раз через пару секунд.",
  SessionExpired: "Сессия устарела. Войдите ещё раз, чтобы продолжить.",
  SessionRequired: "Войдите или зарегистрируйтесь, чтобы открыть рабочее пространство."
};
function GoogleIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.45-.19-2.18H12v4.13h5.4a4.63 4.63 0 0 1-2 3.04v2.52h3.22c1.89-1.74 2.98-4.3 2.98-7.51Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.22-2.5c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.07v2.58A9.99 9.99 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.9a6.02 6.02 0 0 1 0-3.8V7.52H3.07a10 10 0 0 0 0 8.96l3.32-2.58Z"/><path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.99 14.7 2 12 2A9.99 9.99 0 0 0 3.07 7.52l3.32 2.58C7.18 7.73 9.39 5.97 12 5.97Z"/></svg>;
}
export function Login({ google, local, error, mode = "login" }: { google: boolean; local: boolean; error?: string; mode?: "login" | "register" }) {
  const registering = mode === "register";
  const router = useRouter();
  const [pending, setPending] = useState(false), [message, setMessage] = useState(""), [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname === "127.0.0.1") {
      window.location.replace(window.location.href.replace("://127.0.0.1", "://localhost"));
      return;
    }
    setMessage(error ? authErrors[error] || "Не удалось войти. Попробуйте ещё раз." : "");
    setPending(false);
  }, [error, mode]);
  async function googleLogin() {
    setPending(true); setMessage("");
    try {
      await signIn("google", { callbackUrl: registering ? "/auth/complete?mode=register" : "/auth/complete" });
    } catch {
      setMessage(authErrors.ServiceUnavailable);
      setPending(false);
    }
  }
  async function emailLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (pending) return;
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setPending(true); setMessage("");
    try {
      if (registering) {
        const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
      }
      const nextUrl = registering ? "/onboarding" : "/auth/complete";
      const result = await signIn("password", { email: values.email, password: values.password, callbackUrl: nextUrl, redirect: false });
      if (!result?.ok || result.error) throw new Error((result?.error && authErrors[result.error]) || authErrors.CredentialsSignin);
      router.replace(nextUrl);
      router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : authErrors.ServiceUnavailable); setPending(false); }
  }
  return <div className="login-form auth-form">
    <div className="auth-tabs" aria-label="Выбор режима: вход или регистрация">
      <Link href="/login" aria-current={!registering ? "page" : undefined}><LogIn size={17}/>Вход</Link>
      <Link href="/register" aria-current={registering ? "page" : undefined}><UserPlus size={17}/>Регистрация</Link>
    </div>
    <h1>{registering ? "Создать аккаунт" : "Войти в аккаунт"}</h1>
    <p>{registering ? "Зарегистрируйтесь вручную по Email и паролю или в один клик через Google — после этого откроется анкета участника." : "Войдите через Google или введите свой Email и пароль."}</p>
    <Button variant="outline" className="google-button" disabled={!google || pending} onClick={googleLogin}>
      <GoogleIcon/>
      <span>{registering ? "Зарегистрироваться через Google" : "Продолжить через Google"}</span>
      <ArrowRight size={20}/>
    </Button>
    {!google && <p className="auth-hint">Вход через Google сейчас не настроен — используйте ручную регистрацию по Email ниже.</p>}
    <div className="auth-divider"><span>{registering ? "или вручную без посредников" : "или по Email и паролю"}</span></div>
    <form onSubmit={emailLogin}>
      <fieldset disabled={pending} className="auth-fields">
        {registering && <label htmlFor="name">Ваше имя и фамилия<input id="name" name="name" autoComplete="name" placeholder="Например, Айсулу Серикова" minLength={2} maxLength={80} required/></label>}
        <label htmlFor="email">Электронная почта (Email)<input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required/></label>
        <label htmlFor="password">{registering ? "Придумайте пароль" : "Ваш пароль"}<div className="password-field"><input id="password" name="password" type={show ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 10 : 1} maxLength={128} placeholder={registering ? "Минимум 10 символов" : "Введите пароль"} required/><button type="button" className="icon-button" aria-label={show ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShow(!show)}>{show ? <EyeOff size={20}/> : <Eye size={20}/>}</button></div></label>
        {registering && <label htmlFor="confirmPassword">Повторите пароль<input id="confirmPassword" name="confirmPassword" type={show ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={128} placeholder="Введите пароль ещё раз" required/></label>}
      </fieldset>
      {message && <div role="alert" className="form-error">{message}</div>}
      <Button type="submit" className="auth-submit" disabled={pending}>{pending ? <><Loader2 size={20} className="spin"/>Подождите…</> : <><Mail size={19}/><span>{registering ? "Зарегистрироваться вручную" : "Войти по Email"}</span><ArrowRight size={20}/></>}</Button>
    </form>
    <p className="auth-switch">{registering ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"} <Link href={registering ? "/login" : "/register"}>{registering ? "Войти" : "Зарегистрироваться"}</Link></p>
    <div className="login-note"><ShieldCheck size={22}/><span>Оба способа (Google и ручная регистрация) ведут к анкете профиля и подаче заявки в выбранный департамент.</span></div>
    {local && <details className="dev-login"><summary>Тестовые профили на этом компьютере</summary><p>Только локальная разработка. Недоступны в production.</p><div className="dev-login-grid">{[["admin", "Администратор"], ["minister", "Министр"], ["member", "Участник"], ["candidate", "Кандидат"]].map(([email, label]) => <Button key={email} variant="outline" disabled={pending} onClick={async () => { setPending(true); const result = await signIn("demo", { email: email + "@demo.invalid", callbackUrl: "/auth/complete", redirect: false }); if (result?.ok) { router.replace("/auth/complete"); router.refresh(); } else { setMessage(authErrors.CredentialsSignin); setPending(false); } }}>{label}</Button>)}</div></details>}
  </div>;
}
