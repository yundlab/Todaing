import type { Expense } from "@/features/expenses/api";
import { ClockIcon, PaymentMethodIcon, UsersIcon } from "@/components/icons/index";
import ExpenseCard from "@/components/ExpenseCard";
import { cn } from "@/components/cn";
import {
  CATEGORY_GROUPS,
  emojiForCategory,
  normalizeCategory,
  parseEmojiPrefixedTitle
} from "@/domain/categoryUi";
import { tintForCategory } from "@/domain/categoryTint";
import { stripTransitRoutePrefix } from "@/domain/expenseTransitText";
import { parseScheduleNote } from "@/domain/scheduleNote";
import { expenseTimeLabel, timeRangeLabel, yyyyMmLocal } from "@/domain/date";
import { PAYMENT_TYPE_LABEL, chipClass } from "@/domain/expensePaymentUi";
import {
  companionsExcludingPayerLabel,
  formatWon,
  participantsCount,
  settlementLineForExpense
} from "@/domain/settlement";
import { monthIndexDiff } from "@/domain/monthKeyDiff";
import type { TimelineItem } from "@/domain/timelineTypes";
import { isUsageDayDifferent } from "@/domain/expenseDayUsage";
import type { AggregateMode } from "@/domain/installment";

export type MainBudgetUi = {
  todayTotal: number;
  dailyBudget: number;
  monthTotal: number;
  monthPctText: number;
  paceUi: { emoji: string; message: string; bubble: string };
  message: string;
};

export type MainHomeViewProps = {
  showCategoryPreview: boolean;
  expensesError: unknown;
  scheduleError: unknown;
  budgetUi: MainBudgetUi;
  monthlyBudgetWon: number;
  timeline: TimelineItem[];
  aggregateMode: AggregateMode;
  dayKey: string;
  dayLocal00: Date;
  onOpenScheduleId: (_id: string) => void;
  onOpenExpense: (_e: Expense) => void;
  resolveOriginalExpense: (_e: Expense) => Expense;
  isExpenseNetSettledForDay: (_day: string, _e: Expense, _me: string) => boolean;
};

export default function MainHomeView(props: MainHomeViewProps) {
  const {
    showCategoryPreview,
    expensesError,
    scheduleError,
    budgetUi,
    monthlyBudgetWon,
    timeline,
    aggregateMode,
    dayKey,
    dayLocal00,
    onOpenScheduleId,
    onOpenExpense,
    resolveOriginalExpense,
    isExpenseNetSettledForDay
  } = props;

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-4">
      {expensesError || scheduleError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          API 연결 실패. 서버 실행 상태를 확인하세요.
        </div>
      ) : null}

      {showCategoryPreview ? (
        <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">카테고리 이모티콘 미리보기</h2>
            <div className="text-xs text-slate-500">?previewCategories=1</div>
          </div>
          <div className="mt-3 space-y-4">
            {CATEGORY_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="text-xs font-semibold text-slate-500">{g.label}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {g.items.map((c) => {
                    const tint = tintForCategory(c);
                    return (
                      <div
                        key={c}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 shadow-sm",
                          tint.bg,
                          tint.border
                        )}
                      >
                        <div className={cn("text-sm font-semibold", tint.text)}>
                          <span className="mr-2">{emojiForCategory(c)}</span>
                          {c}
                        </div>
                        <div className="text-xs text-slate-500">{emojiForCategory(c)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
              <div
                className="h-2 rounded-full bg-indigo-600"
                style={{ width: `${budgetUi.monthPctText}%` }}
              />
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
            className={cn(
              "mt-4 flex items-start gap-3 rounded-2xl border p-4",
              // keep bubble tone but on light card
              budgetUi.paceUi.bubble
            )}
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

      <section>
        <h2 className="text-sm font-semibold text-slate-900">오늘 기록</h2>

        <ul className="mt-4 space-y-2">
          {timeline.length === 0 ? (
            <li className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
              아직 기록이 없어요. 오른쪽 아래 + 버튼으로 기록해봐.
            </li>
          ) : null}

          {timeline.map((it) => {
            if (it.kind === "schedule") {
              const parsedTitle = parseEmojiPrefixedTitle(it.title);
              const cat = normalizeCategory(parsedTitle.category);
              const tint = tintForCategory(cat);
              const schedNote = parseScheduleNote(it.note);
              const isCancelled = Boolean(schedNote.cancelled);
              const scheduleTransitIcon =
                cat === "교통2"
                  ? (() => {
                      const memo = schedNote.memo ?? "";
                      const firstToken = memo.trimStart().split(/\s+/)[0] ?? "";
                      // e.g. "✈️ 서울 → 제주" → "✈️"
                      return firstToken ? firstToken : null;
                    })()
                  : null;
              return (
                <li key={`s-${it.id}`}>
                  <button
                    className={cn(
                      "w-full rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:brightness-[0.99]",
                      isCancelled ? "bg-slate-50/40" : ""
                    )}
                    onClick={() => {
                      onOpenScheduleId(it.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div
                          className={cn(
                            "mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl",
                            tint.border,
                            tint.bg
                          )}
                        >
                          {scheduleTransitIcon ?? emojiForCategory(cat)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              "break-words text-left text-base font-semibold leading-snug",
                              isCancelled ? "text-slate-400" : "text-slate-900"
                            )}
                          >
                            {parsedTitle.content || it.title}
                          </div>
                          <div
                            className={cn(
                              "mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold",
                              isCancelled ? "text-slate-300" : "text-slate-400"
                            )}
                          >
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <ClockIcon className="h-4 w-4 text-slate-300" />
                              <span className="tabular-nums">
                                {timeRangeLabel(it.startAt, it.endAt)}
                              </span>
                            </span>
                            {schedNote.people.length ? (
                              <span
                                className="inline-flex min-w-0 max-w-full items-start gap-1"
                                aria-label={`함께한 사람 ${schedNote.people.join(", ")}`}
                              >
                                <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                                <span className="min-w-0 break-words normal-case">
                                  {schedNote.people.join(", ")}
                                </span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-semibold text-slate-400">일정</div>
                      </div>
                    </div>
                    {schedNote.memo ? (
                      <div className="mt-2 ml-[3.75rem] w-[calc(100%-3.75rem)] min-w-0 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600">
                        <span className="break-words">“{schedNote.memo}”</span>
                      </div>
                    ) : null}
                  </button>
                </li>
              );
            }

            if (it.kind === "usage-expense") {
              const e = it.expense;
              const tint = tintForCategory(e.category || "기타");
              const usageTimeLabel = it.endText?.trim()
                ? `${it.startText?.trim() || ""}~${it.endText.trim()}`
                : (it.startText?.trim() || "");
              const expenseTransitIcon =
                normalizeCategory(e.category) === "교통2"
                  ? (() => {
                      const direct = (e.transitMode ?? "").trim();
                      if (direct) return direct;
                      const seg = e.transitSegments;
                      if (!Array.isArray(seg) || !seg.length) return null;
                      const first = seg[0] as any;
                      const m = typeof first?.mode === "string" ? String(first.mode).trim() : "";
                      return m || null;
                    })()
                  : null;
              return (
                <li key={`u-${e.id}-${it.startMs}`}>
                  <ExpenseCard
                    onClick={() => onOpenExpense(e)}
                    leftIcon={
                      <div
                        className={cn(
                          "mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl opacity-70",
                          tint.border,
                          tint.bg
                        )}
                      >
                        {expenseTransitIcon ?? emojiForCategory(e.category || "기타")}
                      </div>
                    }
                    title={
                      <span className="inline-flex items-center gap-2">
                        <span>{it.label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          이용
                        </span>
                      </span>
                    }
                    meta={
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <ClockIcon className="h-4 w-4 text-slate-300" />
                        <span className="tabular-nums text-slate-400">{usageTimeLabel || "이용"}</span>
                      </span>
                    }
                    quote={
                      it.usageMemo ? (
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600">
                          <span className="text-slate-500">이용일 메모</span>
                          <span className="text-slate-400"> · </span>
                          <span className="break-words">“{it.usageMemo}”</span>
                        </div>
                      ) : null
                    }
                    amount={
                      e.amount > 0 ? (
                        <div className="flex items-baseline justify-end gap-1 tabular-nums text-slate-400">
                          <span className="text-lg font-extrabold tracking-tight">
                            {Math.round(e.amount).toLocaleString()}
                          </span>
                          <span className="text-xs font-semibold">원</span>
                        </div>
                      ) : (
                        <div className="text-right text-xs font-semibold tabular-nums text-slate-400">
                          금액 미입력
                        </div>
                      )
                    }
                  />
                </li>
              );
            }

            const e = it.expense;
            const tint = tintForCategory(e.category || "기타");
            const isCashflowVirtual = String(e.id || "").includes("::cashflow::");
            const cashflowVirtualMonthKey = isCashflowVirtual
              ? (String(e.id || "").split("::cashflow::")[1] ?? "").trim()
              : "";
            const originalForCashflow = isCashflowVirtual ? resolveOriginalExpense(e) : e;
            const installmentNth =
              isCashflowVirtual &&
              originalForCashflow.paymentType === "CARD" &&
              !!originalForCashflow.installment &&
              !!originalForCashflow.installmentMonths &&
              originalForCashflow.installmentMonths >= 2 &&
              /^\d{4}-\d{2}$/.test(cashflowVirtualMonthKey)
                ? monthIndexDiff(yyyyMmLocal(new Date(originalForCashflow.occurredAt)), cashflowVirtualMonthKey) + 1
                : null;
            const settlementLine = isCashflowVirtual ? null : settlementLineForExpense(e, "나");
            const isSettled = isCashflowVirtual ? true : isExpenseNetSettledForDay(dayKey, e, "나");
            // 카드에는 세부 내용(detail) 노출하지 않음. (메모만 노출)
            const rawMemoText = (e.memo ?? "").trim();
            const memoText =
              normalizeCategory(e.category) === "교통2" && isUsageDayDifferent(e, dayKey)
                ? stripTransitRoutePrefix(rawMemoText, e.transitFrom, e.transitTo).trim()
                : rawMemoText;
            const transit1BusNumber = (() => {
              if (normalizeCategory(e.category) !== "교통1") return "";
              const seg = e.transitSegments;
              if (!Array.isArray(seg) || !seg.length) return "";
              for (const s of seg as any[]) {
                const mode = typeof s?.mode === "string" ? String(s.mode).trim().toUpperCase() : "";
                if (mode !== "BUS") continue;
                const bn = typeof s?.busNumber === "string" ? s.busNumber.trim() : "";
                if (bn) return bn;
              }
              return "";
            })();
            const memoTextWithBus =
              normalizeCategory(e.category) === "교통1" && transit1BusNumber ? `🚌 ${transit1BusNumber}` : memoText;
            const payerLabel = (e.paymentOwner ?? "").trim() || "—";
            const companionsLine = companionsExcludingPayerLabel(e).trim();
            const isCardPayment = e.paymentType === "CARD";
            const isCardInstallment =
              isCardPayment &&
              !!e.installment &&
              e.installmentMonths != null &&
              e.installmentMonths >= 2;
            const cardPayLabel = (e.paymentMethodLabel ?? "").trim() || PAYMENT_TYPE_LABEL.CARD;
            const installmentMonthsLabel = isCardInstallment
              ? e.installmentNoInterest
                ? `무이자 ${e.installmentMonths}개월`
                : `${e.installmentMonths}개월`
              : null;
            const methodLabel =
              e.paymentType === "CASH" ? "현금" : e.paymentMethodLabel || PAYMENT_TYPE_LABEL[e.paymentType];
            const expenseMainTransitEmoji =
              normalizeCategory(e.category) === "교통2"
                ? (() => {
                    const direct = (e.transitMode ?? "").trim();
                    if (direct) return direct;
                    const seg = e.transitSegments;
                    if (!Array.isArray(seg) || !seg.length) return null;
                    const first = seg[0] as { mode?: string };
                    const m = typeof first?.mode === "string" ? String(first.mode).trim() : "";
                    return m || null;
                  })()
                : null;
            return (
              <li key={`e-${e.id}`}>
                <ExpenseCard
                  onClick={() => onOpenExpense(resolveOriginalExpense(e))}
                  leftIcon={
                    <div
                      className={cn(
                        "mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl",
                        tint.border,
                        tint.bg
                      )}
                    >
                      {expenseMainTransitEmoji ?? emojiForCategory(e.category || "기타")}
                    </div>
                  }
                  title={
                    normalizeCategory(e.category) === "교통1"
                      ? (() => {
                          const from = (e.transitFrom ?? "").trim();
                          const to = (e.transitTo ?? "").trim();
                          const route = from && to ? `${from} → ${to}` : (from || to);
                          return route || (e.merchant ?? normalizeCategory(e.category));
                        })()
                      : (e.merchant ?? normalizeCategory(e.category))
                  }
                  chips={
                    <>
                      {e.scope === "SHARED" ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            chipClass("teal")
                          )}
                      >
                        공동 · {participantsCount(e) ?? "?"}명
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            chipClass("gray")
                          )}
                        >
                          개인
                        </span>
                      )}
                      {String(e.id || "").includes("::cashflow::") ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            chipClass("orange")
                          )}
                        >
                          할부(
                          {installmentNth ?? "?"}/{originalForCashflow.installmentMonths ?? "?"})
                        </span>
                      ) : null}
                    </>
                  }
                  meta={
                    <>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <ClockIcon className="h-4 w-4 text-slate-300" />
                        <span className="tabular-nums">
                          {e.endAt
                            ? timeRangeLabel(e.occurredAt, e.endAt)
                            : expenseTimeLabel(e.occurredAt, dayLocal00)}
                        </span>
                      </span>
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                        <PaymentMethodIcon kind={e.paymentType} className="h-4 w-4 shrink-0 text-slate-300" />
                        <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-1 gap-y-0.5">
                          {isCardInstallment ? (
                            <span className="min-w-0 break-words">
                              {payerLabel}
                              <span className="text-slate-300"> | </span>
                              {cardPayLabel}
                              <span className="text-slate-300"> | </span>
                              {installmentMonthsLabel}
                            </span>
                          ) : isCardPayment ? (
                            <span className="min-w-0 break-words">
                              {payerLabel}
                              <span className="text-slate-300"> | </span>
                              {cardPayLabel}
                            </span>
                          ) : (
                            <span className="min-w-0 break-words">
                              {payerLabel}
                              <span className="text-slate-300"> | </span>
                              {methodLabel}
                            </span>
                          )}
                        </span>
                      </span>
                      {companionsLine ? (
                        <>
                          <span className="inline-flex min-w-0 max-w-full items-start gap-1">
                            <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                            <span className="min-w-0 break-words">{companionsLine}</span>
                          </span>
                        </>
                      ) : null}
                    </>
                  }
                  amount={
                    e.amount > 0 ? (
                      <div className="text-right tabular-nums text-slate-900">
                        <div className="flex items-baseline justify-end gap-1">
                          <span className="text-lg font-extrabold tracking-tight">
                            {e.amount.toLocaleString()}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">원</span>
                        </div>
                        {aggregateMode !== "cashflow" &&
                        e.paymentType === "CARD" &&
                        e.installment &&
                        e.installmentMonths ? (
                          <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                            월 {Math.round(e.amount / e.installmentMonths).toLocaleString()}원
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-right text-xs font-semibold tabular-nums text-slate-400">
                        금액 미입력
                      </div>
                    )
                  }
                  settlement={
                    memoTextWithBus || settlementLine ? (
                      <>
                        <div className="min-w-0 flex-1">
                          {memoTextWithBus ? (
                            <div className="ml-[calc(3rem+0.75rem)] truncate rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600">
                              “{memoTextWithBus}”
                            </div>
                          ) : null}
                        </div>
                        {settlementLine ? (
                          <div className="flex shrink-0 items-center justify-end">
                            <div
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                                isSettled
                                  ? "bg-slate-100 text-slate-500"
                                  : settlementLine.kind === "receive"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700"
                              )}
                            >
                              <span className="opacity-80">🏷</span>
                              <span className="tabular-nums">
                                {settlementLine.kind === "receive" ? "+" : "-"}
                                {formatWon(settlementLine.amount)}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null
                  }
                />
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
