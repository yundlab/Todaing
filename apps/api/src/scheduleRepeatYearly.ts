/** KST wall calendar helpers for yearly (anniversary) schedule expansion. */

const TZ = "Asia/Seoul";

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymdKST(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

export function mdKST(d: Date): string {
  return ymdKST(d).slice(5);
}

export function wallHmKST(d: Date): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(d);
  let h = 0;
  let m = 0;
  for (const p of parts) {
    if (p.type === "hour") h = parseInt(p.value, 10);
    if (p.type === "minute") m = parseInt(p.value, 10);
  }
  return { h, m };
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function lastDayOfMonth(y: number, m1to12: number): number {
  return new Date(y, m1to12, 0).getDate();
}

export function yearlyMatchesDayKey(origStart: Date, dayKey: string): boolean {
  const md = mdKST(origStart);
  const qmd = dayKey.slice(5);
  if (md === qmd) return true;
  if (md === "02-29" && qmd === "02-28") {
    const y = parseInt(dayKey.slice(0, 4), 10);
    return !isLeapYear(y);
  }
  return false;
}

/** Instant on `dayKey` (YYYY-MM-DD) KST wall with same clock as `origStart` in KST. */
export function occurrenceStartUtcForDayKey(origStart: Date, dayKey: string): Date | null {
  if (!yearlyMatchesDayKey(origStart, dayKey)) return null;
  const y = parseInt(dayKey.slice(0, 4), 10);
  const mo = parseInt(dayKey.slice(5, 7), 10);
  const d = parseInt(dayKey.slice(8, 10), 10);
  const { h, m } = wallHmKST(origStart);
  return new Date(`${y}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(m)}:00.000+09:00`);
}

/** One occurrence in calendar month `monthKey` (YYYY-MM), or null if anniversary month differs. */
export function occurrenceStartUtcForMonth(origStart: Date, monthKey: string): Date | null {
  const [Y, M] = monthKey.split("-").map((s) => parseInt(s, 10));
  const md = mdKST(origStart);
  const [mPart, dPart] = md.split("-").map((s) => parseInt(s, 10));
  if (mPart !== M) return null;
  const last = lastDayOfMonth(Y, M);
  const d = Math.min(dPart, last);
  const { h, m } = wallHmKST(origStart);
  return new Date(`${Y}-${pad2(M)}-${pad2(d)}T${pad2(h)}:${pad2(m)}:00.000+09:00`);
}

export function shiftEndForYearly(origStart: Date, origEnd: Date | null, newStart: Date): Date | null {
  if (origEnd == null) return null;
  return new Date(newStart.getTime() + (origEnd.getTime() - origStart.getTime()));
}

export type ScheduleRow = {
  id: string;
  startAt: Date;
  endAt: Date | null;
  title: string;
  note: string | null;
  showOnCalendar: boolean;
  repeatYearly: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

export function mergeYearlyIntoDayWindow(
  inRange: ScheduleRow[],
  yearlyRows: ScheduleRow[],
  dayKey: string,
  windowStart: Date,
  windowEnd: Date
): ScheduleRow[] {
  const byKey = new Map<string, ScheduleRow>();
  for (const row of inRange) {
    byKey.set(`${row.id}:${row.startAt.getTime()}`, row);
  }
  for (const row of yearlyRows) {
    const syn = occurrenceStartUtcForDayKey(row.startAt, dayKey);
    if (!syn || syn < windowStart || syn >= windowEnd) continue;
    const key = `${row.id}:${syn.getTime()}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      ...row,
      startAt: syn,
      endAt: shiftEndForYearly(row.startAt, row.endAt, syn)
    });
  }
  return Array.from(byKey.values()).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export function mergeYearlyIntoMonthWindow(
  inRange: ScheduleRow[],
  yearlyRows: ScheduleRow[],
  monthKey: string,
  windowStart: Date,
  windowEnd: Date
): ScheduleRow[] {
  const byKey = new Map<string, ScheduleRow>();
  for (const row of inRange) {
    byKey.set(`${row.id}:${row.startAt.getTime()}`, row);
  }
  for (const row of yearlyRows) {
    const syn = occurrenceStartUtcForMonth(row.startAt, monthKey);
    if (!syn || syn < windowStart || syn >= windowEnd) continue;
    const key = `${row.id}:${syn.getTime()}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      ...row,
      startAt: syn,
      endAt: shiftEndForYearly(row.startAt, row.endAt, syn)
    });
  }
  return Array.from(byKey.values()).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
