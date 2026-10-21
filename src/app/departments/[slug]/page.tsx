import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BookOpen, Lightbulb, Users } from "lucide-react";
import { publicData } from "@/server/queries";
export const dynamic="force-dynamic";
export default async function Department({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params,data=await publicData(),dept=data?.departments.find(d=>d.slug===slug);
  if(!dept)notFound();
  return <main id="main" className="department-public"><Link className="back-link" href="/">← На главную Student Council</Link><img src={data?.school.logoUrl||"/logo.png"} alt="Логотип совета"/><span className="eyebrow">ДЕПАРТАМЕНТ STUDENT COUNCIL</span><h1>{dept.name}</h1><p className="department-description">{dept.description}</p><p>Министр: <strong>{dept.ministerName||"Позиция открыта"}</strong></p><div className="department-directions">{[{title:"Интеллектуальные игры",icon:BookOpen,text:"Вопросы, турниры и командные открытия."},{title:"Наука и исследования",icon:Lightbulb,text:"Science Fair, проекты и обмен идеями."},{title:"Сообщество",icon:Users,text:"Встречи, кейс-чемпионаты и работа вместе."}].map(d=><article key={d.title}><d.icon size={28}/><h2>{d.title}</h2><p>{d.text}</p></article>)}</div><div className="row wrap" style={{justifyContent:"center",gap:"12px"}}><Link className="button button-primary" href="/register">Зарегистрироваться и подать заявку <ArrowUpRight size={17}/></Link><Link className="button button-outline" href="/login">Уже есть аккаунт? Войти</Link></div><p className="muted">После регистрации заполните профиль и заявку. Решение появится в личном кабинете.</p></main>;
}
