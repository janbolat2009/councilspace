"use client";
import Link from "next/link";
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main id="main" className="standalone-message"><img src="/logo.png" alt="Student Council"/><h1>Не удалось загрузить пространство</h1><p>Проверьте подключение к базе данных и повторите попытку. Если ошибка сохраняется, обратитесь к администратору школы.</p><button className="button button-primary" onClick={reset}>Повторить</button><Link href="/">На главную</Link></main>;}
