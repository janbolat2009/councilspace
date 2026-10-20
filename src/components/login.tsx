"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "./ui";
export function Login({google,local,error}:{google:boolean;local:boolean;error?:string}) {
  const [pending,setPending]=useState(false),[message,setMessage]=useState(error?"Не удалось войти. Проверьте разрешённый Google-аккаунт и попробуйте ещё раз.":"");
  async function login(provider:string,email?:string){setPending(true);setMessage("");try{await signIn(provider,{callbackUrl:"/workspace",...(email?{email}:{})});}catch{setMessage("Вход сейчас недоступен. Попробуйте ещё раз.");setPending(false);}}
  return <div className="login-form"><span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</span><h1>Твоё место<br/>в общей истории.</h1><p>Войди в Council Space, чтобы присоединиться к команде и воплощать идеи вместе.</p><Button disabled={!google||pending} onClick={()=>login("google")}>{pending?<Loader2 size={18} className="spin"/>:<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.4 3-7.5ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22ZM6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14ZM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10A6 6 0 0 1 12 5.9Z"/></svg>}Войти через Google<ArrowRight size={17}/></Button>{!google&&<p className="info-note">Google-вход ещё не настроен. Администратору нужно добавить OAuth Client ID и Client Secret.</p>}{message&&<p role="alert" className="form-error">{message}</p>}<div className="login-note"><ShieldCheck size={19}/><span>Доступ к команде — после одобрения заявки.<br/>Личные данные доступны только уполномоченным участникам.</span></div>
    {local&&<details className="dev-login"><summary>Локальные тестовые профили</summary><p>Только для разработки на этом компьютере. В production эти способы входа отсутствуют.</p>{[["admin","Администратор"],["minister","Министр"],["member","Участник"],["candidate","Кандидат"]].map(([email,label])=><Button key={email} variant="outline" disabled={pending} onClick={()=>login("demo",`${email}@demo.invalid`)}>{label}</Button>)}</details>}
  </div>;
}
