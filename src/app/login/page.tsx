import Link from "next/link";
import { Login } from "@/components/login";
import { devLogin } from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const {error}=await searchParams;
  return <main id="main" className="login-page"><section className="login-brand"><Link href="/" className="brand"><img src="/logo.png" alt="Логотип Student Council"/><span>Council<span>Space.</span></span></Link><div><span className="eyebrow">STUDENT COUNCIL</span><h2>Одна команда.<br/>Много возможностей.</h2><p>Учиться. Придумывать. Организовывать.<br/>И оставлять свой след.</p><img className="login-emblem" src="/logo.png" alt=""/></div><span>Intellectual Development Department</span></section><section><Link href="/" className="back-link">← На главную</Link><Login google={!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET)} local={devLogin} error={error}/></section></main>;
}
