import type { Metadata } from "next";
import "./globals.css";
import "./accessibility.css";
export const metadata: Metadata = { title: "Council Space — Student Council", description: "Общее пространство школьного совета: идеи, команда, мероприятия и вклад каждого.", icons: { icon: "/logo.png" } };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ru" data-scroll-behavior="smooth" suppressHydrationWarning><body suppressHydrationWarning><a className="skip-link" href="#main">К основному содержимому</a>{children}</body></html>;
}
