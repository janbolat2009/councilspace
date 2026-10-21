"use client";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const isMinifiedReact = error?.message?.includes("Minified React error");
  const displayError = isMinifiedReact
    ? "Произошла внутренняя ошибка сервера или базы данных."
    : error?.message;

  return (
    <main id="main" className="standalone-message">
      <img src="/logo.png" alt="Student Council" />
      <h1>Не удалось загрузить страницу</h1>
      <p>Проверьте подключение к интернету или базе данных и повторите попытку.</p>
      {displayError && (
        <code style={{ background: "#f1f5f9", padding: "8px 12px", borderRadius: "6px", color: "#b91c1c", maxWidth: "90%", wordBreak: "break-all" }}>
          {displayError}
        </code>
      )}
      <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
        <button className="button button-primary" onClick={reset}>Повторить</button>
        <Link className="button button-outline" href="/">На главную</Link>
      </div>
    </main>
  );
}
