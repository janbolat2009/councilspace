import Link from "next/link";
import { ArrowUpRight, ArrowRight, BookOpen, Lightbulb, Users, CalendarDays, GraduationCap, UserPlus, LogIn, CheckCircle2, Trophy } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { publicData } from "@/server/queries";
import { displayDate } from "@/lib/time";
export const dynamic="force-dynamic";
export default async function Home() {
  const data=await publicData();
  return <div className="public-site">
    <header className="public-header">
      <Link className="brand" href="/"><img src={data?.school.logoUrl||"/logo.png"} alt="Логотип Student Council"/><span>Council<span>Space<span className="brand-dot">.</span></span></span></Link>
      <nav aria-label="Разделы сайта">
        <a href="#steps">Как вступить</a>
        <a href="#departments">Департаменты</a>
        <a href="#team">Руководство</a>
        <a href="#calendar">События</a>
      </nav>
      <div className="public-header-actions">
        <Link className="button button-outline" href="/login"><LogIn size={17}/>Войти</Link>
        <Link className="button button-primary" href="/register"><UserPlus size={17}/><span>Регистрация</span></Link>
      </div>
    </header>
    <main id="main">
      <section className="public-hero">
        <div>
          <span className="eyebrow"><span className="red-dot"/>STUDENT COUNCIL · ОБЩЕЕ ПРОСТРАНСТВО</span>
          <h1>Хорошие идеи<br/>становятся <em>общим<br/>делом.</em></h1>
          <p>Платформа школьного совета, где каждый ученик может внести свой вклад. Зарегистрируйся вручную или через Google, выбери департамент, создавай события и развивай школьную жизнь вместе с нами.</p>
          <div className="public-hero-buttons">
            <Link className="button button-primary" href="/register"><UserPlus size={19}/>Зарегистрироваться <ArrowUpRight size={18}/></Link>
            <Link className="button button-outline" href="/login"><LogIn size={18}/>Войти в аккаунт</Link>
            {data?.hasDemo&&<Link className="button button-ghost" href="/demo">Демо-обзор <ArrowRight size={17}/></Link>}
          </div>
          <div className="hero-footnote"><span className="small-logo"><img src="/logo.png" alt=""/></span><div><strong>Регистрация за 1 минуту — через Google или по Email.</strong><span>Доступ открыт для всех учеников школы.</span></div></div>
        </div>
        <div className="public-hero-art">
          <div className="hero-seal"><img src="/logo.png" alt="Эмблема школьного Student Council"/></div>
          <div className="floating-label one"><BookOpen size={22}/><span>Развиваем<br/><strong>любознательность</strong></span></div>
          <div className="floating-label two"><Lightbulb size={23}/><span>Превращаем идеи<br/><strong>в возможности</strong></span></div>
          <span className="orbital-line"/>
          <span className="art-caption">LEARN · CREATE · CONTRIBUTE</span>
        </div>
      </section>
      <div className="public-values">
        <span><BookOpen size={22}/>Знания, которыми делятся</span>
        <span><Users size={22}/>Команда, которая поддерживает</span>
        <span><Lightbulb size={22}/>Идеи, которые воплощаются</span>
      </div>
      <section className="public-section" id="steps">
        <div className="public-section-heading">
          <div><span className="eyebrow">ПРОСТОЙ И ПОНЯТНЫЙ ПУТЬ</span><h2>Как стать частью команды</h2></div>
          <span>Всего 3 шага</span>
        </div>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">01</span>
            <UserPlus size={26}/>
            <h3>Создай аккаунт</h3>
            <p>Зарегистрируйся прямо на сайте вручную (по Email и паролю) или в один клик через свой Google-аккаунт.</p>
          </article>
          <article className="step-card">
            <span className="step-number">02</span>
            <CheckCircle2 size={26}/>
            <h3>Заполни анкету и заявку</h3>
            <p>Укажи свой класс, интересы и выбери департамент, в котором хочешь развивать проекты и мероприятия.</p>
          </article>
          <article className="step-card">
            <span className="step-number">03</span>
            <Trophy size={26}/>
            <h3>Работай и получай баллы</h3>
            <p>Выполняй задачи команды, предлагай идеи событий, отправляй отчёты и поднимайся в лидерборде совета.</p>
          </article>
        </div>
      </section>
      <section className="public-section" id="departments">
        <div className="public-section-heading"><div><span className="eyebrow">НАЙДИ СВОЁ НАПРАВЛЕНИЕ</span><h2>Разные интересы. Общая цель.</h2></div><span>Департаменты Student Council</span></div>
        <div className="public-departments">
          {data?.departments.map(d=><article key={d.id}>
            <span className="department-badge"><GraduationCap size={30}/></span>
            <div>
              <BadgeText text="ДЕПАРТАМЕНТ СОВЕТА"/>
              <h3>{d.name}</h3>
              <p>{d.description}</p>
              <div className="row spread">
                <span>Министр · <strong>{d.ministerName||"Позиция открыта"}</strong></span>
                <div className="row wrap">
                  <Link className="button button-outline" href={`/departments/${d.slug}`}>О департаменте</Link>
                  <Link className="button button-primary" href="/register">Подать заявку <ArrowUpRight size={17}/></Link>
                </div>
              </div>
            </div>
          </article>)}
        </div>
      </section>
      <section className="public-section" id="team">
        <div className="public-section-heading"><div><span className="eyebrow">ЛЮДИ И ОТВЕТСТВЕННОСТЬ</span><h2>Руководство совета</h2></div></div>
        <div className="leadership-grid">
          {([
            ["PRESIDENT", "President · Президент совета"],
            ["VICE_PRESIDENT", "Vice President · Вице-президент"],
            ["PRIME_MINISTER", "Prime Minister · Премьер-министр"],
            ["COUNSELOR", "Counselor · Каунслер"],
          ] as const).map(([role, label]) => {
            const leader = data?.leaders.find(l => l.globalRole === role);
            return <article key={role}><span className="leadership-avatar"><Users size={27}/></span><div><h3>{leader?.name || "Позиция открыта"}</h3><p>{label}</p></div></article>;
          })}
          <article><span className="leadership-avatar accent"><GraduationCap size={27}/></span><div><h3>{data?.departments.find(d=>d.slug==="intellectual-development")?.ministerName||"Zhanbolat"}</h3><p>Minister · Intellectual Development</p></div></article>
        </div>
      </section>
      <section className="public-section" id="calendar">
        <div className="public-section-heading"><div><span className="eyebrow">ВСТРЕЧАЕМСЯ В ШКОЛЕ</span><h2>Календарь событий</h2></div><CalendarDays size={26}/></div>
        {data?.events.length?<div className="public-event-list">{data.events.map(e=><article key={e.id}><span className="event-date"><strong>{formatInTimeZone(new Date(e.startAt),data?.school.timezone||"Asia/Qyzylorda","d",{locale:ru})}</strong><span>{formatInTimeZone(new Date(e.startAt),data?.school.timezone||"Asia/Qyzylorda","MMM",{locale:ru})}</span></span><div><h3>{e.title}</h3><p>{e.description}</p><small>{displayDate(e.startAt,data?.school.timezone,true)} · {e.location}</small></div></article>)}</div>:<div className="public-empty"><CalendarDays size={32}/><div><h3>Новые встречи уже в планах</h3><p>Здесь появятся открытые мероприятия после подтверждения и публикации командой.</p></div></div>}
      </section>
      <section className="public-cta">
        <div>
          <span className="eyebrow">НАЧНИ С СЕБЯ</span>
          <h2>Следующая хорошая идея — твоя.</h2>
          <p>Зарегистрируйся вручную или через Google, заполни профиль и подай заявку в команду.</p>
        </div>
        <div className="public-cta-actions">
          <Link className="button button-light" href="/register">Зарегистрироваться <ArrowUpRight size={18}/></Link>
          <Link className="button button-outline-light" href="/login">Уже есть аккаунт? Войти</Link>
        </div>
      </section>
    </main>
    <footer className="public-footer">
      <span>Council Space · Student Council</span>
      <span>Создаём школьную жизнь вместе.</span>
      <div className="row wrap">
        <Link href="/login">Войти</Link>
        <Link href="/register">Регистрация <ArrowUpRight size={15}/></Link>
      </div>
    </footer>
  </div>;
}
function BadgeText({text}:{text:string}){return <span className="eyebrow">{text}</span>;}
