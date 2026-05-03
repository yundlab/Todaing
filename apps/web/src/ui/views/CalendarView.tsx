import type { ReactNode } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { Expense } from "@/features/expenses/api";
import type { ScheduleItem } from "@/features/schedules/api";
import BottomNav from "@/components/BottomNav";
import { yyyyMmDdLocal } from "@/domain/date";
import { spendByDayForCalendar, sumExpensesForMonth, type AggregateMode } from "@/domain/installment";
import { emojiForCategory, normalizeCategory, parseEmojiPrefixedTitle } from "@/domain/categoryUi";
import { formatCalendarWon } from "@/domain/calendarSpendFormat";
import { cn } from "@/components/cn";

export default function CalendarView({
  headerEl,
  navigate,
  monthKey,
  aggregateMode,
  expensesAll,
  monthSchedules
}: {
  headerEl: ReactNode;
  navigate: NavigateFunction;
  monthKey: string;
  aggregateMode: AggregateMode;
  expensesAll: Expense[];
  monthSchedules: ScheduleItem[];
}) {
  const spendByDay = spendByDayForCalendar(aggregateMode, expensesAll, monthKey);
  const calendarMonthTotal = sumExpensesForMonth(aggregateMode, expensesAll, monthKey);

  const schedulesByDay = new Map<string, ScheduleItem[]>();
  for (const s of monthSchedules) {
    const day = yyyyMmDdLocal(new Date(s.startAt));
    const arr = schedulesByDay.get(day) ?? [];
    arr.push(s);
    schedulesByDay.set(day, arr);
  }
  for (const [k, arr] of schedulesByDay.entries()) {
    arr.sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
    schedulesByDay.set(k, arr);
  }

  const first = new Date(`${monthKey}-01T00:00:00`);
  const firstDow = first.getDay();
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstDow + lastDay }, (_, i) => {
    if (i < firstDow) return null;
    return i - firstDow + 1;
  });

  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
  const tempHolidaySet = (() => {
    try {
      const raw = window.localStorage.getItem("tempHolidays");
      if (!raw) return new Set<string>();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set<string>();
      const list = parsed.map((x: unknown) => String(x)).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
      return new Set(list);
    } catch {
      return new Set<string>();
    }
  })();

  const isFixedKrHoliday = (ymd: string) => {
    const mmdd = ymd.slice(5);
    const year = Number(ymd.slice(0, 4));
    return (
      mmdd === "01-01" ||
      mmdd === "03-01" ||
      (year >= 2026 && mmdd === "05-01") ||
      (year >= 2026 && mmdd === "07-17") ||
      (year >= 2026 && mmdd === "05-25") ||
      mmdd === "05-05" ||
      mmdd === "06-06" ||
      mmdd === "08-15" ||
      mmdd === "10-03" ||
      mmdd === "10-09" ||
      mmdd === "12-25"
    );
  };

  return (
    <div className="min-h-dvh bg-white pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
      {headerEl}
      <main>
        <div className="mx-auto w-full max-w-md px-4 py-4">
          <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">달력</div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-[11px] font-semibold text-slate-500">
                  {aggregateMode === "cashflow" ? "이번달 실출금" : "이번달 사용액"}
                </div>
                <div className="text-sm font-extrabold tabular-nums text-slate-900">
                  {Math.round(calendarMonthTotal).toLocaleString()}
                  <span className="ml-0.5 text-[11px] font-semibold text-slate-400">원</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2 text-[11px] font-semibold text-slate-400">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="text-center">
                    {w}
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {cells.map((dayNum, idx) => {
                  if (!dayNum) return <div key={`e-${idx}`} className="h-[92px]" />;
                  const dayKeyCell = `${monthKey}-${String(dayNum).padStart(2, "0")}`;
                  const dow = new Date(`${dayKeyCell}T00:00:00`).getDay();
                  const isHoliday = isFixedKrHoliday(dayKeyCell) || tempHolidaySet.has(dayKeyCell);
                  const isSun = dow === 0;
                  const isSat = dow === 6;
                  const dayTone = isSun || isHoliday ? "text-rose-600" : isSat ? "text-indigo-600" : "text-slate-900";
                  const spend = spendByDay.get(dayKeyCell) ?? 0;
                  const sched = schedulesByDay.get(dayKeyCell) ?? [];
                  const schedIcons = sched
                    .map((s) => {
                      const parsed = parseEmojiPrefixedTitle(s.title || "");
                      return emojiForCategory(normalizeCategory(parsed.category || "기타"));
                    })
                    .filter(Boolean);
                  const maxShow = 6;
                  const shown = schedIcons.slice(0, maxShow);
                  const rest = schedIcons.length - shown.length;
                  return (
                    <button
                      key={dayKeyCell}
                      type="button"
                      className="relative h-[92px] overflow-hidden rounded-2xl border border-slate-200 bg-white px-1 pb-1 pt-0.5 text-left shadow-sm hover:brightness-[0.99]"
                      onClick={() => navigate(`/today/${dayKeyCell}`)}
                      title={dayKeyCell}
                    >
                      <div className="flex h-full min-w-0 flex-col">
                        <div className="h-[28px] min-w-0">
                          <div className={cn("text-xs font-extrabold tabular-nums leading-none", dayTone)}>{dayNum}</div>
                          <div
                            className={cn(
                              "mt-1 whitespace-nowrap text-[10px] font-semibold tabular-nums tracking-tight text-slate-600",
                              spend ? "opacity-100" : "opacity-0"
                            )}
                          >
                            {formatCalendarWon(spend)}
                          </div>
                        </div>
                        {shown.length ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {shown.map((ic, i) => (
                              <span key={i} className="text-[13px] leading-none" aria-hidden>
                                {ic}
                              </span>
                            ))}
                            {rest > 0 ? <span className="text-[11px] font-semibold text-slate-400">+{rest}</span> : null}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
