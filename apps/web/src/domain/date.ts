export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function yyyyMmDdLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function yyyyMmLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function dateFromSlotMinutes(dayLocal00: Date, minutes: number) {
  const d = new Date(dayLocal00);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function timeRangeLabel(startAt: string, endAt: string) {
  const s = new Date(startAt);
  const e = new Date(endAt);
  return `${pad2(s.getHours())}:${pad2(s.getMinutes())}~${pad2(e.getHours())}:${pad2(
    e.getMinutes()
  )}`;
}

export function expenseTimeLabel(occurredAt: string, baseDayLocal00: Date) {
  const d = new Date(occurredAt);
  const diffMin = Math.round((d.getTime() - baseDayLocal00.getTime()) / 60000);
  if (diffMin >= 24 * 60) {
    const hh = Math.floor(diffMin / 60);
    const mm = diffMin % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
  }
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

