import type { Expense } from "../features/expenses/api";
import { yyyyMmDdLocal } from "./date";

export function isUsageDayDifferent(e: Expense, currentDayKey: string) {
  if (!e.plannedAt) return false;
  const plannedDay = yyyyMmDdLocal(new Date(e.plannedAt));
  return plannedDay !== currentDayKey;
}
