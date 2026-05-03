import type { Expense } from "@/features/expenses/api";
import { yyyyMmDdLocal } from "@/domain/date";

const CASHFLOW_VIRTUAL_ID_MARKER = "::cashflow::";

/** DB/API에 쓰는 지출 id. 할부 현금흐름 뷰용 가상 id(`…::cashflow::YYYY-MM`)는 앞부분만 반환. */
export function expensePersistedId(e: Pick<Expense, "id">): string {
  const id = String(e.id || "");
  if (!id.includes(CASHFLOW_VIRTUAL_ID_MARKER)) return id;
  return id.split(CASHFLOW_VIRTUAL_ID_MARKER)[0] ?? id;
}

/** 결제일과 실제 사용일(plannedAt)의 날짜가 다를 때만 사용일 dayKey(YYYY-MM-DD). 같거나 없으면 null. */
export function plannedUsageDayKeyWhenDiffers(e: Expense): string | null {
  if (!e.plannedAt) return null;
  const planned = yyyyMmDdLocal(new Date(e.plannedAt));
  const occ = yyyyMmDdLocal(new Date(e.occurredAt));
  return planned !== occ ? planned : null;
}

export function isUsageDayDifferent(e: Expense, currentDayKey: string) {
  if (!e.plannedAt) return false;
  const plannedDay = yyyyMmDdLocal(new Date(e.plannedAt));
  return plannedDay !== currentDayKey;
}
