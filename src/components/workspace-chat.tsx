"use client";
import { useEffect, useState, useRef } from "react";
import { Hash, Megaphone, Send, Reply, Pencil, Trash2, X, Loader2 } from "lucide-react";
import type { readChat } from "@/server/chat";
import type { Serialized } from "@/lib/policy";
import { useWorkspace } from "./workspace-context";
import { Avatar, Button, cn, Empty, Modal } from "./ui";
import { Form } from "./forms";
import { displayDate } from "@/lib/time";
type ChatResponse=Serialized<Awaited<ReturnType<typeof readChat>>>;
type ChatMessage=ChatResponse["messages"][number];
export function ChatPanel(){
  const {data,demo,mutate}=useWorkspace();
  const [channel,setChannel]=useState(data.channels[0]?.id||""),[messages,setMessages]=useState<ChatMessage[]>([]),[text,setText]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[more,setMore]=useState(false),[reply,setReply]=useState<ChatMessage|null>(null),[edit,setEdit]=useState<{message:ChatMessage;remove:boolean}|null>(null),[refresh,setRefresh]=useState(0);
  const newest=useRef("0"),watermark=useRef(""),lastRead=useRef("0"),end=useRef<HTMLDivElement>(null);
  const selected=data.channels.find(c=>c.id===channel);
  const endpoint=demo?"/api/demo/chat":"/api/council";
  useEffect(()=>{
    let alive=true,busy=false;
    const abort=new AbortController();
    newest.current="0";watermark.current="";lastRead.current="0";setMessages([]);setLoading(true);setReply(null);
    async function sync(initial=false){
      if(busy||!channel||(!initial&&document.visibilityState==="hidden"))return;
      busy=true;
      try{
        const params=new URLSearchParams({resource:"chat",channel,...(newest.current!=="0"?{after:newest.current,since:watermark.current}:{})});
        const response=await fetch(`${endpoint}?${params}`,{signal:abort.signal,cache:"no-store"});
        const body=await response.json();
        if(!response.ok){if(response.status===403||response.status===401){setMessages([]);newest.current="0";}throw new Error(body.error);}
        const payload=body as ChatResponse;
        if(!alive)return;
        if(initial)setMore(payload.hasMore);
        setMessages(previous=>{
          const map=new Map(previous.map(m=>[m.id,m]));
          for(const m of [...payload.messages,...payload.changes])map.set(m.id,m);
          return [...map.values()].sort((a,b)=>BigInt(a.sequence)<BigInt(b.sequence)?-1:1);
        });
        if(payload.messages.length)newest.current=payload.messages.at(-1)!.sequence;
        // If a page is full, retain the old watermark until all new messages are consumed.
        if(!payload.hasMore||initial)watermark.current=payload.watermark;
        setError("");
        if(!demo&&newest.current!=="0"&&lastRead.current!==newest.current){
          const read=await fetch("/api/council",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"markChannelRead",data:{channelId:channel,sequence:newest.current}})});
          if(read.ok)lastRead.current=newest.current;
        }
      }catch(e){if(alive&&!(e instanceof Error&&e.name==="AbortError"))setError(e instanceof Error?e.message:"Не удалось загрузить сообщения.");}
      finally{busy=false;if(alive)setLoading(false);}
    }
    void sync(true);
    const timer=setInterval(()=>void sync(),5000);
    return()=>{alive=false;abort.abort();clearInterval(timer);};
  },[channel,demo,endpoint,refresh]);
  async function history(){
    try{const response=await fetch(`${endpoint}?${new URLSearchParams({resource:"chat",channel,before:messages[0]?.sequence||"0"})}`);const body=await response.json();if(!response.ok)throw new Error(body.error);const payload=body as ChatResponse;setMessages(previous=>[...payload.messages,...previous]);setMore(payload.hasMore);}catch(e){setError((e as Error).message);}
  }
  async function send(e:React.FormEvent){
    e.preventDefault();if(sending||!text.trim())return;setSending(true);
    try{await mutate("sendMessage",{channelId:channel,text,replyToId:reply?.id||null});setText("");setReply(null);setRefresh(n=>n+1);}catch(e){setError((e as Error).message);}finally{setSending(false);}
  }
  return <div className="chat-layout"><aside className="chat-channels"><h3>Каналы департамента</h3>{data.channels.map(c=><button className={cn(c.id===channel&&"active")} key={c.id} onClick={()=>setChannel(c.id)}>{c.announcements?<Megaphone size={17}/>:<Hash size={18}/>}<span>{c.name}</span>{c.unread>0&&<small>{c.unread}</small>}</button>)}<p>Сообщения сохраняются в базе. Обновление каждые 5 секунд.</p></aside><section className="chat-room"><header><Hash size={21}/><h2>{selected?.name||"Выберите канал"}</h2><span>Только команда</span></header><div className="chat-messages" aria-live="polite">{more&&<Button variant="ghost" onClick={history}>Загрузить предыдущие</Button>}{loading?<div className="empty"><Loader2 className="spin"/>Загружаем сообщения…</div>:!messages.length?<Empty title="Начните разговор">Идеи становятся лучше, когда мы делимся ими.</Empty>:messages.map(m=><article className={cn("chat-message",m.userId===data.user.id&&"own")} key={m.id}><Avatar name={m.user.name} image={m.user.image}/><div className="message-content"><div className="message-author"><strong>{m.user.name}</strong><small>{displayDate(m.createdAt,data.school.timezone,true)}{m.editedAt&&" · изменено"}</small></div>{m.replyTo&&<blockquote>{m.replyTo.user.name}: {m.replyTo.deletedAt?"Сообщение удалено":m.replyTo.text}</blockquote>}<p className={m.deletedAt?"muted":""}>{m.deletedAt?"Сообщение удалено":m.text}</p>{!m.deletedAt&&<div className="message-actions"><button onClick={()=>setReply(m)}><Reply size={13}/>Ответить</button>{m.userId===data.user.id&&<button onClick={()=>setEdit({message:m,remove:false})}><Pencil size={13}/>Изменить</button>}{(m.userId===data.user.id||data.manager)&&<button onClick={()=>setEdit({message:m,remove:true})}><Trash2 size={13}/>Удалить</button>}</div>}</div></article>)}<div ref={end}/></div>{error&&<div className="chat-error" role="alert">{error}<button onClick={()=>setRefresh(n=>n+1)}>Повторить</button></div>}{reply&&<div className="reply-preview">Ответ: {reply.text.slice(0,120)}<button aria-label="Отменить ответ" onClick={()=>setReply(null)}><X size={15}/></button></div>}{selected?.announcements&&!data.manager?<div className="chat-readonly">В этом канале публикует только руководство.</div>:<form className="chat-composer" onSubmit={send}><textarea aria-label="Сообщение" placeholder={demo?"Демопросмотр · для отправки войдите в аккаунт":"Напишите команде…"} value={text} onChange={e=>setText(e.target.value)} maxLength={3000} rows={2} disabled={sending}/><Button type="submit" disabled={sending||!text.trim()} aria-label="Отправить сообщение"><Send size={19}/></Button><small>{text.length}/3000 · Shift + Enter для новой строки</small></form>}</section>{edit&&<Modal title={edit.remove?"Удалить сообщение?":"Редактировать сообщение"} description={edit.remove?"Удалённое сообщение заменится отметкой об удалении. Действие модератора попадёт в журнал.":"Изменение будет отмечено рядом со временем сообщения."} open onClose={()=>setEdit(null)}><Form fields={edit.remove?[{name:"reason",label:"Причина",required:edit.message.userId!==data.user.id}]:[{name:"text",label:"Сообщение",type:"textarea",required:true,value:edit.message.text}]} onSubmit={async v=>{await mutate("editMessage",{id:edit.message.id,remove:edit.remove,...v});setEdit(null);setRefresh(n=>n+1);}} submitLabel={edit.remove?"Подтвердить удаление":"Сохранить"}/></Modal>}</div>;
}
