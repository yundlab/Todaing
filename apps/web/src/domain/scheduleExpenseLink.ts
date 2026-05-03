import type { Expense } from "../features/expenses/api";
import type { ScheduleItem } from "../features/schedules/api";

/** 일정 시작~끝 구간 안에 occurredAt이 들어오는 지출 (일정+비용 동시 기록 등). 끝 시간 없으면 해당 날 23:59:59까지. */
export function expensesOccurringWithinSchedule(expenses: Expense[], schedule: ScheduleItem): Expense[] {
  const s0 = new Date(schedule.startAt).getTime();
  if (!Number.isFinite(s0)) return [];
  let s1: number;
  if (schedule.endAt) {
    s1 = new Date(schedule.endAt).getTime();
  } else {
    const dayEnd = new Date(schedule.startAt);
    dayEnd.setHours(23, 59, 59, 999);
    s1 = dayEnd.getTime();
  }
  if (!Number.isFinite(s1) || s0 > s1) return [];
  return expenses.filter((e) => {
    const t = new Date(e.occurredAt).getTime();
    return Number.isFinite(t) && t >= s0 && t <= s1;
  });
}
