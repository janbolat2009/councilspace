export const locales = ["ru", "kk", "en"] as const;
export type Locale = typeof locales[number];
// Add kk/en dictionaries here; Russian remains the explicit fallback.
export const dictionaries: Record<Locale, Record<string, string>> = {
  ru: { overview: "Обзор", tasks: "Задачи", events: "Мероприятия", calendar: "Календарь", chat: "Командный чат", leaderboard: "Лидерборд", members: "Команда", reports: "Мои отчёты", applications: "Заявки", review: "Проверка отчётов", notifications: "Уведомления", settings: "Настройки", audit: "Журнал действий", profile: "Мой профиль" },
  kk: {}, en: {}
};
export function t(key: string, locale: Locale = "ru") { return dictionaries[locale][key] ?? dictionaries.ru[key] ?? key; }
