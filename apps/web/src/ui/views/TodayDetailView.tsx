import type { ReactNode } from "react";
import type { Expense } from "@/features/expenses/api";
import type { ScheduleItem } from "@/features/schedules/api";
import { CATEGORY_GROUPS, emojiForCategory, normalizeCategory, parseEmojiPrefixedTitle } from "@/domain/categoryUi";
import { timeRangeLabel } from "@/domain/date";
import { localDayTimeToMs } from "@/domain/plannedUsageOnDay";
import { parseScheduleNote } from "@/domain/scheduleNote";
import { formatWon } from "@/domain/settlement";
import SettlementRow from "@/components/SettlementRow";
import { UsersIcon } from "@/components/icons/index";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

export type TodayDetailViewProps = {
  header: ReactNode;
  settlementDialog: ReactNode;
  todayExpenses: Expense[];
  schedules: ScheduleItem[];
  usageTransit2?: Array<{
    label: string;
    startText: string;
    endText: string;
    memo: string;
    mode?: string;
  }>;
  /** 결제일과 다른 plannedAt 실사용일 — 일정 섹션에도 표시 */
  plannedUsageDayRows?: Array<{
    startMs: number;
    label: string;
    startText: string;
    endText: string;
    memo: string;
    icon: string;
  }>;
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
  settlementAllByDay?: Map<string, Map<string, number>>;
};

export function TodayDetailView({
  header,
  settlementDialog,
  todayExpenses,
  schedules,
  usageTransit2 = [],
  plannedUsageDayRows = [],
  budgetUi,
  settlementToday,
  dayKey,
  isNetSettledForDay,
  requestToggleNetSettledForDay,
  settlementAllByDay = new Map<string, Map<string, number>>()
}: TodayDetailViewProps) {
  const scheduleItems = [...schedules].sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
  type MergedScheduleRow = {
    kind: "schedule" | "usage" | "planned-usage";
    startMs: number;
    icon: string;
    title: string;
    timeText: string;
    peopleText: string;
    memoText: string;
  };
  const mergedScheduleLike: MergedScheduleRow[] = (() => {
    const rows: MergedScheduleRow[] = scheduleItems.map((s) => ({
      kind: "schedule" as const,
      startMs: new Date(s.startAt).getTime(),
      icon: (() => {
        const parsed = parseEmojiPrefixedTitle(s.title || "");
        return emojiForCategory(normalizeCategory(parsed.category || "기타"));
      })(),
      title: (() => {
        const parsed = parseEmojiPrefixedTitle(s.title || "");
        return parsed.content || s.title || "";
      })(),
      timeText: timeRangeLabel(s.startAt, s.endAt),
      peopleText: (() => {
        const n = parseScheduleNote(s.note ?? "");
        return n.people.join(", ");
      })(),
      memoText: (() => {
        const n = parseScheduleNote(s.note ?? "");
        return (n.memo ?? "").trim();
      })()
    }));
    for (const u of usageTransit2) {
      rows.push({
        kind: "usage",
        startMs: localDayTimeToMs(dayKey, u.startText),
        icon: (u.mode ?? "").trim() || emojiForCategory("교통2"),
        title: u.label,
        timeText: u.endText ? `${u.startText}~${u.endText}` : u.startText,
        peopleText: "",
        memoText: u.memo
      });
    }
    for (const p of plannedUsageDayRows) {
      rows.push({
        kind: "planned-usage",
        startMs: p.startMs,
        icon: p.icon,
        title: p.label,
        timeText: p.endText ? `${p.startText}~${p.endText}` : p.startText,
        peopleText: "",
        memoText: p.memo
      });
    }
    rows.sort((a, b) => a.startMs - b.startMs);
    return rows;
  })();
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
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-xs font-semibold text-slate-500">오늘 지출 상세</div>
                <div className="text-xs font-semibold text-slate-500">{todayExpenses.length}건</div>
              </div>
              <div className="mt-1 flex items-baseline gap-1 tabular-nums text-slate-900">
                <span className="text-3xl font-extrabold tracking-tight">
                  {Math.round(budgetUi.todayTotal).toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-slate-400">원</span>
              </div>

              <div className="mt-4 rounded-3xl border border-indigo-200/70 bg-slate-50/70 p-4">
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
                <div className="text-sm font-semibold text-slate-900">오늘 일정 요약</div>
                <div className="text-xs font-semibold text-slate-500">{mergedScheduleLike.length}건</div>
              </div>

              <div className="mt-3 space-y-2">
                {mergedScheduleLike.length ? (
                  mergedScheduleLike.map((s, idx) => (
                    <div key={`${s.kind}-${s.startMs}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
                          <span className="shrink-0" aria-hidden>
                            {s.icon}
                          </span>
                          <span className="min-w-0 break-words">{s.title}</span>
                        </div>
                        {s.kind === "usage" || s.kind === "planned-usage" ? (
                          <div className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                            이용
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-400">
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <ClockIcon className="h-4 w-4 text-slate-300" />
                          <span className="tabular-nums">{s.timeText}</span>
                        </span>
                        {s.peopleText ? (
                          <>
                            <span className="shrink-0">·</span>
                            <span className="inline-flex min-w-0 max-w-full items-start gap-1">
                              <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                              <span className="min-w-0 break-words normal-case">{s.peopleText}</span>
                            </span>
                          </>
                        ) : null}
                      </div>
                      {s.memoText ? (
                        <div className="mt-2 w-full rounded-xl bg-slate-100/70 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600 break-words">
                          <span className="break-words">“{s.memoText}”</span>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm font-semibold text-slate-500">
                    오늘 일정이 없어요.
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

          <section className="mt-4 overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
            <div className="p-5">
              <div className="text-sm font-semibold text-slate-900">전체 정산 현황</div>
              <div className="mt-4 space-y-3 text-sm">
                {settlementAllByDay.size ? (
                  Array.from(settlementAllByDay.entries())
                    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
                    .map(([day, perPerson]) => (
                      <div key={day}>
                        <div className="text-xs font-semibold text-slate-600">{day}</div>
                        <div className="mt-2 space-y-2">
                          {Array.from(perPerson.entries())
                            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                            .map(([name, amount]) => {
                              const me = settlementToday.me;
                              const from = amount >= 0 ? name : me;
                              const to = amount >= 0 ? me : name;
                              return (
                                <SettlementRow
                                  key={`${day}:${name}`}
                                  from={from}
                                  to={to}
                                  me={me}
                                  amount={amount}
                                  settled={isNetSettledForDay(day, name)}
                                  onToggle={() => requestToggleNetSettledForDay(day, name)}
                                />
                              );
                            })}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm font-semibold text-slate-500">
                    정산할 내역이 없어요.
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
