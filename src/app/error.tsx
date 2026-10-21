"use client";
import Link from "next/link";
export default function ErrorPage({error,reset}:{error:Error;reset:()=>void}){
  return <main id="main" className="standalone-message">
    <img src="/logo.png" alt="Student Council"/>
    <h1>Не удалось загрузить пространство</h1>
    <p>Проверьте подключение к базе данных и повторите попытку. Если ошибка сохраняется, обратитесь к администратору школы.</p>
    {error?.message && <code style={{background:"#f1f5f9",padding:"8px 12px",borderRadius:"6px",color:"#b91c1c",maxWidth:"90%",wordBreak:"break-all"}}>{error.message}</code>}
    <button className="button button-primary" onClick={reset}>Повторить</button>
    <Link href="/">На главную</Link>
  </main>;
}
