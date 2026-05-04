import { ClockIcon, PaymentMethodIcon, UsersIcon } from "@/components/icons";
import ExpenseCard from "@/components/ExpenseCard";
import { cn } from "@/components/cn";
import { emojiForCategory, normalizeCategory, parseEmojiPrefixedTitle } from "@/domain/categoryUi";
import { tintForCategory } from "@/domain/categoryTint";
import { stripTransitRoutePrefix } from "@/domain/expenseTransitText";
import { parseScheduleNote } from "@/domain/scheduleNote";
import { expenseTimeLabel, timeRangeLabel, yyyyMmDdLocal, yyyyMmLocal } from "@/domain/date";
import { PAYMENT_TYPE_LABEL, chipClass } from "@/domain/expensePaymentUi";
import {
  formatWon,
  participantsCount,
  participantsDisplayWithoutMe,
  settlementLineForExpense
} from "@/domain/settlement";
import { monthIndexDiff } from "@/domain/monthKeyDiff";
import { isUsageDayDifferent } from "@/domain/expenseDayUsage";
import MainHomeBudgetHeroSection from "./MainHomeBudgetHeroSection";
import MainHomeCategoryPreviewSection from "./MainHomeCategoryPreviewSection";
import type { MainHomeViewProps } from "./MainHomeTypes";

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

      {showCategoryPreview ? <MainHomeCategoryPreviewSection /> : null}

      <MainHomeBudgetHeroSection budgetUi={budgetUi} monthlyBudgetWon={monthlyBudgetWon} />

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
                      return firstToken ? firstToken : null;
                    })()
                  : null;
              return (
                <li key={`s-${it.id}`}>
                  <button
                    type="button"
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
                              <span className="tabular-nums">{timeRangeLabel(it.startAt, it.endAt)}</span>
                            </span>
                            {schedNote.people.length ? (
                              <span
                                className="inline-flex min-w-0 max-w-full items-start gap-1"
                                aria-label={`함께한 사람 ${schedNote.people.join(", ")}`}
                              >
                                <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                                <span className="min-w-0 break-words normal-case">{schedNote.people.join(", ")}</span>
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
                      const fromSegment = (it.usageTransitMode ?? "").trim();
                      if (fromSegment) return fromSegment;
                      const direct = (e.transitMode ?? "").trim();
                      if (direct) return direct;
                      const seg = e.transitSegments;
                      if (!Array.isArray(seg) || !seg.length) return null;
                      const first = seg[0] as { mode?: unknown };
                      const m = typeof first?.mode === "string" ? String(first.mode).trim() : "";
                      return m || null;
                    })()
                  : null;
              const plannedUsageCard =
                normalizeCategory(e.category) !== "교통2" &&
                e.plannedAt &&
                yyyyMmDdLocal(new Date(e.plannedAt)) !== yyyyMmDdLocal(new Date(e.occurredAt));
              const pm = (e.plannedMemo ?? "").trim();
              const pc = (e.plannedContent ?? "").trim();
              const plannedTitle = pc ? pm : "";
              const usageCardMainTitle = plannedUsageCard
                ? plannedTitle.trim() || (e.subject ?? "").trim() || it.label
                : it.label;
              const usageGrayBody = plannedUsageCard && pc.trim() ? pc.trim() : "";
              return (
                <li key={`u-${e.id}-${it.startMs}`}>
                  <ExpenseCard
                    onClick={() => onOpenExpense(e)}
                    leftIcon={
                      <div
                        className={cn(
                          "mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl",
                          tint.border,
                          tint.bg
                        )}
                      >
                        {expenseTransitIcon ?? emojiForCategory(e.category || "기타")}
                      </div>
                    }
                    title={plannedUsageCard ? usageCardMainTitle : it.label}
                    chips={
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold leading-none text-slate-500">
                        이용
                      </span>
                    }
                    meta={
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <ClockIcon className="h-4 w-4 text-slate-300" />
                        <span className="tabular-nums text-slate-400">{usageTimeLabel || "이용"}</span>
                      </span>
                    }
                    quote={
                      plannedUsageCard ? (
                        usageGrayBody ? (
                          <div className="ml-[3.75rem] w-[calc(100%-3.75rem)] min-w-0 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600">
                            <span className="break-words [word-break:keep-all]">“{usageGrayBody}”</span>
                          </div>
                        ) : null
                      ) : it.usageMemo ? (
                        <div className="ml-[3.75rem] w-[calc(100%-3.75rem)] min-w-0 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600">
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
                        <div className="text-right text-xs font-semibold tabular-nums text-slate-400">금액 미입력</div>
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
            const rawMemoText = (e.memo ?? "").trim();
            const memoText =
              normalizeCategory(e.category) === "교통2" && isUsageDayDifferent(e, dayKey)
                ? stripTransitRoutePrefix(rawMemoText, e.transitFrom, e.transitTo).trim()
                : rawMemoText;
            const transit1LineSummary = (() => {
              if (normalizeCategory(e.category) !== "교통1") return "";
              const seg = e.transitSegments;
              if (!Array.isArray(seg) || !seg.length) return "";
              const parts: string[] = [];
              for (const s of seg as { mode?: string; busNumber?: string; line?: string }[]) {
                const mode = typeof s?.mode === "string" ? String(s.mode).trim().toUpperCase() : "";
                if (mode === "BUS") {
                  const bn = typeof s?.busNumber === "string" ? s.busNumber.trim() : "";
                  if (bn) parts.push(`🚌 ${bn}`);
                } else if (mode === "SUBWAY") {
                  const line = typeof s?.line === "string" ? s.line.trim() : "";
                  if (line) parts.push(`🚃 ${line}`);
                }
              }
              return parts.join(" · ");
            })();
            const memoTextWithBus =
              normalizeCategory(e.category) === "교통1" ? transit1LineSummary || memoText : memoText;
            const payerLabel = (e.paymentOwner ?? "").trim() || "—";
            const companionsLine = participantsDisplayWithoutMe(e.participants, "나").trim();
            const isCardPayment = e.paymentType === "CARD";
            const isCardInstallment =
              isCardPayment && !!e.installment && e.installmentMonths != null && e.installmentMonths >= 2;
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
                          const route = from && to ? `${from} → ${to}` : from || to;
                          return route || (e.merchant ?? normalizeCategory(e.category));
                        })()
                      : normalizeCategory(e.category) === "교통2"
                        ? (() => {
                            const merchantLine = (e.merchant ?? "").trim() || normalizeCategory(e.category);
                            const subj = (e.subject ?? "").trim();
                            return (
                              <div className="min-w-0 text-left">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                  결제처
                                </div>
                                <div className="mt-0.5 break-words text-base font-semibold leading-snug text-slate-900">
                                  {merchantLine}
                                </div>
                                {subj ? (
                                  <div className="mt-1 break-words text-sm font-semibold text-slate-700">{subj}</div>
                                ) : null}
                              </div>
                            );
                          })()
                        : (
                          <div className="min-w-0 space-y-1 text-left">
                            {(e.subject ?? "").trim() ? (
                              <div className="break-words text-base font-semibold leading-snug text-slate-900">
                                {(e.subject ?? "").trim()}
                              </div>
                            ) : null}
                            <div
                              className={cn(
                                "break-words font-semibold leading-snug text-slate-900",
                                (e.subject ?? "").trim() ? "text-sm" : "text-base"
                              )}
                            >
                              {(e.merchant ?? "").trim() || normalizeCategory(e.category)}
                            </div>
                          </div>
                        )
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
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                            chipClass("orange")
                          )}
                        >
                          할부 {installmentNth ?? "?"}/{originalForCashflow.installmentMonths ?? "?"}
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
                        <span className="inline-flex min-w-0 max-w-full items-start gap-1">
                          <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                          <span className="min-w-0 break-words">{companionsLine}</span>
                        </span>
                      ) : null}
                    </>
                  }
                  amount={
                    e.amount > 0 ? (
                      <div className="text-right tabular-nums text-slate-900">
                        <div className="flex items-baseline justify-end gap-1">
                          <span className="text-lg font-extrabold tracking-tight">{e.amount.toLocaleString()}</span>
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
                      <div className="text-right text-xs font-semibold tabular-nums text-slate-400">금액 미입력</div>
                    )
                  }
                  settlement={
                    memoTextWithBus || settlementLine ? (
                      <>
                        <div className="min-w-0 flex-1">
                          {memoTextWithBus ? (
                            <div className="ml-[calc(3rem+0.75rem)] min-w-0 break-words rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600">
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
