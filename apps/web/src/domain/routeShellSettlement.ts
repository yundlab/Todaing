import type { Expense } from "@/features/expenses/api";
import { yyyyMmDdLocal } from "@/domain/date";
import { settlementDeltaForMe, myShareAmountForMe } from "@/domain/settlement";

export function computeSettlementToday(todayExpenses: Expense[]) {
  const me = "나";
  let iPay = 0;
  let iReceive = 0;
  const perPerson = new Map<string, number>();
  for (const e of todayExpenses) {
    const d = settlementDeltaForMe(e, me);
    iPay += d.iPay;
    iReceive += d.iReceive;
    for (const [name, amt] of d.perPerson.entries()) {
      perPerson.set(name, (perPerson.get(name) ?? 0) + amt);
    }
  }
  return { me, iPay, iReceive, perPerson };
}

export function computeSettlementAllByDay(all: Expense[]) {
  const me = "나";
  const byDay = new Map<string, Map<string, number>>();
  for (const e of all) {
    const day = yyyyMmDdLocal(new Date(e.occurredAt));
    const d = settlementDeltaForMe(e, me);
    if (!d.perPerson.size) continue;
    const per = byDay.get(day) ?? new Map<string, number>();
    for (const [name, amt] of d.perPerson.entries()) {
      per.set(name, (per.get(name) ?? 0) + amt);
    }
    if (per.size) byDay.set(day, per);
  }
  for (const [day, per] of Array.from(byDay.entries())) {
    const cleaned = new Map(Array.from(per.entries()).filter(([, amt]) => Math.abs(amt) > 0.0001));
    if (cleaned.size) byDay.set(day, cleaned);
    else byDay.delete(day);
  }
  return byDay;
}

export function computeMyTodayTotal(todayExpenses: Expense[], me = "나") {
  return todayExpenses.reduce((sum, e) => sum + myShareAmountForMe(e, me), 0);
}
