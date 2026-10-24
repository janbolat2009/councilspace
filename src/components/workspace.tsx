"use client";
import { useState, useEffect, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { motion, useReducedMotion } from "motion/react";
import { LayoutDashboard, CheckSquare, CalendarDays, MessageSquare, Trophy, Users, FileText, Bell, Settings, ClipboardCheck, UserPlus, ScrollText, Search, ChevronDown, Plus, ArrowUpRight, Menu, X, LogOut, ChevronRight, GraduationCap, Sparkles, CircleHelp } from "lucide-react";
import type { WorkspaceData } from "@/server/queries";
import { t } from "@/lib/i18n";
import { Avatar, Button, cn, statuses } from "./ui";
import { WorkspaceContext, type ModalState } from "./workspace-context";
import { Overview, TasksPanel, EventsPanel, CalendarPanel, ReportsPanel, MembersPanel, LeaderboardPanel, ApplicationsPanel, NotificationsPanel, AuditPanel, ProfilePanel, SettingsPanel } from "./workspace-panels";
import { WorkspaceModals } from "./workspace-modals";
import { ChatPanel } from "./workspace-chat";
const nav = [{ id: "overview", icon: LayoutDashboard }, { id: "tasks", icon: CheckSquare }, { id: "events", icon: CalendarDays }, { id: "calendar", icon: CalendarDays }, { id: "chat", icon: MessageSquare }, { id: "leaderboard", icon: Trophy }, { id: "members", icon: Users }, { id: "reports", icon: FileText }];
const management = [{ id: "applications", icon: UserPlus }, { id: "review", icon: ClipboardCheck }, { id: "audit", icon: ScrollText }, { id: "settings", icon: Settings }];
export function Workspace({ initialData, view, demo = false }: { initialData: WorkspaceData; view: string; demo?: boolean }) {
  const router = useRouter(), [pending,startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  const [currentView,setCurrentView] = useState(view);
  const [modal,setModal] = useState<ModalState>(null), [search,setSearch] = useState(""), [mobile,setMobile] = useState(false), [toast,setToast] = useState(""), [createMenu,setCreateMenu] = useState(false);
  const [smallScreen,setSmallScreen] = useState(false);
  useEffect(() => { setCurrentView(view); }, [view]);
  useEffect(() => {
    const media=window.matchMedia("(max-width: 800px)");
    const update=()=>setSmallScreen(media.matches);update();media.addEventListener("change",update);
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setMobile(false);setCreateMenu(false);}};
    const onPopState=()=>{const params=new URLSearchParams(window.location.search);setCurrentView(params.get("view")||"overview");};
    document.addEventListener("keydown",escape);
    window.addEventListener("popstate",onPopState);
    return()=>{media.removeEventListener("change",update);document.removeEventListener("keydown",escape);window.removeEventListener("popstate",onPopState);};
  },[]);
  const data = initialData;
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 4000); return () => clearTimeout(timer); }, [toast]);
  function navigate(next: string, extra: Record<string,string> = {}) {
    if (!data.department && !["profile", "notifications"].includes(next)) {
      setMobile(false);
      setToast("Раздел откроется после одобрения вашей заявки в департамент");
      setCurrentView("profile");
      if (typeof window !== "undefined") window.history.pushState(null, "", `${demo ? "/demo" : "/workspace"}?view=profile`);
      return;
    }
    const targetDept = extra.department ?? data.department?.id ?? "";
    const needsServerFetch = Boolean(
      (extra.department && extra.department !== data.department?.id) ||
      (extra.period && extra.period !== data.period) ||
      (extra.sort && extra.sort !== data.sort) ||
      extra.from ||
      extra.to
    );
    const params = new URLSearchParams({ view: next, ...(targetDept ? { department: targetDept } : {}), ...extra });
    const nextUrl = `${demo ? "/demo" : "/workspace"}?${params}`;
    setMobile(false); setSearch(""); setCurrentView(next);
    if (needsServerFetch) {
      startTransition(() => router.push(nextUrl));
    } else if (typeof window !== "undefined") {
      window.history.pushState(null, "", nextUrl);
    }
  }
  async function mutate(action: string, input: unknown) {
    if (demo) throw new Error("Это обзор демоданных. Войдите в аккаунт, чтобы работать с командой.");
    const response = await fetch("/api/council", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data: input }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Не удалось сохранить.");
    setToast("Изменения сохранены"); startTransition(() => router.refresh());
  }
  const unread = data.notifications.filter(n => !n.readAt).length;
  const activeView = !data.department && !["profile","notifications"].includes(currentView) ? "profile" : currentView;
  const views: Record<string, React.ReactNode> = { overview:<Overview/>, tasks:<TasksPanel/>, events:<EventsPanel/>, calendar:<CalendarPanel/>, chat:<ChatPanel/>, leaderboard:<LeaderboardPanel/>, members:<MembersPanel/>, reports:<ReportsPanel/>, review:<ReportsPanel review/>, applications:<ApplicationsPanel/>, notifications:<NotificationsPanel/>, audit:<AuditPanel/>, profile:<ProfilePanel/>, settings:<SettingsPanel/> };
  const style = { "--navy": data.school.navy, "--accent": data.school.accent, "--cream": data.school.cream } as CSSProperties;
  const roleCaption = demo ? "Демонстрационный профиль" : ["PRESIDENT", "VICE_PRESIDENT", "PRIME_MINISTER", "COUNSELOR"].includes(data.user.globalRole) ? statuses[data.user.globalRole] : data.manager ? "Руководство департамента" : "Личный кабинет";

  return <WorkspaceContext.Provider value={{ data, demo, mutate, open:setModal, navigate, search }}><div className="app-shell" style={style}>
    {mobile && <button className="sidebar-backdrop" aria-label="Закрыть навигацию" onClick={() => setMobile(false)}/>}
    <aside id="workspace-sidebar" className={cn("sidebar", mobile && "mobile-open")} inert={smallScreen && !mobile}>
      <button className="sidebar-mobile-close icon-button" aria-label="Закрыть меню" onClick={()=>setMobile(false)}><X size={22}/></button>
      <Link href="/" className="brand"><img src={data.school.logoUrl} alt="Логотип Student Council"/><span>Council<span>Space<span className="brand-dot">.</span></span></span></Link>
      <div className="school-caption">STUDENT COUNCIL <span>2026–2027</span></div>
      <div className="department-picker"><span className="department-icon"><GraduationCap size={22}/></span><div><small>Департамент</small><select aria-label="Департамент" value={data.department?.id || ""} onChange={e => navigate("overview",{ department:e.target.value })}>{!data.departments.length && <option value="">Выберите команду</option>}{data.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div><ChevronDown size={14}/></div>
      <div className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav aria-label="Основная навигация">{nav.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={cn("nav-item", activeView === item.id && "active")} aria-current={activeView === item.id ? "page" : undefined}><item.icon size={18}/><span>{t(item.id)}</span>{item.id === "chat" && data.channels.some(c => c.unread) && <span className="nav-dot"/>}</button>)}</nav>
      {data.manager && <><div className="nav-caption">УПРАВЛЕНИЕ</div><nav aria-label="Управление">{management.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={cn("nav-item", activeView === item.id && "active")}><item.icon size={18}/><span>{t(item.id)}</span>{item.id === "applications" && data.stats.applications > 0 && <span className="nav-count">{data.stats.applications}</span>}{item.id === "review" && data.stats.pending > 0 && <span className="nav-count">{data.stats.pending}</span>}</button>)}</nav></>}
      <div className="sidebar-bottom"><div className="sidebar-note"><Sparkles size={17}/><p>Маленькие шаги.<br/><strong>Большое влияние.</strong></p><span>Вместе создаём школьную жизнь</span></div>
      <button className="profile-button" onClick={() => navigate("profile")}><Avatar name={data.user.name} image={data.user.image}/><span><strong>{data.user.name?.replace("Демо · ","")}</strong><small>{roleCaption}</small></span><ChevronRight size={16}/></button></div>
    </aside>
    <div className="workspace-main">
      <header className="topbar"><button className="icon-button mobile-toggle" aria-label="Открыть меню" onClick={() => setMobile(true)}><Menu size={22}/></button><div className="breadcrumb">Рабочее пространство<ChevronRight size={13}/><strong>{t(activeView)}</strong></div><div className="topbar-right"><label className="search"><Search size={16}/><input aria-label="Поиск в текущем разделе" placeholder="Поиск в разделе…" value={search} onChange={e => setSearch(e.target.value)}/><kbd>⌕</kbd></label><button className="icon-button notification-button" aria-label={`Уведомления: ${unread}`} onClick={() => navigate("notifications")}><Bell size={20}/>{unread > 0 && <span/>}</button><button className="icon-button help-button" aria-label="О платформе" onClick={() => setModal({type:"help"})}><CircleHelp size={19}/></button><span className="topbar-divider"/><button className="icon-button topbar-avatar-btn" aria-label="Мой профиль" onClick={() => navigate("profile")}><Avatar name={data.user.name} image={data.user.image} small/></button></div></header>
      {demo && <div className="demo-banner"><span><span className="live-dot"/>Демопространство · все профили и события вымышленные</span><Link href="/login">Войти в Council Space <ArrowUpRight size={14}/></Link></div>}
      <main id="main" className={cn("workspace-content", pending && "loading-page")} aria-busy={pending}>
        <div className="page-heading"><div><div className="eyebrow">{data.department?.name || "COUNCIL SPACE"}</div><h1>{activeView === "overview" ? "Обзор департамента" : t(activeView)}</h1><p>{activeView === "overview" ? "Всё, что нужно для больших идей и слаженной работы." : activeView === "leaderboard" ? "Каждый вклад важен. Здесь — результаты подтверждённой работы." : activeView === "chat" ? "Обсуждаем идеи, делимся прогрессом, остаёмся на связи." : "Общее пространство. Понятные задачи. Видимый вклад."}</p></div>
        {data.department && <div className="create-wrap"><Button onClick={() => setCreateMenu(!createMenu)} aria-expanded={createMenu}><Plus size={17}/>Создать<ChevronDown size={14}/></Button>{createMenu && <div className="create-menu">{[["task","Новая задача",CheckSquare],["event","Новое мероприятие",CalendarDays],["report","Отчёт о работе",FileText]].map(([type,label,Icon]) => {const I = Icon as typeof Plus; return <button key={String(type)} onClick={() => {setModal({type:String(type)});setCreateMenu(false);}}><I size={17}/>{String(label)}</button>;})}</div>}</div>}</div>
        <motion.div key={activeView} initial={reduceMotion ? false : { opacity:0, y:5 }} animate={{opacity:1,y:0}} transition={{duration:.14}}>{views[activeView] ?? <Overview/>}</motion.div>
        <footer className="workspace-footer"><span>Council Space <span>·</span> Вместе делаем больше.</span><span>{data.school.timezone}<span>·</span>{demo ? "Обзор демоданных" : "Рабочее пространство"}</span><button onClick={() => signOut({callbackUrl:"/"})}><LogOut size={13}/>Выйти</button></footer>
      </main>
    </div>
    <nav className="mobile-bottom-nav" aria-label="Быстрые разделы">
      {[{id:"overview",label:"Обзор",icon:LayoutDashboard},{id:"tasks",label:"Задачи",icon:CheckSquare},{id:"calendar",label:"Календарь",icon:CalendarDays},{id:"chat",label:"Чат",icon:MessageSquare}].map(item=><button key={item.id} aria-current={activeView===item.id?"page":undefined} onClick={()=>navigate(item.id)}><item.icon size={22}/><span>{item.label}</span></button>)}
      <button aria-label="Открыть все разделы" aria-expanded={mobile} aria-controls="workspace-sidebar" onClick={()=>setMobile(!mobile)}><Menu size={22}/><span>Ещё</span></button>
    </nav>
    <WorkspaceModals modal={modal} close={() => setModal(null)}/>
    {toast && <div className="toast" role="status"><ClipboardCheck size={18}/>{toast}<button aria-label="Закрыть сообщение" onClick={() => setToast("")}><X size={15}/></button></div>}
  </div></WorkspaceContext.Provider>;
}
