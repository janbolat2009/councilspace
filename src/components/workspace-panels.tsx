"use client";
import { useState } from "react";
import { ArrowUpRight, ArrowRight, Clock3, CheckCircle2, FileClock, CalendarDays, Plus, List, Columns3, Flag, MapPin, ChevronLeft, ChevronRight, Check, Medal, BookOpen, Target, Lightbulb } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { useWorkspace } from "./workspace-context";
import { Avatar, Badge, Button, cn, Empty, Panel, SectionLink, Status, statuses } from "./ui";
import { Form, ConfirmAction } from "./forms";
import { displayDate } from "@/lib/time";
import { PasswordSettings } from "./password-settings";
const hours = (minutes: number) => (minutes / 60).toLocaleString("ru", { maximumFractionDigits:2 });
function dateCaption(value: string | null, timezone: string, dateOnly = false) {
  return value ? dateOnly ? new Date(value).toLocaleDateString("ru",{day:"numeric",month:"short",timeZone:"UTC"}) : formatInTimeZone(new Date(value),timezone,"d MMM, HH:mm",{locale:ru}) : "Без дедлайна";
}
function CouncilArt() {
  return <svg className="council-art" viewBox="0 0 280 210" fill="none" aria-hidden="true"><circle cx="155" cy="106" r="88" stroke="#87a7ae" strokeOpacity=".25"/><circle cx="155" cy="106" r="62" stroke="#87a7ae" strokeOpacity=".25" strokeDasharray="3 8"/><path d="M69 131 149 85 226 128 149 176Z" fill="#153f50" stroke="#8caab2"/><path d="M73 120 149 76 222 117 149 162Z" fill="#fff0d1"/><path d="m149 76 73 41-73 45V76Z" fill="#eadab8"/><path d="M149 162v14" stroke="#9cafa8"/><path d="M93 112 138 86M94 121l44-25M159 95l43 24M159 105l28 16" stroke="#9d8b6d" strokeWidth="2"/><path d="M135 60c0-12 9-22 21-22s22 10 22 22c0 9-5 15-11 20v12h-21V80c-7-5-11-11-11-20Z" fill="#bc6a59" stroke="#f2c6ad" strokeWidth="2"/><path d="M145 94h23M148 101h16" stroke="#f2c6ad" strokeWidth="3" strokeLinecap="round"/><path d="m151 73 2 16m10-16-3 16m-6-20 6 4 6-4M155 25v-7m31 17 6-6m-68 6-6-6m77 27h8" stroke="#f2c6ad" strokeWidth="2" strokeLinecap="round"/><path d="m72 59 5 9 11 2-8 8 1 11-10-5-9 5 1-11-8-8 11-2Z" stroke="#d8c798"/><circle cx="224" cy="64" r="8" stroke="#9caeb1"/><path d="m220 170 5-6m-5 0 5 6M62 159h9m-5-5v10" stroke="#d6b97e" strokeWidth="2"/></svg>;
}
export function Overview() {
  const { data, navigate, open } = useWorkspace();
  const activeTasks = data.tasks.filter(t => !["COMPLETED","CANCELLED"].includes(t.status));
  const myTasks = activeTasks.filter(t => t.assignees.some(a => a.userId === data.user.id));
  const nextEvents = data.events.filter(e => e.status !== "CANCELLED" && new Date(e.endAt) >= new Date()).slice(0,3);
  return <div className="overview">
    <div className="overview-top"><section className="welcome-banner"><div><span className="welcome-kicker"><span/>ТВОИ ИДЕИ. НАШЕ БУДУЩЕЕ.</span><h2>Вместе — больше.</h2><p>Превращаем любопытство в знания,<br/>а хорошие идеи — в настоящие события.</p><button onClick={() => open({type:"event"})}>Предложить идею <ArrowUpRight size={17}/></button></div><CouncilArt/></section>
    <section className="today-card"><div className="row spread"><span className="eyebrow">СЕГОДНЯ</span><CalendarDays size={19}/></div><strong className="today-date" suppressHydrationWarning>{formatInTimeZone(new Date(),data.school.timezone,"d MMMM",{locale:ru})}<span suppressHydrationWarning>{formatInTimeZone(new Date(),data.school.timezone,"EEEE",{locale:ru})}</span></strong><div className="today-line"><span className="red-dot"/>{data.manager ? data.stats.pending : data.reports.filter(r=>r.status==="PENDING"&&r.userId===data.user.id).length} отчётов на проверке</div><div className="today-line"><span className="navy-dot"/>{myTasks.length} задач в твоём фокусе{data.manager && data.stats.overdue > 0 ? ` · ${data.stats.overdue} просрочено` : ""}</div><button onClick={() => navigate("calendar")}>Открыть календарь <ArrowRight size={16}/></button></section></div>
    <div className="stat-grid">{[
      { label:"Мои задачи", value:myTasks.length, unit:"", icon:CheckCircle2, detail:data.manager && data.stats.overdue > 0 ? `${activeTasks.length} активных · ${data.stats.overdue} просрочено` : `${activeTasks.length} активных в департаменте`, view:"tasks", tone:"navy" },
      { label:"Подтверждённые часы", value:hours(data.stats.minutes), unit:"ч", icon:Clock3, detail:"Только проверенная работа", view:"reports", tone:"burgundy" },
      { label:"Мой вклад", value:Number(data.stats.points).toLocaleString("ru",{maximumFractionDigits:2}), unit:"баллов", icon:Medal, detail:"За всё время в департаменте", view:"leaderboard", tone:"ochre" },
      { label:data.manager ? "Ожидают решения" : "Мои отчёты", value:data.manager ? data.stats.pending + data.stats.applications : data.reports.filter(r=>r.status==="PENDING"&&r.userId===data.user.id).length, unit:"", icon:FileClock, detail:data.manager ? `${data.stats.applications} заявок · ${data.stats.pending} отчётов` : `${data.reports.length} всего отправлено`, view:data.manager ? "review" : "reports", tone:"sage" }
    ].map(s => <button className="stat-card" key={s.label} onClick={() => navigate(s.view)}><div className="row spread"><span>{s.label}</span><span className={`stat-icon ${s.tone}`}><s.icon size={19}/></span></div><strong>{s.value}<small>{s.unit}</small></strong><p>{s.detail}</p></button>)}</div>
    <div className="dashboard-columns"><div className="dashboard-left"><Panel title="В фокусе команды" subtitle="Ближайшие задачи и важные дедлайны" action={<SectionLink onClick={() => navigate("tasks")}>Все задачи</SectionLink>}>
      <div className="task-table">{activeTasks.slice(0,5).map(task => <button key={task.id} className="task-row" onClick={() => open({type:"taskDetail",id:task.id})}><span className={cn("task-checkbox",task.status==="SUBMITTED"&&"checked")}>{task.status==="SUBMITTED"&&<Check size={12}/>}</span><div className="task-title"><strong>{task.title}</strong><small><span className={cn("priority-dot",task.priority.toLowerCase())}/>{statuses[task.priority]} приоритет</small></div><Status value={task.status}/><span className="task-deadline">{dateCaption(task.dueDate||task.dueAt,data.school.timezone,!!task.dueDate)}</span><div className="avatar-stack">{task.assignees.slice(0,2).map(a=><Avatar key={a.userId} name={a.user.name} small/>)}</div></button>)}</div>{!activeTasks.length&&<Empty title="Все задачи под контролем">Создайте новую задачу для следующего шага.</Empty>}<button className="panel-add" onClick={() => open({type:"task"})}><Plus size={16}/>Добавить задачу</button>
    </Panel><Panel title="Последняя активность" action={<Badge>Команда</Badge>}><div className="activity-list">{data.notifications.slice(0,3).map((n,i)=><button key={n.id} onClick={()=>navigate("notifications")}><span className={cn("activity-icon",i%2?"pink":"blue")}><CheckCircle2 size={18}/></span><div><strong>{n.title}</strong><small>{displayDate(n.createdAt,data.school.timezone,true)}</small></div><ArrowUpRight size={15}/></button>)}{data.manager&&data.audits.slice(0,2).map(a=><button key={a.id} onClick={()=>navigate("audit")}><span className="activity-icon blue"><CheckCircle2 size={18}/></span><div><strong>{a.actor.name}: {a.action}</strong><small>{displayDate(a.createdAt,data.school.timezone,true)} · {a.reason||"Журнал действий"}</small></div><ArrowUpRight size={15}/></button>)}{!data.notifications.length&&(!data.manager||!data.audits.length)&&<Empty title="Новых уведомлений нет"/>}</div></Panel></div>
    <div className="dashboard-right"><Panel title="Скоро в календаре" action={<button className="icon-button" aria-label="Все мероприятия" onClick={()=>navigate("events")}><ArrowUpRight size={18}/></button>}><div className="event-list">{nextEvents.map((event,i)=><button className="event-preview" key={event.id} onClick={()=>open({type:"eventDetail",id:event.id})}><div className={`event-date date-${i}`}><strong>{formatInTimeZone(event.startAt,data.school.timezone,"dd")}</strong><span>{formatInTimeZone(event.startAt,data.school.timezone,"MMM",{locale:ru})}</span></div><div><strong>{event.title}</strong><small><Clock3 size={12}/>{formatInTimeZone(event.startAt,data.school.timezone,"HH:mm")}<span>·</span>{event.location}</small><Badge tone={event.status==="CONFIRMED"?"green":"neutral"}>{event.status==="CONFIRMED"?"Готовимся":"Планируем"} · {event.tasks.filter(t=>t.status==="COMPLETED").length}/{event.tasks.length} задач</Badge></div></button>)}{!nextEvents.length&&<Empty title="Новые события впереди"/>}</div><button className="panel-add" onClick={()=>navigate("calendar")}>Весь календарь <ArrowRight size={16}/></button></Panel>
    <section className="idea-note"><span className="idea-icon"><Lightbulb size={23}/></span><div><span className="eyebrow">ЕСТЬ ИДЕЯ?</span><h3>Начни с предложения.</h3><p>Игра, встреча или новый формат —<br/>создадим это вместе.</p><button onClick={()=>open({type:"event"})}>Предложить мероприятие <ArrowUpRight size={15}/></button></div><span className="note-decoration">✳</span></section>
    <div className="team-strip"><div className="avatar-stack">{data.members.filter(m=>m.status==="ACTIVE").slice(0,4).map(m=><Avatar key={m.id} name={m.user.name} small/>)}</div><div><strong>{data.members.filter(m=>m.status==="ACTIVE").length} участников</strong><button onClick={()=>navigate("members")}>Одна команда <ArrowUpRight size={12}/></button></div></div></div></div>
  </div>;
}
export function TasksPanel() {
  const {data,search,open,navigate} = useWorkspace();
  const [mode,setMode] = useState("list"),[status,setStatus] = useState(""),[priority,setPriority] = useState(""),[person,setPerson] = useState(""),[period,setPeriod] = useState("");
  const tasks = data.tasks.filter(t=>t.title.toLowerCase().includes(search.toLowerCase())&&(!status||t.status===status)&&(!priority||t.priority===priority)&&(!person||t.assignees.some(a=>a.userId===person))&&(!period||(t.dueDate||t.dueAt||"").slice(0,10)<=period));
  return <><div className="filter-bar"><div className="filter-group">{data.departments.length>1&&<select aria-label="Департамент задач" value={data.department?.id||""} onChange={e=>navigate("tasks",{department:e.target.value})} >{data.departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>}<select aria-label="Статус" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Все статусы</option>{["TODO","IN_PROGRESS","SUBMITTED","COMPLETED","CANCELLED"].map(s=><option key={s} value={s}>{statuses[s]}</option>)}</select><select aria-label="Приоритет" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">Приоритет</option>{["HIGH","MEDIUM","LOW"].map(s=><option key={s} value={s}>{statuses[s]}</option>)}</select><select aria-label="Ответственный" value={person} onChange={e=>setPerson(e.target.value)}><option value="">Все участники</option>{data.members.map(m=><option key={m.id} value={m.userId}>{m.user.name}</option>)}</select><label className="inline-date">До <input aria-label="Дедлайн до" type="date" value={period} onChange={e=>setPeriod(e.target.value)}/></label></div><div className="segmented"><button className={mode==="list"?"selected":""} onClick={()=>setMode("list")}><List size={16}/>Список</button><button className={mode==="kanban"?"selected":""} onClick={()=>setMode("kanban")}><Columns3 size={16}/>Канбан</button></div></div>
    {mode==="list"?<Panel><div className="table-scroll"><table><thead><tr><th>Задача</th><th>Статус</th><th>Приоритет</th><th>Дедлайн</th><th>Ответственные</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td><button className="table-title" onClick={()=>open({type:"taskDetail",id:t.id})}>{t.title}</button><small>{t.checklist.filter(c=>c.done).length}/{t.checklist.length} пунктов · {t.comments.length} комментариев</small></td><td><Status value={t.status}/></td><td><span className={`priority-text ${t.priority.toLowerCase()}`}><Flag size={13}/>{statuses[t.priority]}</span></td><td>{dateCaption(t.dueDate||t.dueAt,data.school.timezone,!!t.dueDate)}</td><td><div className="avatar-stack">{t.assignees.map(a=><Avatar key={a.userId} name={a.user.name} small/>)}</div></td></tr>)}</tbody></table></div>{!tasks.length&&<Empty title="Подходящих задач нет">Попробуйте изменить фильтры или создать задачу.</Empty>}</Panel>:<div className="kanban">{["TODO","IN_PROGRESS","SUBMITTED","COMPLETED","CANCELLED"].map(s=><section key={s}><h3><span className={`kanban-dot ${s}`}/>{statuses[s]}<span>{tasks.filter(t=>t.status===s).length}</span></h3>{tasks.filter(t=>t.status===s).map(t=><button key={t.id} className="kanban-card" onClick={()=>open({type:"taskDetail",id:t.id})}><Status value={t.priority}/><strong>{t.title}</strong><p>{t.checklist.filter(c=>c.done).length}/{t.checklist.length} выполнено</p><div className="row spread"><small><Clock3 size={12}/>{dateCaption(t.dueDate||t.dueAt,data.school.timezone,!!t.dueDate)}</small><Avatar name={t.assignees[0]?.user.name||"SC"} small/></div></button>)}<button className="kanban-add" onClick={()=>open({type:"task"})}><Plus size={15}/>Добавить</button></section>)}</div>}</>;
}
export function EventsPanel() {
  const {data,search,open,navigate} = useWorkspace(),[status,setStatus]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState("");
  const events=data.events.filter(e=>e.title.toLowerCase().includes(search.toLowerCase())&&(!status||e.status===status)&&(!from||e.startAt.slice(0,10)>=from)&&(!to||e.startAt.slice(0,10)<=to));
  return <><div className="filter-bar"><div className="filter-group">{data.departments.length>1&&<select aria-label="Департамент мероприятий" value={data.department?.id||""} onChange={e=>navigate("events",{department:e.target.value})}>{data.departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>}<select aria-label="Статус мероприятия" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Все мероприятия</option>{["DRAFT","PROPOSED","CONFIRMED","COMPLETED","CANCELLED"].map(s=><option key={s} value={s}>{statuses[s]}</option>)}</select><label className="inline-date">С <input aria-label="Начало периода" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="inline-date">До <input aria-label="Конец периода" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div><span className="muted">{events.length} мероприятий</span></div><div className="events-grid">{events.map((e,i)=><button key={e.id} className="event-card" onClick={()=>open({type:"eventDetail",id:e.id})}><div className={`event-card-art art-${i%3}`}><span>{["ЗНАНИЯ × КОМАНДА","ИДЕИ × ОТКРЫТИЯ","ОПЫТ × ВДОХНОВЕНИЕ"][i%3]}</span>{i%3===0?<BookOpen size={62} strokeWidth={1}/>:i%3===1?<Lightbulb size={62} strokeWidth={1}/>:<Target size={62} strokeWidth={1}/>}<span className="art-circle"/></div><div className="event-card-body"><div className="row spread"><Status value={e.status}/><small>{e.isPublic?"Публичное":"Внутри команды"}</small></div><h2>{e.title}</h2><p><CalendarDays size={15}/>{displayDate(e.startAt,data.school.timezone,true)}</p><p><MapPin size={15}/>{e.location}</p><div className="event-card-footer"><span>{e.tasks.filter(t=>t.status==="COMPLETED").length}/{e.tasks.length} задач готово</span><ArrowUpRight size={18}/></div></div></button>)}</div>{!events.length&&<Empty title="Мероприятия не найдены"/>}</>;
}
export function CalendarPanel() {
  const {data,open}=useWorkspace(),[offset,setOffset]=useState(0),[mode,setMode]=useState("month");
  const today=formatInTimeZone(new Date(),data.school.timezone,"yyyy-MM-dd");
  const date=new Date(`${today.slice(0,7)}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+offset);
  const year=date.getUTCFullYear(),month=date.getUTCMonth();
  const monthKey=`${year}-${String(month+1).padStart(2,"0")}`;
  const days=new Date(Date.UTC(year,month+1,0)).getUTCDate(),start=(date.getUTCDay()+6)%7;
  const entries=[...data.events.map(e=>({id:e.id,type:"eventDetail",title:e.title,date:formatInTimeZone(e.startAt,data.school.timezone,"yyyy-MM-dd"),time:formatInTimeZone(e.startAt,data.school.timezone,"HH:mm"),status:e.status})),...data.tasks.filter(t=>t.dueAt||t.dueDate).map(t=>({id:t.id,type:"taskDetail",title:t.title,date:t.dueDate?t.dueDate.slice(0,10):formatInTimeZone(t.dueAt!,data.school.timezone,"yyyy-MM-dd"),time:t.dueDate?"Весь день":formatInTimeZone(t.dueAt!,data.school.timezone,"HH:mm"),status:t.status}))].filter(e=>e.date.startsWith(monthKey)).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  return <Panel><div className="calendar-toolbar"><div className="row"><button className="icon-button" aria-label="Предыдущий месяц" onClick={()=>setOffset(offset-1)}><ChevronLeft size={19}/></button><h2>{date.toLocaleDateString("ru",{month:"long",year:"numeric",timeZone:"UTC"})}</h2><button className="icon-button" aria-label="Следующий месяц" onClick={()=>setOffset(offset+1)}><ChevronRight size={19}/></button><Button variant="ghost" onClick={()=>setOffset(0)}>Сегодня</Button></div><div className="segmented"><button className={mode==="month"?"selected":""} onClick={()=>setMode("month")}>Месяц</button><button className={mode==="agenda"?"selected":""} onClick={()=>setMode("agenda")}>Повестка</button></div></div><div className={cn("calendar-grid",mode!=="month"&&"hide")} >{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d=><div className="weekday" key={d}>{d}</div>)}{Array.from({length:start+days},(_,i)=>{const day=i-start+1,key=`${monthKey}-${String(day).padStart(2,"0")}`;return <div className={cn("calendar-cell",day<1&&"outside",key===today&&"is-today")} key={i}>{day>0&&<><span>{day}</span>{entries.filter(e=>e.date===key).map(e=><button className={e.type==="eventDetail"?"calendar-event":"calendar-task"} key={e.id} onClick={()=>open({type:e.type,id:e.id})}>{e.time}<strong>{e.title}</strong></button>)}</>}</div>;})}</div><div className={cn("agenda",mode==="month"&&"mobile-only-agenda")}>{entries.map(e=><button key={e.id} onClick={()=>open({type:e.type,id:e.id})}><div><strong>{e.date.slice(8)}</strong><small>{date.toLocaleDateString("ru",{month:"short",timeZone:"UTC"})}</small></div><span><strong>{e.title}</strong><small>{e.time} · {e.type==="eventDetail"?"Мероприятие":"Дедлайн задачи"}</small></span><Status value={e.status}/></button>)}{!entries.length&&<Empty title="В этом месяце пока нет событий"/>}</div><p className="panel-footnote">Точное время показано в {data.school.timezone}. Дедлайны только по дате отмечены «Весь день».</p></Panel>;
}
export function ReportsPanel({review=false}:{review?:boolean}) {
  const {data,open,search}=useWorkspace(),[filter,setFilter]=useState(review?"PENDING":"");
  const rows=data.reports.filter(r=>(review||r.userId===data.user.id)&&(!filter||r.status===filter)&&`${r.task.title} ${r.user.name}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="filter-bar"><select aria-label="Статус отчёта" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Все отчёты</option>{["DRAFT","PENDING","CHANGES_REQUESTED","APPROVED","REJECTED"].map(s=><option key={s} value={s}>{statuses[s]}</option>)}</select><p className="muted">Часы и баллы начисляются только после проверки.</p></div><Panel><div className="table-scroll"><table><thead><tr><th>Задача / участник</th><th>Дата работы</th><th>Заявлено</th><th>Подтверждено</th><th>Статус</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><button className="table-title" onClick={()=>open({type:"reportDetail",id:r.id})}>{r.task.title}</button><small>{r.user.name}</small></td><td>{displayDate(r.performedOn,"UTC")}</td><td>{hours(r.claimedMinutes)} ч</td><td>{r.approvedMinutes===null?"—":`${hours(r.approvedMinutes)} ч`}</td><td><Status value={r.status}/></td><td><button className="text-link" onClick={()=>open({type:"reportDetail",id:r.id})}>Открыть <ArrowUpRight size={14}/></button></td></tr>)}</tbody></table></div>{!rows.length&&<Empty title={review?"Очередь проверки пуста":"Отчётов пока нет"}>Отправьте отчёт о выполненной работе через кнопку «Создать».</Empty>}</Panel></>;
}
const COUNCIL_ROLE_META = [
  { role: "PRESIDENT", title: "Президент", subtitle: "President · Глава совета" },
  { role: "VICE_PRESIDENT", title: "Вице-президент", subtitle: "Vice President · Заместитель" },
  { role: "PRIME_MINISTER", title: "Премьер-министр", subtitle: "Prime Minister · Координация" },
  { role: "COUNSELOR", title: "Каунслер", subtitle: "Counselor · Советник" },
] as const;
const GLOBAL_ROLE_RANK: Record<string, number> = { PRESIDENT: 0, VICE_PRESIDENT: 1, PRIME_MINISTER: 2, COUNSELOR: 3, SCHOOL_ADMIN: 4, STUDENT: 5 };
const DEPT_ROLE_RANK: Record<string, number> = { MINISTER: 0, VICE_MINISTER: 1, MEMBER: 2 };
export function MembersPanel() {
  const {data,open,search}=useWorkspace();
  const members=[...data.members]
    .filter(m=>m.user.name?.toLowerCase().includes(search.toLowerCase()) || statuses[m.user.globalRole]?.toLowerCase().includes(search.toLowerCase()) || statuses[m.role]?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>(GLOBAL_ROLE_RANK[a.user.globalRole]??9)-(GLOBAL_ROLE_RANK[b.user.globalRole]??9)||(DEPT_ROLE_RANK[a.role]??9)-(DEPT_ROLE_RANK[b.role]??9));
  return <>
    <div className="council-roles-grid">
      {COUNCIL_ROLE_META.map(item => {
        const holder = data.leaders?.find(l => l.globalRole === item.role) || data.members.find(m => m.user.globalRole === item.role)?.user;
        return <div className={cn("council-role-card", holder && "assigned")} key={item.role}>
          <div className="row spread">
            <Badge tone={holder ? "red" : "neutral"}>{item.title}</Badge>
            {data.manager && <button className="text-link" onClick={() => open({ type: "assignCouncilRole", id: item.role })}>{holder ? "Изменить" : "Назначить"} <ArrowUpRight size={13}/></button>}
          </div>
          <div className="council-role-person">
            <Avatar name={holder?.name || item.title.slice(0, 2)} image={holder?.image}/>
            <div>
              <strong>{holder?.name || "Позиция открыта"}</strong>
              <small>{holder ? `${holder.classroom ? `${holder.classroom} · ` : ""}${item.subtitle}` : item.subtitle}</small>
            </div>
          </div>
        </div>;
      })}
    </div>
    <Panel title="Люди, с которыми всё получается" subtitle="Роли в совете и участие в департаменте" action={<Badge>{members.length} участников</Badge>}>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Участник</th><th>Класс</th><th>Роль</th><th>Статус</th><th/></tr></thead>
          <tbody>
            {members.map(m => {
              const hasCouncilRole = ["PRESIDENT", "VICE_PRESIDENT", "PRIME_MINISTER", "COUNSELOR"].includes(m.user.globalRole);
              return <tr key={m.id}>
                <td>
                  <div className="person-cell">
                    <Avatar name={m.user.name} image={m.user.image}/>
                    <span>
                      <strong>{m.user.name}{m.userId === data.user.id && <Badge>Вы</Badge>}</strong>
                      <small>{m.user.isDemo ? "Демонстрационный профиль" : (m.user.interests || "Участник Student Council")}</small>
                    </span>
                  </div>
                </td>
                <td>{m.user.classroom || "—"}</td>
                <td>
                  <div className="row wrap">
                    {hasCouncilRole && <Badge tone="red">{statuses[m.user.globalRole]}</Badge>}
                    <Badge tone={m.role !== "MEMBER" ? "blue" : "neutral"}>{statuses[m.role]}</Badge>
                  </div>
                </td>
                <td><Status value={m.status}/></td>
                <td>{data.manager && <Button variant="ghost" onClick={() => open({ type: "member", id: m.id })}>Управлять <ArrowUpRight size={14}/></Button>}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {!members.length && <Empty title="Участники не найдены"/>}
    </Panel>
  </>;
}
export function LeaderboardPanel() {
  const {data,navigate,search}=useWorkspace();
  const [period,setPeriod]=useState(data.period||"month"),[from,setFrom]=useState(data.range.from),[to,setTo]=useState(data.range.to),[sort,setSort]=useState(data.sort||"points");
  function change(p:string,s:string,deptId=data.department?.id||""){setPeriod(p);setSort(s);navigate("leaderboard",{period:p,sort:s,...(deptId?{department:deptId}:{}),...(p==="custom"?{from,to}:{})});}
  const rows=data.leaderboard.filter(r=>r.user.name?.toLowerCase().includes(search.toLowerCase()));
  return <><div className="leaderboard-intro"><span className="leaderboard-medal"><Medal size={35}/></span><div><h2>У каждого вклада есть значение</h2><p>Поддерживаем участие и отмечаем работу команды. {data.department?.rate} баллов за подтверждённый час.</p></div></div><div className="filter-bar"><div className="filter-group">{data.departments.length>1&&<select aria-label="Департамент лидерборда" value={data.department?.id||""} onChange={e=>change(period,sort,e.target.value)}>{data.departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>}<select aria-label="Период" value={period} onChange={e=>change(e.target.value,sort)}><option value="month">Текущий месяц</option><option value="quarter">Четверть</option><option value="year">Учебный год</option><option value="custom">Свой период</option></select>{period==="custom"&&<><input aria-label="С даты" type="date" value={from} onChange={e=>setFrom(e.target.value)}/><input aria-label="По дату" type="date" value={to} onChange={e=>setTo(e.target.value)}/><Button variant="outline" onClick={()=>change("custom",sort)}>Применить</Button></>}</div><select aria-label="Сортировка" value={sort} onChange={e=>change(period,e.target.value)}><option value="points">По баллам</option><option value="hours">По часам</option></select></div><Panel><div className="table-scroll"><table><thead><tr><th>Место</th><th>Участник</th><th>Класс</th><th>Часы</th><th>Баллы</th><th>Отчёты</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.user.id} className={r.user.id===data.user.id?"my-standing":""}><td><span className={cn("rank",i<3&&`rank-${i}`)}>{i+1}</span></td><td><div className="person-cell"><Avatar name={r.user.name}/><strong>{r.user.name}{r.user.id===data.user.id&&<Badge>Вы</Badge>}</strong></div></td><td>{r.user.classroom}</td><td>{hours(r.minutes)} ч</td><td><strong>{Number(r.points).toLocaleString("ru",{maximumFractionDigits:2})}</strong></td><td>{r.reportCount}</td></tr>)}</tbody></table></div>{!rows.length&&<Empty title="Вклад ещё впереди">В этом периоде пока нет подтверждённой работы.</Empty>}<p className="panel-footnote">Период {data.range.from} — {data.range.to} относится к дате выполнения работы, а не проверки. Неподтверждённые отчёты не учитываются.</p></Panel></>;
}
export function ApplicationsPanel() {
  const {data,open}=useWorkspace(),[filter,setFilter]=useState("PENDING");
  const rows=data.applications.filter(a=>!filter||a.status===filter);
  return <><div className="filter-bar"><select aria-label="Статус заявки" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Все заявки</option>{["PENDING","APPROVED","REJECTED","WITHDRAWN"].map(s=><option key={s} value={s}>{statuses[s]}</option>)}</select><span className="muted">Анкеты доступны только руководству.</span></div><Panel>{rows.map(a=><div className="application-row" key={a.id}><Avatar name={a.user.name}/><div><h3>{a.user.name}</h3><p>{a.user.classroom} · {a.direction} · {a.weeklyHours} ч/неделю</p><small>{displayDate(a.createdAt,data.school.timezone)}</small></div><Status value={a.status}/><Button variant="outline" onClick={()=>open({type:"application",id:a.id})}>Рассмотреть <ArrowUpRight size={14}/></Button></div>)}{!rows.length&&<Empty title="Заявок с таким статусом нет"/>}</Panel></>;
}
export function NotificationsPanel() {
  const {data,mutate,navigate}=useWorkspace(),[error,setError]=useState("");
  return <Panel title="Последние уведомления" action={<Button variant="ghost" onClick={()=>mutate("readNotifications",{}).catch(e=>setError(e.message))}>Прочитать все</Button>}>{error&&<p role="alert" className="form-error">{error}</p>}{data.notifications.map(n=><button className={cn("notification-row",!n.readAt&&"unread")} key={n.id} onClick={async()=>{try{await mutate("readNotifications",{id:n.id});const u=new URL(n.href,"http://local");navigate(u.searchParams.get("view")||"overview",Object.fromEntries(u.searchParams));}catch(e){setError((e as Error).message);}}}><span className="activity-icon blue"><CheckCircle2 size={19}/></span><div><strong>{n.title}</strong><small>{displayDate(n.createdAt,data.school.timezone,true)}</small></div>{!n.readAt&&<span className="red-dot"/>}<ArrowUpRight size={16}/></button>)}{!data.notifications.length&&<Empty title="Вы всё прочитали"/>}</Panel>;
}
export function AuditPanel() {
  const {data}=useWorkspace();
  return <Panel title="Прозрачная история решений" subtitle="Роли, заявки, отчёты, ставки и модерация"><div className="table-scroll"><table><thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Причина</th></tr></thead><tbody>{data.audits.map(a=><tr key={a.id}><td>{displayDate(a.createdAt,data.school.timezone,true)}</td><td>{a.actor.name}</td><td><code>{a.action}</code></td><td>{a.reason||"—"}</td></tr>)}</tbody></table></div>{!data.audits.length&&<Empty title="Действий пока нет"/>}</Panel>;
}
export function ProfilePanel() {
  const {data,mutate,open}=useWorkspace();
  const myApps = data.applications.filter(a=>a.userId===data.user.id);
  const pendingApp = myApps.find(a=>a.status==="PENDING");
  return <>
    {!data.department && (
      <section className={cn("candidate-banner", pendingApp ? "pending" : "action")}>
        <div className="candidate-banner-copy">
          <span className="eyebrow">{pendingApp ? "СТАТУС ЗАЯВКИ · НА РАССМОТРЕНИИ" : "ШАГ ДО КОМАНДЫ · ВЫБЕРИТЕ ДЕПАРТАМЕНТ"}</span>
          <h2>{pendingApp ? `Заявка в «${pendingApp.department.name}» отправлена!` : "Добро пожаловать в Council Space!"}</h2>
          <p>{pendingApp ? "Руководство департамента уже получило вашу анкету. Как только заявку одобрят, вам откроются задачи, мероприятия, командный чат и лидерборд." : "Чтобы получить доступ к задачам, событиям и чату команды, выберите департамент ниже и отправьте короткую заявку."}</p>
        </div>
        {!pendingApp && data.allDepartments[0] && (
          <Button onClick={() => open({ type: "apply", id: data.allDepartments[0].id })}>Подать заявку в команду <ArrowUpRight size={18}/></Button>
        )}
      </section>
    )}
    <div className="profile-layout"><div><Panel title="Мой профиль" subtitle="Расскажите команде о себе"><div className="padded"><Form fields={[{name:"name",label:"Имя и фамилия",value:data.user.name||"",required:true},{name:"classroom",label:"Класс",value:data.user.classroom,placeholder:"Например, 10 A",required:true},{name:"image",label:"Ссылка на аватар",type:"url",value:data.user.image||"",help:"Можно оставить пустой — останутся инициалы."},{name:"interests",label:"Интересы",type:"textarea",value:data.user.interests},{name:"departmentId",label:"Выбор департамента для заявки",options:[{value:"",label:"Выберу позже"},...data.allDepartments.map(d=>({value:d.id,label:d.name}))],value:data.allDepartments[0]?.id||""}]} onSubmit={async v=>{const {departmentId,...profile}=v;await mutate("saveProfile",profile);if(departmentId&&!data.departments.some(d=>d.id===departmentId)&&!data.applications.some(a=>a.departmentId===departmentId&&a.status==="PENDING"))open({type:"apply",id:departmentId});}}/></div></Panel><PasswordSettings/></div><div><Panel title="Присоединиться к команде"><div className="padded"><p>Выберите департамент и отправьте заявку. Доступ к рабочему пространству откроется после принятия.</p>{data.allDepartments.map(d=><div className="department-join" key={d.id}><BookOpen size={22}/><div><strong>{d.name}</strong><small>{d.description}</small></div><Button variant="primary" onClick={()=>open({type:"apply",id:d.id})}>Подать заявку</Button></div>)}</div></Panel><Panel title="Мои заявки">{myApps.map(a=><div className="padded border-bottom" key={a.id}><div className="row spread"><strong>{a.department.name}</strong><Status value={a.status}/></div><p>{a.comment||"Ожидает решения руководства."}</p>{a.status==="PENDING"&&<ConfirmAction label="Отозвать заявку" description="Заявка больше не будет рассматриваться. Позже можно подать новую." action={()=>mutate("decideApplication",{id:a.id,status:"WITHDRAWN"})}/>}</div>)}{!myApps.length&&<Empty title="Вы ещё не подавали заявки"/>}</Panel></div></div>
  </>;
}
export function SettingsPanel() {
  const {data,mutate,open}=useWorkspace(),school=data.school;
  return <div className="settings-grid"><Panel title="Правила начисления" subtitle={`Текущая версия: ${data.department?.ruleVersion}`}><div className="padded"><p>Новая ставка применяется к следующим подтверждениям. История начислений сохраняет прежние ставки.</p><Form fields={[{name:"rate",label:"Баллы за час",type:"number",value:Number(data.department?.rate||10),min:0,max:10000,step:.01,required:true},{name:"reason",label:"Причина изменения",required:true}]} onSubmit={v=>mutate("updateRate",{departmentId:data.department?.id,rate:Number(v.rate),reason:v.reason})}/></div></Panel>
    {(data.user.globalRole==="SCHOOL_ADMIN"||data.user.isAdmin)&&<><Panel title="Школа и оформление"><div className="padded"><Form columns fields={[{name:"name",label:"Название школы / совета",value:school.name,required:true},{name:"logoUrl",label:"Логотип: /logo.png или HTTPS URL",value:school.logoUrl,required:true},{name:"navy",label:"Тёмный цвет",type:"color",value:school.navy},{name:"accent",label:"Акцент",type:"color",value:school.accent},{name:"cream",label:"Кремовый цвет",type:"color",value:school.cream},{name:"timezone",label:"Часовой пояс IANA",value:school.timezone,required:true},{name:"dailyLimit",label:"Предел минут в сутки",type:"number",value:school.dailyLimit,min:60,max:1440,required:true},{name:"academicStart",label:"Начало учебного года (ММ-ДД)",value:school.academicStart,required:true},{name:"terms",label:"Четверти: JSON массив 4 пар ММ-ДД",type:"textarea",value:JSON.stringify(school.terms),required:true}]} onSubmit={v=>mutate("updateSchool",{...v,dailyLimit:Number(v.dailyLimit),terms:JSON.parse(v.terms)})}/></div></Panel><Panel title="Департаменты" action={<Button variant="outline" onClick={()=>open({type:"department"})}><Plus size={15}/>Добавить</Button>}>{data.allDepartments.map(d=><div className="padded border-bottom" key={d.id}><strong>{d.name}</strong><p>{d.description}</p></div>)}</Panel><Panel title="Роли школы и назначение руководства"><div className="padded">{data.schoolUsers.map(u=><div className="admin-user-row" key={u.id}><div><strong>{u.name}</strong><small>{u.email} · {statuses[u.globalRole]}</small></div><Button variant="outline" onClick={()=>open({type:"globalRole",id:u.id})}>Назначить</Button></div>)}</div></Panel></>}
  </div>;
}


