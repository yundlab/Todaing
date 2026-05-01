import type { ReactNode } from "react";
import type { Expense } from "../features/expenses/api";
import { CATEGORY_GROUPS, emojiForCategory, normalizeCategory } from "../domain/categoryUi";
import { formatWon } from "../domain/settlement";
import SettlementRow from "../components/SettlementRow";

export type TodayDetailViewProps = {
  header: ReactNode;
  settlementDialog: ReactNode;
  todayExpenses: Expense[];
  budgetUi: {
    todayTotal: number;
    dailyBudget: number;
  };
  settlementToday: {
    me: string;
    perPerson: Map<string, number>;
  };
  dayKey: string;
  // eslint-disable-next-line no-unused-vars -- documented callback params
  isNetSettledForDay: (day: string, name: string) => boolean;
  // eslint-disable-next-line no-unused-vars
  requestToggleNetSettledForDay: (day: string, name: string) => void;
};

export function TodayDetailView({
  header,
  settlementDialog,
  todayExpenses,
  budgetUi,
  settlementToday,
  dayKey,
  isNetSettledForDay,
  requestToggleNetSettledForDay
}: TodayDetailViewProps) {
  const byCategory = new Map<string, { category: string; count: number; amount: number }>();
  for (const e of todayExpenses) {
    const cat = normalizeCategory(e.category || "기타");
    const prev = byCategory.get(cat) ?? { category: cat, count: 0, amount: 0 };
    byCategory.set(cat, {
      category: cat,
      count: prev.count + 1,
      amount: prev.amount + (Number(e.amount) || 0)
    });
  }
  const categoryRows = Array.from(byCategory.values()).sort((a, b) => b.amount - a.amount);
  const categoryStatByKey = new Map<string, { category: string; count: number; amount: number }>(
    categoryRows.map((r) => [normalizeCategory(r.category), r])
  );
  const groupMeta = (rows: Array<{ count: number; amount: number }>) => ({
    count: rows.reduce((a, r) => a + r.count, 0),
    amount: rows.reduce((a, r) => a + r.amount, 0)
  });
  const todayPctRaw = budgetUi.dailyBudget > 0 ? budgetUi.todayTotal / budgetUi.dailyBudget : 0;
  const todayPctDisplay = Math.max(0, Math.round(todayPctRaw * 100));
  const todayPctBar = Math.min(100, todayPctDisplay);
  const todayOver = todayPctRaw > 1;

  return (
    <div className="min-h-dvh bg-white pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
      {header}
      {settlementDialog}

      <main>
        <div className="mx-auto w-full max-w-md px-4 py-4">
          <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
            <div className="h-2 w-full bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400" />
            <div className="px-5 pb-5 pt-7">
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <div className="text-xs font-semibold text-slate-500">오늘 지출 상세</div>
                <div className="text-xs font-semibold text-slate-500">{todayExpenses.length}건</div>
              </div>
              <div className="mt-1 flex items-baseline gap-1 tabular-nums text-slate-900">
                <span className="text-3xl font-extrabold tracking-tight">
                  {Math.round(budgetUi.todayTotal).toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-slate-400">원</span>
              </div>

              <div className="mt-6 rounded-3xl border border-indigo-200/70 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-500">오늘 예산 현황</div>
                  <div
                    className={
                      todayOver ? "text-xs font-semibold text-rose-700" : "text-xs font-semibold text-slate-700"
                    }
                  >
                    {todayOver ? "🔥 " : ""}
                    {todayPctDisplay}%
                  </div>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-white">
                  <div
                    className={todayOver ? "h-2 rounded-full bg-rose-600" : "h-2 rounded-full bg-indigo-600"}
                    style={{ width: `${todayPctBar}%` }}
                  />
                </div>
                <div className="mt-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">오늘 예산</div>
                    <div className="mt-1 flex items-baseline gap-1 tabular-nums text-slate-900">
                      <span className="text-base font-extrabold tracking-tight">
                        {Math.round(budgetUi.dailyBudget).toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">원</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {categoryRows.length ? (
                  CATEGORY_GROUPS.map((g) => {
                    const rows = g.items
                      .map((c) => categoryStatByKey.get(normalizeCategory(c)) ?? null)
                      .filter(Boolean) as Array<{ category: string; count: number; amount: number }>;
                    if (!rows.length) return null;
                    const meta = groupMeta(rows);
                    return (
                      <div key={g.label}>
                        <div className="flex items-baseline justify-between">
                          <div className="text-xs font-semibold text-slate-600">{g.label}</div>
                          <div className="text-[11px] font-semibold text-slate-500">
                            {meta.count}건 · {formatWon(Math.round(meta.amount))}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {rows.map((r) => (
                            <div
                              key={r.category}
                              className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 text-xs font-semibold text-slate-900">
                                  <span className="mr-1">{emojiForCategory(r.category)}</span>
                                  {normalizeCategory(r.category)}
                                </div>
                                <div className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">
                                  {formatWon(Math.round(r.amount))}
                                </div>
                              </div>
                              <div className="mt-1 text-[11px] font-semibold text-slate-500">{r.count}건</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm font-semibold text-slate-500">
                    아직 오늘 지출이 없어요.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="mt-4 overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
            <div className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">정산 현황</div>
              </div>

              <div className="mt-4 space-y-2">
                {settlementToday.perPerson.size ? (
                  Array.from(settlementToday.perPerson.entries())
                    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                    .map(([name, amount]) => {
                      const me = settlementToday.me;
                      const from = amount >= 0 ? name : me;
                      const to = amount >= 0 ? me : name;
                      return (
                        <SettlementRow
                          key={name}
                          from={from}
                          to={to}
                          me={me}
                          amount={amount}
                          settled={isNetSettledForDay(dayKey, name)}
                          onToggle={() => requestToggleNetSettledForDay(dayKey, name)}
                        />
                      );
                    })
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm font-semibold text-slate-500">
                    오늘은 정산할 내역이 없어요.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
