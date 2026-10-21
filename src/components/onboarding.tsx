"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ArrowRight, ArrowLeft, GraduationCap, Sparkles } from "lucide-react";
import { Form } from "./forms";
import { Button } from "./ui";
type OnboardingProps = {
  user: { name: string; classroom: string; interests: string; image: string; onboarded?: boolean };
  departments: { id: string; name: string; description: string }[];
};
export function Onboarding({ user, departments }: OnboardingProps) {
  const router = useRouter();
  const [step, setStep] = useState(user.onboarded && user.classroom.trim() ? 2 : 1);
  const [profileState, setProfileState] = useState({ name: user.name, classroom: user.classroom, interests: user.interests });
  const [department, setDepartment] = useState(departments[0]?.id || "");
  async function save(action: string, data: unknown) {
    const response = await fetch("/api/council", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
  }
  return <main id="main" className="onboarding-page">
    <div className="onboarding-header">
      <Link href="/" className="brand"><img src="/logo.png" alt="Student Council"/><span>Council<span>Space<span className="brand-dot">.</span></span></span></Link>
      {user.onboarded && <Link href="/workspace" className="back-link">В личный кабинет →</Link>}
    </div>
    <div className="onboarding-steps" aria-label="Этапы регистрации">
      <span className="done"><Check size={16}/>1. Аккаунт</span>
      <button type="button" className={step === 1 ? "current" : "done"} onClick={() => setStep(1)}>{step > 1 && <Check size={16}/>}2. Профиль</button>
      <span className={step === 2 ? "current" : ""}>3. Заявка в команду</span>
    </div>
    <section className="onboarding-card">
      <div className="onboarding-card-top">
        <span className="onboarding-icon">{step === 1 ? <GraduationCap size={28}/> : <Sparkles size={28}/>}</span>
        {step === 2 && <Button type="button" variant="ghost" onClick={() => setStep(1)}><ArrowLeft size={16}/>Назад к профилю</Button>}
      </div>
      <h1>{step === 1 ? "Расскажи о себе" : "Выбери свой департамент"}</h1>
      <p>{step === 1 ? "Аккаунт успешно создан! Заполни короткую анкету ученика, чтобы продолжить." : "Отправь заявку в департамент совета. Руководство рассмотрит её и откроет доступ к командной работе."}</p>
      {step === 1 ? (
        <Form
          key="step-1"
          fields={[
            { name: "name", label: "Имя и фамилия", value: profileState.name, placeholder: "Как к тебе обращаться?", required: true },
            { name: "classroom", label: "Класс / параллель", value: profileState.classroom, placeholder: "Например, 10 A", required: true },
            { name: "interests", label: "Твои интересы и увлечения", type: "textarea", value: profileState.interests, placeholder: "Наука, дебаты, программирование, организация мероприятий…" }
          ]}
          submitLabel="Сохранить и перейти к выбору команды →"
          onSubmit={async values => {
            await save("saveProfile", { ...values, image: user.image });
            setProfileState({ name: values.name, classroom: values.classroom, interests: values.interests });
            setStep(2);
          }}
        />
      ) : (
        <>
          <label className="field onboarding-department">
            <span>Департамент для вступления</span>
            <select value={department} onChange={e => setDepartment(e.target.value)}>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <small>{departments.find(d => d.id === department)?.description}</small>
          </label>
          {department && (
            <Form
              key="step-2"
              fields={[
                { name: "motivation", label: "Почему ты хочешь присоединиться к команде?", type: "textarea", placeholder: "Расскажи в 2–3 предложениях о своей цели…", required: true },
                { name: "direction", label: "Какое направление тебе ближе?", required: true, placeholder: "Интеллектуальные игры, наука, дебаты, медиа…" },
                { name: "skills", label: "Твои сильные стороны и навыки", required: true, placeholder: "Организация, дизайн, тексты, выступления…" },
                { name: "weeklyHours", label: "Сколько часов в неделю готов(а) уделять?", type: "number", min: 1, max: 40, value: 3, required: true },
                { name: "idea", label: "Твоя идея мероприятия для школы", type: "textarea", placeholder: "Опиши одну идею турнира, встречи или проекта…", required: true }
              ]}
              submitLabel="Отправить заявку в департамент"
              onSubmit={async values => {
                try {
                  await save("apply", { ...values, departmentId: department, weeklyHours: Number(values.weeklyHours) });
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "";
                  if (!msg.includes("уже существует") && !msg.includes("уже есть членство")) throw err;
                }
                router.replace("/workspace?view=profile");
                router.refresh();
              }}
            />
          )}
          <Button asChild variant="outline" className="onboarding-later">
            <Link href="/workspace?view=profile">Заполнить заявку позже — перейти в кабинет <ArrowRight size={17}/></Link>
          </Button>
        </>
      )}
    </section>
  </main>;
}
