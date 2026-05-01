import type { ReactNode } from "react";
import type { Expense } from "../features/expenses/api";
import { yyyyMmDdLocal, yyyyMmLocal } from "../domain/date";
import {
  CATEGORY_GROUPS,
  emojiForCategory,
  GROUP_LABEL_STYLE,
  normalizeCategory
} from "../domain/categoryUi";
import { formatWon, myShareAmountForMe, settlementDeltaForMe } from "../domain/settlement";

export type MonthDetailViewProps = {
  header: ReactNode;
  settlementDialog: ReactNode;
  expenses: Expense[] | undefined;
  monthKey: string;
  monthlyBudgetWon: number;
  me: string;
  // eslint-disable-next-line no-unused-vars -- documented callback params
  isNetSettledForDay: (day: string, name: string) => boolean;
  // eslint-disable-next-line no-unused-vars
  requestToggleNetSettledForDay: (day: string, name: string) => void;
};

export function MonthDetailView({
  header,
  settlementDialog,
  expenses,
  monthKey,
  monthlyBudgetWon,
  me,
  isNetSettledForDay,
  requestToggleNetSettledForDay
}: MonthDetailViewProps) {
  const items = expenses ?? [];
  const monthItems = items.filter((e) => yyyyMmLocal(new Date(e.occurredAt)) === monthKey);
  const myMonthTotal = monthItems.reduce((a, e) => a + myShareAmountForMe(e, me), 0);
  const monthPctRaw = monthlyBudgetWon > 0 ? myMonthTotal / monthlyBudgetWon : 0;
  const monthPctDisplay = Math.max(0, Math.round(monthPctRaw * 100));
  const monthPctBar = Math.min(100, monthPctDisplay);
  const monthOver = monthPctRaw > 1;

  const byDay = new Map<string, { day: string; count: number; amount: number }>();
  for (const e of monthItems) {
    const day = yyyyMmDdLocal(new Date(e.occurredAt));
    const prev = byDay.get(day) ?? { day, count: 0, amount: 0 };
    byDay.set(day, { day, count: prev.count + 1, amount: prev.amount + myShareAmountForMe(e, me) });
  }
  const dayRows = Array.from(byDay.values()).sort((a, b) => (a.day < b.day ? -1 : 1));

  const byCategory = new Map<string, { category: string; count: number; amount: number }>();
  for (const e of monthItems) {
    const cat = normalizeCategory(e.category || "기타");
    const prev = byCategory.get(cat) ?? { category: cat, count: 0, amount: 0 };
    byCategory.set(cat, { category: cat, count: prev.count + 1, amount: prev.amount + (Number(e.amount) || 0) });
  }
  const categoryStatByKey = new Map<string, { category: string; count: number; amount: number }>(
    Array.from(byCategory.values()).map((r) => [normalizeCategory(r.category), r])
  );
  const groupMeta = (rows: Array<{ count: number; amount: number }>) => ({
    count: rows.reduce((a, r) => a + r.count, 0),
    amount: rows.reduce((a, r) => a + r.amount, 0)
  });

  const settlementByDay = new Map<string, Map<string, number>>();
  for (const row of dayRows) {
    const perPerson = new Map<string, number>();
    for (const e of monthItems) {
      if (yyyyMmDdLocal(new Date(e.occurredAt)) !== row.day) continue;
      if (e.scope !== "SHARED") continue;
      const d = settlementDeltaForMe(e, me);
      for (const [name, amt] of d.perPerson.entries()) {
        perPerson.set(name, (perPerson.get(name) ?? 0) + amt);
      }
    }
    if (perPerson.size) settlementByDay.set(row.day, perPerson);
  }

  return (
    <div className="min-h-dvh bg-white">
      {header}
      {settlementDialog}
      <main>
        <div className="mx-auto w-full max-w-md px-4 py-4">
          <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
            <div className="h-2 w-full bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400" />
            <div className="px-5 pb-5 pt-7">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-xs font-semibold text-slate-500">이번 달 지출</div>
                <div className="text-xs font-semibold text-slate-500">{monthItems.length}건</div>
              </div>
              <div className="mt-1 flex items-baseline gap-1 tabular-nums text-slate-900">
                <span className="text-3xl font-extrabold tracking-tight">
                  {Math.round(myMonthTotal).toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-slate-400">원</span>
              </div>

              <div className="mt-4 rounded-3xl border border-indigo-200/70 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-500">이번달 예산 현황</div>
                  <div
                    className={
                      monthOver ? "text-xs font-semibold text-rose-700" : "text-xs font-semibold text-slate-700"
                    }
                  >
                    {monthOver ? "🔥 " : ""}
                    {monthPctDisplay}%
                  </div>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-white">
                  <div
                    className={monthOver ? "h-2 rounded-full bg-rose-600" : "h-2 rounded-full bg-indigo-600"}
                    style={{ width: `${monthPctBar}%` }}
                  />
                </div>
                <div className="mt-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">이번달 예산</div>
                    <div className="mt-1 flex items-baseline gap-1 tabular-nums text-slate-900">
                      <span className="text-base font-extrabold tracking-tight">
                        {monthlyBudgetWon.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">원</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-1 text-xs font-semibold tabular-nums text-slate-700">
                {dayRows.length ? (
                  dayRows.map((r) => (
                    <div key={r.day} className="flex items-center gap-3 text-slate-700">
                      <div className="shrink-0 text-slate-600">{r.day}</div>
                      <div className="h-px flex-1 bg-slate-200" />
                      <div className="shrink-0 text-right text-slate-600">
                        <span className="text-slate-500">{r.count}건</span>{" "}
                        <span className="tabular-nums">{formatWon(Math.round(r.amount))}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">이번달 지출이 없어요.</div>
                )}
              </div>

              <div className="mt-6 space-y-4 text-xs font-semibold tabular-nums text-slate-800">
                {monthItems.length ? (
                  CATEGORY_GROUPS.map((g) => {
                    const rows = g.items
                      .map((c) => categoryStatByKey.get(normalizeCategory(c)) ?? null)
                      .filter(Boolean) as Array<{ category: string; count: number; amount: number }>;
                    if (!rows.length) return null;
                    const meta = groupMeta(rows);
                    const style = GROUP_LABEL_STYLE[g.label] ?? GROUP_LABEL_STYLE["기타"];
                    return (
                      <div
                        key={g.label}
                        className={`rounded-2xl border px-3 py-3 ${style.boxBorder} ${style.boxBg}`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${style.dotBg}`} />
                            <div className={`text-slate-900 ${style.headerText}`}>{g.label}</div>
                          </div>
                          <div className="shrink-0 text-right text-slate-600">
                            <span>{meta.count}건</span> <span className="text-slate-400">・</span>{" "}
                            <span className="tabular-nums">{formatWon(Math.round(meta.amount))}</span>
                          </div>
                        </div>
                        <div className="mt-2 space-y-1">
                          {rows.map((r) => (
                            <div key={r.category} className="flex items-baseline justify-between gap-3">
                              <div className="text-slate-600">
                                <span className="mr-1">{emojiForCategory(r.category)}</span>
                                {normalizeCategory(r.category)}
                              </div>
                              <div className="shrink-0 text-right text-slate-600">
                                <span className="text-slate-500">{r.count}건</span>{" "}
                                <span className="tabular-nums">{formatWon(Math.round(r.amount))}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : null}
              </div>
            </div>
          </section>

          <section className="mt-4 overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
            <div className="p-5">
              <div className="text-sm font-semibold text-slate-900">정산 현황</div>
              <div className="mt-4 space-y-3 text-sm">
                {settlementByDay.size ? (
                  Array.from(settlementByDay.entries())
                    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
                    .map(([day, perPerson]) => (
                      <div key={day}>
                        <div className="text-xs font-semibold text-slate-600">{day}</div>
                        <div className="mt-2 space-y-2">
                          {Array.from(perPerson.entries())
                            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                            .map(([name, amount]) => {
                              const from = amount >= 0 ? name : me;
                              const to = amount >= 0 ? me : name;
                              const abs = Math.round(Math.abs(amount));
                              const sign = amount >= 0 ? "+" : "-";
                              const settled = isNetSettledForDay(day, name);
                              const amountTone = amount >= 0 ? "text-emerald-700" : "text-rose-700";
                              return (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => requestToggleNetSettledForDay(day, name)}
                                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                                    settled ? "border-slate-200 bg-slate-50 text-slate-500" : "border-slate-200 bg-white"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={
                                        from === me
                                          ? "rounded-xl bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
                                          : "rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                                      }
                                    >
                                      {from}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span
                                      className={
                                        to === me
                                          ? "rounded-xl bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
                                          : "rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                                      }
                                    >
                                      {to}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div
                                      className={`flex items-baseline gap-1 tabular-nums ${
                                        settled ? "text-slate-400" : amountTone
                                      }`}
                                    >
                                      <span className="text-base font-extrabold tracking-tight">
                                        {sign}
                                        {abs.toLocaleString()}
                                      </span>
                                      <span className="text-xs font-semibold text-slate-400">원</span>
                                    </div>
                                    <div
                                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                                        settled
                                          ? "border-indigo-600 bg-indigo-600 text-white"
                                          : "border-slate-300 bg-white text-transparent"
                                      }`}
                                      aria-hidden="true"
                                    >
                                      <svg viewBox="0 0 24 24" className="h-3 w-3">
                                        <path
                                          d="M20 6L9 17l-5-5"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-sm font-semibold text-slate-500">이번달 정산할 내역이 없어요.</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
