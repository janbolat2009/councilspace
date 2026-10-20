import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BookOpen, Lightbulb, Users } from "lucide-react";
import { publicData } from "@/server/queries";
export const dynamic="force-dynamic";
export default async function Department({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params,data=await publicData(),dept=data?.departments.find(d=>d.slug===slug);
  if(!dept)notFound();
  return <main id="main" className="department-public"><Link className="back-link" href="/">← Student Council</Link><img src={data?.school.logoUrl||"/logo.png"} alt="Логотип совета"/><span className="eyebrow">ДЕПАРТАМЕНТ STUDENT COUNCIL</span><h1>{dept.name}</h1><p className="department-description">{dept.description}</p><p>Министр: <strong>{dept.ministerName||"Позиция не заполнена"}</strong></p><div className="department-directions">{[{title:"Интеллектуальные игры",icon:BookOpen,text:"Вопросы, турниры и командные открытия."},{title:"Наука и исследования",icon:Lightbulb,text:"Science Fair, проекты и обмен идеями."},{title:"Сообщество",icon:Users,text:"Встречи, кейс-чемпионаты и работа вместе."}].map(d=><article key={d.title}><d.icon size={26}/><h2>{d.title}</h2><p>{d.text}</p></article>)}</div><Link className="button button-primary" href="/login">Подать заявку в команду <ArrowUpRight size={17}/></Link><p className="muted">После входа заполните профиль и заявку. Решение появится в личном кабинете.</p></main>;
}
