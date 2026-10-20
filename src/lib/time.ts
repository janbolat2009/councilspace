import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
export function schoolDate(date: Date, timezone: string) { return formatInTimeZone(date, timezone, "yyyy-MM-dd"); }
export function localToUtc(value: string, timezone: string) { return fromZonedTime(value, timezone).toISOString(); }
export function displayDate(value: string | Date, timezone = "Asia/Qyzylorda", withTime = false) {
  return formatInTimeZone(new Date(value), timezone, withTime ? "dd.MM.yyyy · HH:mm" : "dd.MM.yyyy");
}
export function periodBounds(period: string, school: { timezone: string; academicStart: string; terms: unknown }, now = new Date()) {
  const today = schoolDate(now, school.timezone);
  const year = Number(today.slice(0, 4)), monthDay = today.slice(5);
  if (period === "year") {
    const startYear = monthDay >= school.academicStart ? year : year - 1;
    return { from: `${startYear}-${school.academicStart}`, to: new Date(Date.UTC(startYear + 1, Number(school.academicStart.slice(0, 2)) - 1, Number(school.academicStart.slice(3)) - 1)).toISOString().slice(0, 10) };
  }
  if (period === "quarter") {
    const terms = school.terms as [string, string][];
    const term = terms.find(([start, end]) => start <= end ? monthDay >= start && monthDay <= end : monthDay >= start || monthDay <= end);
    if (term) {
      const wraps = term[0] > term[1];
      return { from: `${wraps && monthDay <= term[1] ? year - 1 : year}-${term[0]}`, to: `${wraps && monthDay >= term[0] ? year + 1 : year}-${term[1]}` };
    }
  }
  return { from: `${today.slice(0, 7)}-01`, to: new Date(Date.UTC(year, Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10) };
}
