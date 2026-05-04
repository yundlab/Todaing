import { cn } from "@/components/cn";
import { formatWon } from "@/domain/settlement";
import type { MainHomeBudgetUi } from "@/domain/mainHomeBudgetUi";

export default function MainHomeBudgetHeroSection(props: {
  budgetUi: MainHomeBudgetUi;
  monthlyBudgetWon: number;
}) {
  const { budgetUi, monthlyBudgetWon } = props;
  return (
    <section className="mb-4 overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
      <div className="h-2 w-full bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400" />
      <div className="px-5 pb-5 pt-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500">오늘 지출</div>
            <div className="mt-1 flex items-baseline gap-1 tabular-nums text-slate-900">
              <span className="text-3xl font-extrabold tracking-tight">
                {Math.round(budgetUi.todayTotal).toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-slate-400">원</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              예산 {formatWon(Math.round(budgetUi.dailyBudget))} · 남음{" "}
              {formatWon(Math.round(budgetUi.dailyBudget - budgetUi.todayTotal))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-indigo-200/70 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-500">이번달 예산 현황</div>
            <div className="text-xs font-semibold text-slate-700">{budgetUi.monthPctText}%</div>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-white">
            <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${budgetUi.monthPctText}%` }} />
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-500">이번달 지출</div>
              <div className="mt-1 flex items-baseline gap-1 tabular-nums text-slate-900">
                <span className="text-base font-extrabold tracking-tight">
                  {Math.round(budgetUi.monthTotal).toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-400">원</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-500">예산</div>
              <div className="mt-1 flex items-baseline justify-end gap-1 tabular-nums text-slate-900">
                <span className="text-base font-extrabold tracking-tight">{monthlyBudgetWon.toLocaleString()}</span>
                <span className="text-xs font-semibold text-slate-400">원</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn("mt-4 flex items-start gap-3 rounded-2xl border p-4", budgetUi.paceUi.bubble)}
        >
          <div className="shrink-0 text-2xl leading-none">{budgetUi.paceUi.emoji}</div>
          <div className="min-w-0">
            <div className="whitespace-pre-line text-sm font-semibold">{budgetUi.message}</div>
            <div className="mt-1 text-[11px] font-semibold text-slate-500">
              예산 {formatWon(monthlyBudgetWon)}원 중 {budgetUi.monthPctText}% 사용
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
