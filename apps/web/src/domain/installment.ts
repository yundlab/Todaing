import type { Expense } from "../features/expenses/api";
import { yyyyMmDdLocal, yyyyMmLocal } from "./date";
import { myShareAmountForMe } from "./settlement";

export type AggregateMode = "usage" | "cashflow";

export const AGGREGATE_MODE_LS_KEY = "aggregateMode.v1";

/**
 * 할부 결제건을 결제월부터 N개월 균등 분할.
 * 반올림 보정은 마지막 달에 처리하여 합이 원금과 정확히 일치하도록 함.
 */
export function allocateInstallmentByMonth(
  amount: number,
  months: number,
  occurredAt: Date | string
): Array<{ monthKey: string; amount: number }> {
  const total = Math.max(0, Math.floor(Number(amount) || 0));
  const n = Math.max(1, Math.floor(Number(months) || 1));
  const start = typeof occurredAt === "string" ? new Date(occurredAt) : occurredAt;
  const baseY = start.getFullYear();
  const baseM = start.getMonth(); // 0-indexed

  if (n <= 1) {
    return [{ monthKey: yyyyMmLocal(start), amount: total }];
  }

  const each = Math.floor(total / n);
  const out: Array<{ monthKey: string; amount: number }> = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(baseY, baseM + i, 1);
    const monthKey = yyyyMmLocal(d);
    if (i < n - 1) {
      out.push({ monthKey, amount: each });
      acc += each;
    } else {
      out.push({ monthKey, amount: total - acc });
    }
  }
  return out;
}

/** 단일 지출이 “실출금 기준”으로 어떤 monthKey에 얼마씩 잡혀야 하는지 반환. 비할부는 결제월 1건. */
export function expenseCashflowAllocations(e: Expense): Array<{ monthKey: string; amount: number }> {
  const total = Math.max(0, Math.floor(Number(e.amount) || 0));
  if (total <= 0) return [];
  const occurredAt = new Date(e.occurredAt);
  if (e.paymentType === "CARD" && e.installment && e.installmentMonths && e.installmentMonths >= 2) {
    return allocateInstallmentByMonth(total, e.installmentMonths, occurredAt);
  }
  return [{ monthKey: yyyyMmLocal(occurredAt), amount: total }];
}

/** “나” 몫 기준 실출금 분할(공동지출은 1/N 후 분할). */
export function expenseCashflowAllocationsForMe(
  e: Expense,
  me: string
): Array<{ monthKey: string; amount: number }> {
  const myShare = Math.max(0, Math.round(myShareAmountForMe(e, me)));
  if (myShare <= 0) return [];
  const occurredAt = new Date(e.occurredAt);
  if (e.paymentType === "CARD" && e.installment && e.installmentMonths && e.installmentMonths >= 2) {
    return allocateInstallmentByMonth(myShare, e.installmentMonths, occurredAt);
  }
  return [{ monthKey: yyyyMmLocal(occurredAt), amount: myShare }];
}

/** 한 달 합계: 모드에 따라 다르게 계산. */
export function sumExpensesForMonth(
  mode: AggregateMode,
  expenses: Expense[],
  monthKey: string,
  opts?: { onlyMine?: boolean; me?: string }
): number {
  const me = opts?.me ?? "나";
  const onlyMine = !!opts?.onlyMine;
  if (mode === "usage") {
    let sum = 0;
    for (const e of expenses) {
      const d = new Date(e.occurredAt);
      if (yyyyMmLocal(d) !== monthKey) continue;
      sum += onlyMine ? myShareAmountForMe(e, me) : Number(e.amount) || 0;
    }
    return sum;
  }
  // cashflow
  let sum = 0;
  for (const e of expenses) {
    const allocs = onlyMine ? expenseCashflowAllocationsForMe(e, me) : expenseCashflowAllocations(e);
    for (const a of allocs) {
      if (a.monthKey === monthKey) sum += a.amount;
    }
  }
  return sum;
}

/** 한 달의 “해당 일까지” 누적 합계 (메인 페이지의 month-to-date 계산용). */
export function sumExpensesForMonthToDate(
  mode: AggregateMode,
  expenses: Expense[],
  monthKey: string,
  dayKey: string,
  opts?: { onlyMine?: boolean; me?: string }
): number {
  const me = opts?.me ?? "나";
  const onlyMine = !!opts?.onlyMine;
  if (mode === "usage") {
    let sum = 0;
    for (const e of expenses) {
      const d = new Date(e.occurredAt);
      if (yyyyMmLocal(d) !== monthKey) continue;
      if (yyyyMmDdLocal(d) > dayKey) continue;
      sum += onlyMine ? myShareAmountForMe(e, me) : Number(e.amount) || 0;
    }
    return sum;
  }
  // cashflow: 할부의 "이번달 분"은 일자가 따로 없으므로 다음 규칙 적용
  // - 결제월(occurredAt 월) === monthKey 인 경우: occurredAt 일자가 dayKey 이하일 때만 그 달 분배액 포함
  // - 결제월보다 미래 달의 분배: 그 달이 monthKey와 같으면 “해당 달의 1일부터 잡혀있다”고 간주(=dayKey와 무관하게 포함)
  let sum = 0;
  for (const e of expenses) {
    const allocs = onlyMine ? expenseCashflowAllocationsForMe(e, me) : expenseCashflowAllocations(e);
    if (!allocs.length) continue;
    const occurredDay = yyyyMmDdLocal(new Date(e.occurredAt));
    const occurredMonth = yyyyMmLocal(new Date(e.occurredAt));
    for (const a of allocs) {
      if (a.monthKey !== monthKey) continue;
      if (a.monthKey === occurredMonth) {
        if (occurredDay <= dayKey) sum += a.amount;
      } else {
        sum += a.amount;
      }
    }
  }
  return sum;
}

/** 일별 합계: 사용액 모드는 결제일에 전액, 실출금 모드도 일 단위는 “결제일 표기” 유지(통장 출금일 별도 모델 없음) */
export function sumExpensesForDay(
  _mode: AggregateMode,
  expenses: Expense[],
  dayKey: string,
  opts?: { onlyMine?: boolean; me?: string }
): number {
  const me = opts?.me ?? "나";
  const onlyMine = !!opts?.onlyMine;
  let sum = 0;
  for (const e of expenses) {
    const d = new Date(e.occurredAt);
    if (yyyyMmDdLocal(d) !== dayKey) continue;
    sum += onlyMine ? myShareAmountForMe(e, me) : Number(e.amount) || 0;
  }
  return sum;
}

/** 달력 셀용: 일자별 합계 Map. 사용액=결제일 전액. 실출금=각 분배월의 1일에 누적(달력은 월 단위 의미). */
export function spendByDayForCalendar(
  mode: AggregateMode,
  expenses: Expense[],
  monthKey: string
): Map<string, number> {
  const byDay = new Map<string, number>();
  if (mode === "usage") {
    for (const e of expenses) {
      const d = new Date(e.occurredAt);
      if (yyyyMmLocal(d) !== monthKey) continue;
      const day = yyyyMmDdLocal(d);
      byDay.set(day, (byDay.get(day) ?? 0) + (Number(e.amount) || 0));
    }
    return byDay;
  }
  // cashflow
  for (const e of expenses) {
    const allocs = expenseCashflowAllocations(e);
    if (!allocs.length) continue;
    const occurredMonth = yyyyMmLocal(new Date(e.occurredAt));
    for (const a of allocs) {
      if (a.monthKey !== monthKey) continue;
      let day: string;
      if (a.monthKey === occurredMonth) {
        day = yyyyMmDdLocal(new Date(e.occurredAt));
      } else {
        day = `${monthKey}-01`;
      }
      byDay.set(day, (byDay.get(day) ?? 0) + a.amount);
    }
  }
  return byDay;
}
