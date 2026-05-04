import type { Expense } from "@/features/expenses/api";
import { yyyyMmDdLocal, yyyyMmLocal } from "@/domain/date";
import { expenseCashflowAllocations } from "@/domain/installment";

/**
 * 홈·오늘 타임라인용: `aggregateMode === "cashflow"`일 때 할부를 월 단위 가상 지출로 펼침.
 */
export function buildTodayExpensesDisplay(
  aggregateMode: "usage" | "cashflow",
  dayKey: string,
  allItems: Expense[] | undefined,
  todayExpenses: Expense[]
): Expense[] {
  if (aggregateMode !== "cashflow") return todayExpenses;
  const all = allItems ?? [];
  const targetMonthKey = yyyyMmLocal(new Date(`${dayKey}T00:00:00`));
  const targetYear = Number(targetMonthKey.slice(0, 4));
  const targetMonthIdx = Number(targetMonthKey.slice(5, 7)) - 1;
  const dayNum = Number(dayKey.slice(8, 10));

  const out: Expense[] = [];
  for (const e of all) {
    const occurredAt = new Date(e.occurredAt);
    const isInstallment =
      e.paymentType === "CARD" && !!e.installment && !!e.installmentMonths && e.installmentMonths >= 2;

    if (!isInstallment) {
      if (yyyyMmDdLocal(occurredAt) === dayKey) out.push(e);
      continue;
    }

    const allocs = expenseCashflowAllocations(e);
    const hit = allocs.find((a) => a.monthKey === targetMonthKey);
    if (!hit || hit.amount <= 0) continue;

    const originalDay = occurredAt.getDate();
    const targetLastDay = new Date(targetYear, targetMonthIdx + 1, 0).getDate();
    const anchorDay = Math.max(1, Math.min(targetLastDay, originalDay));
    if (dayNum !== anchorDay) continue;

    const virtDate = new Date(targetYear, targetMonthIdx, anchorDay, occurredAt.getHours(), occurredAt.getMinutes());
    const virt: Expense = {
      ...e,
      id: `${e.id}::cashflow::${targetMonthKey}`,
      amount: hit.amount,
      occurredAt: virtDate.toISOString(),
      endAt: null
    };
    out.push(virt);
  }
  return out.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
}
