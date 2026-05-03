import type { ReactNode } from "react";
import ComposeSheet from "@/components/ComposeSheet";
import SettlementRow from "@/components/SettlementRow";
import { BusIcon, CalendarIcon, ClockIcon, PaymentMethodIcon, UsersIcon } from "@/components/icons/index";
import type { Expense } from "@/features/expenses/api";
import { expenseTimeLabel, pad2, timeRangeLabel, yyyyMmDdLocal } from "@/domain/date";
import { formatWon, companionsExcludingPayerLabel, settlementTransfersForMe } from "@/domain/settlement";
import { normalizeCategory } from "@/domain/categoryUi";
import { PAYMENT_TYPE_LABEL } from "@/domain/expensePaymentUi";
import {
  findTransit2SegmentForViewerDay,
  stripTransitRoutePrefix,
  transit2OffPaymentUsageSegments,
  transit2SegmentMemoLine,
  transit2SegmentRouteLabel,
  transit2SegmentTimeRangeLine
} from "@/domain/expenseTransitText";
import { parseAmountInput } from "@/domain/parseAmountInput";

/** 결제일(occurredAt)과 실제 이용일(plannedAt)이 달라 「다른 날 사용」이 의미 있는 경우 */
function isDifferentPlannedUsageDay(expense: Expense): boolean {
  if (!expense.plannedAt) return false;
  return yyyyMmDdLocal(new Date(expense.plannedAt)) !== yyyyMmDdLocal(new Date(expense.occurredAt));
}

export default function ExpenseDetailSheet({
  expense,
  title,
  subtitle,
  onClose,
  footer,
  isNetSettledForDay,
  requestToggleNetSettledForDay,
  viewerDayKey
}: {
  expense: Expense;
  title: ReactNode;
  subtitle: ReactNode;
  onClose: () => void;
  footer: ReactNode;
  isNetSettledForDay: (_day: string, _name: string) => boolean;
  requestToggleNetSettledForDay: (_day: string, _name: string) => void;
  /** 타임라인에서 연 날(YYYY-MM-DD). 교통2 실이용 구간 매칭에 사용 */
  viewerDayKey: string;
}) {
  const differentPlannedDay = isDifferentPlannedUsageDay(expense);
  const catNorm = normalizeCategory(expense.category);
  const companionsPay = companionsExcludingPayerLabel(expense).trim();
  const t2UsageSegments = transit2OffPaymentUsageSegments(expense);
  const showTransit2UsageCard = catNorm === "교통2" && t2UsageSegments.length > 0;
  return (
    <ComposeSheet open title={title} subtitle={subtitle} onClose={onClose} footer={footer}>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        {expense.amount > 0 ? (
          <div className="flex items-baseline justify-between">
            <div className="text-xs text-slate-400">금액</div>
            <div className="text-base font-semibold tabular-nums text-slate-900">{formatWon(expense.amount)}</div>
          </div>
        ) : null}
        {normalizeCategory(expense.category) === "교통1" ? (
          (() => {
            const from = (expense.transitFrom ?? "?").trim() || "?";
            const to = (expense.transitTo ?? "?").trim() || "?";
            return (
              <>
                <div className="mt-3">
                  <div className="text-xs text-slate-400">이동</div>
                  <div className="mt-1 min-w-0 font-semibold leading-snug text-slate-900">
                    {from} → {to}
                  </div>
                </div>
                {(() => {
                  const seg = expense.transitSegments;
                  if (!Array.isArray(seg) || !seg.length) return null;
                  return (
                    <div className="mt-3">
                      <div className="text-xs text-slate-400">구간</div>
                      <ul className="mt-2 space-y-2">
                        {(seg as unknown[]).map((raw, i) => {
                          if (!raw || typeof raw !== "object") return null;
                          const o = raw as Record<string, unknown>;
                          const mode = typeof o.mode === "string" ? o.mode.toUpperCase() : "";
                          const label = `구간${i + 1}`;
                          const amtRaw = o.amount;
                          const amt =
                            typeof amtRaw === "number" && Number.isFinite(amtRaw)
                              ? Math.trunc(amtRaw)
                              : parseAmountInput(String(amtRaw ?? ""));
                          let route = "";
                          if (mode === "BUS") {
                            const f = String(o.from ?? "").trim() || "?";
                            const t = String(o.to ?? "").trim() || "?";
                            const bn = String(o.busNumber ?? "").trim();
                            route = bn ? `${f} → ${t} ・ 🚌 ${bn}` : `${f} → ${t}`;
                          } else if (mode === "SUBWAY") {
                            const f = String(o.from ?? "").trim() || "?";
                            const t = String(o.to ?? "").trim() || "?";
                            const line = String(o.line ?? "").trim();
                            route = line ? `${f} → ${t} ・ 🚃 ${line}` : `${f} → ${t}`;
                          } else {
                            route = "—";
                          }
                          const segStart = String(o.start ?? "").trim();
                          const segEnd = String(o.end ?? "").trim();
                          const timeLine =
                            segStart && segEnd
                              ? `${segStart}~${segEnd}`
                              : segStart || segEnd || null;
                          return (
                            <li
                              key={i}
                              className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-3 text-sm text-slate-800 shadow-sm"
                            >
                              <div className="text-xs font-semibold text-slate-500">{label}</div>
                              {timeLine ? (
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium tabular-nums text-slate-600">
                                  <ClockIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                                  <span>{timeLine}</span>
                                </div>
                              ) : null}
                              <div className="mt-2 text-xs text-slate-400">이동</div>
                              <div className="mt-0.5 min-w-0 font-semibold leading-snug text-slate-900">{route}</div>
                              <div className="mt-2 text-xs text-slate-400">금액</div>
                              <div className="mt-0.5 text-sm font-bold tabular-nums text-indigo-700">
                                {amt != null && amt >= 0 ? formatWon(amt) : "—"}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })()}
                {(expense.detail ?? "").trim() ? (
                  <div className="mt-3">
                    <div className="text-xs text-slate-400">세부 내용</div>
                    <div className="mt-1 text-slate-800">{(expense.detail ?? "").trim()}</div>
                  </div>
                ) : null}
              </>
            );
          })()
        ) : null}
        {normalizeCategory(expense.category) !== "교통1" &&
        (() => {
          const hideTransitBecauseUsageDay =
            (normalizeCategory(expense.category) === "교통2" &&
              expense.plannedAt &&
              yyyyMmDdLocal(new Date(expense.plannedAt)) !== yyyyMmDdLocal(new Date(expense.occurredAt))) ||
            showTransit2UsageCard;
          return !hideTransitBecauseUsageDay && (expense.transitFrom || expense.transitTo);
        })() ? (
          <div className="mt-3">
            <div className="text-xs text-slate-400">이동</div>
            <div className="mt-1 font-semibold text-slate-900">
              {(() => {
                const isTransit1 = normalizeCategory(expense.category) === "교통1";
                const transit1BusNumber = (() => {
                  if (!isTransit1) return "";
                  const seg = expense.transitSegments;
                  if (!Array.isArray(seg) || !seg.length) return "";
                  for (const s of seg as any[]) {
                    const mode = typeof s?.mode === "string" ? String(s.mode).trim().toUpperCase() : "";
                    if (mode !== "BUS") continue;
                    const bn = typeof s?.busNumber === "string" ? s.busNumber.trim() : "";
                    if (bn) return bn;
                  }
                  return "";
                })();
                const isTransit1Bus = Boolean(transit1BusNumber);
                const route =
                  (expense.transitFrom ?? "?") +
                  (expense.transitVia ? ` → ${expense.transitVia.split("|").join(" → ")}` : "") +
                  " → " +
                  (expense.transitTo ?? "?");
                const suffix =
                  (expense.transitLine ? ` · ${expense.transitLine}` : "") +
                  (!isTransit1Bus && expense.transitBusNumber ? ` · ${expense.transitBusNumber}` : "");
                return (
                  <>
                    {isTransit1Bus ? (
                      <span className="mr-1 inline-flex align-middle">
                        <BusIcon className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                      </span>
                    ) : expense.transitMode?.trim() ? (
                      <span className="mr-1">{expense.transitMode.trim()} </span>
                    ) : null}
                    {isTransit1Bus ? `${transit1BusNumber} ` : ""}
                    {route}
                    {suffix}
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}
        {(differentPlannedDay || showTransit2UsageCard) && catNorm !== "교통1" ? (
          (() => {
            const memoT = (expense.memo ?? "").trim();
            const detailT = (expense.detail ?? "").trim();
            if (!memoT && !detailT && !companionsPay) return null;
            return (
              <div className="mt-3 space-y-3">
                {memoT ? (
                  <div>
                    <div className="text-xs text-slate-400">내용</div>
                    <div className="mt-1 text-slate-800">{expense.memo}</div>
                  </div>
                ) : null}
                {detailT ? (
                  <div>
                    <div className="text-xs text-slate-400">세부내용</div>
                    <div className="mt-1 text-slate-800">
                      {stripTransitRoutePrefix(
                        expense.detail ?? "",
                        expense.transitFrom,
                        expense.transitTo
                      )}
                    </div>
                  </div>
                ) : null}
                {companionsPay ? (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <UsersIcon className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
                      함께한 사람
                    </div>
                    <div className="mt-1 text-slate-800">{companionsPay}</div>
                  </div>
                ) : null}
              </div>
            );
          })()
        ) : null}
        {showTransit2UsageCard ? (
          <div className="mt-8 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-3 text-sm text-slate-800 shadow-sm">
            <div className="text-sm font-semibold text-indigo-600">실사용</div>
            <div className="mt-3 space-y-4">
              {t2UsageSegments.map((seg, i) => {
                const dk = String(seg.dayKey ?? "").trim() || "—";
                const timeRange = transit2SegmentTimeRangeLine(seg);
                const route = transit2SegmentRouteLabel(seg);
                const memoLine = transit2SegmentMemoLine(seg);
                const showTimeRow = Boolean(timeRange && timeRange !== "—");
                return (
                  <div
                    key={`${dk}-${i}-${String(seg.start ?? "")}`}
                    className="rounded-xl border border-indigo-100/80 bg-white/60 px-3 py-3 shadow-sm"
                  >
                    <div className="text-xs font-semibold text-slate-500">{`구간${i + 1}`}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium tabular-nums text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                        {dk}
                      </span>
                      {showTimeRow ? (
                        <span className="inline-flex items-center gap-1.5">
                          <ClockIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                          {timeRange}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">이동</div>
                    <div className="mt-0.5 font-semibold leading-snug text-slate-900">{route}</div>
                    {memoLine ? (
                      <div className="mt-2">
                        <div className="text-xs text-slate-400">메모</div>
                        <div className="mt-0.5 leading-snug text-slate-800">{memoLine}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : differentPlannedDay ? (
          (() => {
            const pu = new Date(expense.plannedAt!);
            const timeStart = `${pad2(pu.getHours())}:${pad2(pu.getMinutes())}`;
            let timeRange = timeStart;
            if (expense.plannedEndAt) {
              const pe = new Date(expense.plannedEndAt);
              timeRange = `${timeStart}~${pad2(pe.getHours())}:${pad2(pe.getMinutes())}`;
            }
            const pm = (expense.plannedMemo ?? "").trim();
            const pc = (expense.plannedContent ?? "").trim();
            const plannedTitle = pc ? pm : "";
            const plannedBody = pc ? pc : pm;
            const pd = (expense.plannedDetail ?? "").trim();
            const pcomp = (expense.plannedCompanionsText ?? "").trim();
            const moveLine = plannedTitle || plannedBody;
            const memoLine =
              plannedTitle && plannedBody && plannedBody !== plannedTitle ? plannedBody : "";
            return (
              <div className="mt-8 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-3 text-sm text-slate-800 shadow-sm">
                <div className="text-sm font-semibold text-indigo-600">실사용</div>
                <div className="mt-3 space-y-4">
                  <div className="rounded-xl border border-indigo-100/80 bg-white/60 px-3 py-3 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">구간1</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium tabular-nums text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                        {yyyyMmDdLocal(pu)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ClockIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                        {timeRange}
                      </span>
                    </div>
                    {moveLine ? (
                      <>
                        <div className="mt-2 text-xs text-slate-400">이동</div>
                        <div className="mt-0.5 font-semibold leading-snug text-slate-900">{moveLine}</div>
                      </>
                    ) : null}
                    {memoLine ? (
                      <div className="mt-2">
                        <div className="text-xs text-slate-400">메모</div>
                        <div className="mt-0.5 leading-snug text-slate-800">{memoLine}</div>
                      </div>
                    ) : null}
                    {pd ? (
                      <div className="mt-2">
                        <div className="text-xs text-slate-400">세부내용</div>
                        <div className="mt-0.5 leading-snug text-slate-800">{pd}</div>
                      </div>
                    ) : null}
                    {pcomp ? (
                      <div className="mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <UsersIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                          함께한 사람
                        </div>
                        <div className="mt-0.5 leading-snug text-slate-800">{pcomp}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })()
        ) : null}
        {!differentPlannedDay && !(catNorm === "교통2" && showTransit2UsageCard) && catNorm !== "교통1" && (expense.subject ?? "").trim() ? (
          <div className="mt-3">
            <div className="text-xs text-slate-400">제목</div>
            <div className="mt-1 font-semibold text-slate-900">{(expense.subject ?? "").trim()}</div>
          </div>
        ) : null}
        {!differentPlannedDay && !(catNorm === "교통2" && showTransit2UsageCard) && catNorm !== "교통1" && expense.memo ? (
          <div className="mt-3">
            <div className="text-xs text-slate-400">내용</div>
            <div className="mt-1 text-slate-800">{expense.memo}</div>
          </div>
        ) : null}
        {!differentPlannedDay && !(catNorm === "교통2" && showTransit2UsageCard) && catNorm !== "교통1" && expense.detail ? (
          <div className="mt-3">
            <div className="text-xs text-slate-400">세부 내용</div>
            <div className="mt-1 text-slate-800">
              {stripTransitRoutePrefix(expense.detail, expense.transitFrom, expense.transitTo)}
            </div>
          </div>
        ) : null}
        {!differentPlannedDay && !(catNorm === "교통2" && showTransit2UsageCard) && companionsPay ? (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <UsersIcon className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
              함께한 사람
            </div>
            <div className="mt-1 text-slate-800">{companionsPay}</div>
          </div>
        ) : null}
      </div>

      {settlementTransfersForMe(expense, "나").length ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-sm font-semibold text-slate-900">정산</div>
          <div className="mt-2 space-y-2">
            {settlementTransfersForMe(expense, "나").map((t) => {
              const counterparty = t.from === "나" ? t.to : t.from;
              const key = `${t.from}→${t.to}:${t.amount}`;
              const expenseDay = yyyyMmDdLocal(new Date(expense.occurredAt));
              const done = isNetSettledForDay(expenseDay, counterparty);
              const signedAmount = t.from === "나" ? -t.amount : t.amount;
              return (
                <SettlementRow
                  key={key}
                  from={t.from}
                  to={t.to}
                  me="나"
                  amount={signedAmount}
                  settled={done}
                  onToggle={() => requestToggleNetSettledForDay(expenseDay, counterparty)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </ComposeSheet>
  );
}

export function expenseDetailSubtitle(expense: Expense, dayLocal00: Date): ReactNode {
  const timeText = expense.endAt
    ? timeRangeLabel(expense.occurredAt, expense.endAt)
    : expenseTimeLabel(expense.occurredAt, dayLocal00);
  const payMethodLine =
    expense.paymentType === "CASH"
      ? "현금"
      : (expense.paymentMethodLabel ?? "").trim() || PAYMENT_TYPE_LABEL[expense.paymentType];
  const payerLine = (expense.paymentOwner ?? "").trim() || "—";
  const isCardInstallment =
    expense.paymentType === "CARD" &&
    !!expense.installment &&
    expense.installmentMonths != null &&
    expense.installmentMonths >= 2;
  const installmentLine = isCardInstallment
    ? expense.installmentNoInterest
      ? `무이자 ${expense.installmentMonths}개월`
      : `${expense.installmentMonths}개월`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400">
      <span className="inline-flex items-center gap-1">
        <ClockIcon className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
        <span className="tabular-nums">{timeText}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <PaymentMethodIcon kind={expense.paymentType} className="h-4 w-4 shrink-0 text-slate-300" />
        <span>{payMethodLine}</span>
      </span>
      <span className="text-slate-300">|</span>
      <span>{payerLine}</span>
      {installmentLine ? (
        <>
          <span className="text-slate-300">|</span>
          <span>{installmentLine}</span>
        </>
      ) : null}
    </div>
  );
}

export function expenseDetailTitle(expense: Expense, viewerDayKey?: string): ReactNode {
  const seg = viewerDayKey ? findTransit2SegmentForViewerDay(expense, viewerDayKey) : null;
  if (seg) {
    const route = transit2SegmentRouteLabel(seg);
    return (
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">이동</div>
        <div className="mt-0.5 text-base font-semibold leading-snug text-slate-900">{route}</div>
      </div>
    );
  }
  const merchantLine = (expense.merchant ?? "").trim() || normalizeCategory(expense.category);
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">결제처</div>
      <div className="mt-0.5 text-base font-semibold leading-snug text-slate-900">{merchantLine}</div>
    </div>
  );
}
