import type { ReactNode } from "react";
import ComposeSheet from "@/components/ComposeSheet";
import SettlementRow from "@/components/SettlementRow";
import { BusIcon, ClockIcon, PaymentMethodIcon, UsersIcon } from "@/components/icons/index";
import type { Expense } from "@/features/expenses/api";
import { expenseTimeLabel, timeRangeLabel, yyyyMmDdLocal } from "@/domain/date";
import { formatWon, companionsExcludingPayerLabel, settlementTransfersForMe } from "@/domain/settlement";
import { normalizeCategory } from "@/domain/categoryUi";
import { PAYMENT_TYPE_LABEL } from "@/domain/expensePaymentUi";
import { stripTransitRoutePrefix } from "@/domain/expenseTransitText";
import { parseAmountInput } from "@/domain/parseAmountInput";

export default function ExpenseDetailSheet({
  expense,
  title,
  subtitle,
  onClose,
  footer,
  isNetSettledForDay,
  requestToggleNetSettledForDay
}: {
  expense: Expense;
  title: ReactNode;
  subtitle: ReactNode;
  onClose: () => void;
  footer: ReactNode;
  isNetSettledForDay: (_day: string, _name: string) => boolean;
  requestToggleNetSettledForDay: (_day: string, _name: string) => void;
}) {
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
            const transit1BusNumber = (() => {
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
            const from = (expense.transitFrom ?? "?").trim() || "?";
            const to = (expense.transitTo ?? "?").trim() || "?";
            return (
              <>
                <div className="mt-3">
                  <div className="text-xs text-slate-400">이동</div>
                  <div className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                    <BusIcon className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                    <span>
                      {from} → {to}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-slate-400">NO.</div>
                  <div className="mt-1 font-semibold text-slate-900">{transit1BusNumber || "-"}</div>
                </div>
                {(() => {
                  const seg = expense.transitSegments;
                  if (!Array.isArray(seg) || !seg.length) return null;
                  return (
                    <div className="mt-3">
                      <div className="text-xs text-slate-400">구간별 금액</div>
                      <ul className="mt-2 space-y-2">
                        {(seg as unknown[]).map((raw, i) => {
                          if (!raw || typeof raw !== "object") return null;
                          const o = raw as Record<string, unknown>;
                          const mode = typeof o.mode === "string" ? o.mode.toUpperCase() : "";
                          const label = i === 0 ? "구간 1" : `환승 ${i}`;
                          const amtRaw = o.amount;
                          const amt =
                            typeof amtRaw === "number" && Number.isFinite(amtRaw)
                              ? Math.trunc(amtRaw)
                              : parseAmountInput(String(amtRaw ?? ""));
                          let route = "";
                          if (mode === "BUS") {
                            route = `${String(o.from ?? "").trim() || "?"} → ${String(o.to ?? "").trim() || "?"}`;
                          } else if (mode === "SUBWAY") {
                            route = `${String(o.from ?? "").trim() || "?"} → ${String(o.to ?? "").trim() || "?"}`;
                            const line = String(o.line ?? "").trim();
                            if (line) route += ` · ${line}`;
                          } else {
                            route = "—";
                          }
                          return (
                            <li
                              key={i}
                              className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-800"
                            >
                              <div className="text-xs font-semibold text-slate-500">{label}</div>
                              <div className="mt-0.5 font-medium text-slate-800">{route}</div>
                              <div className="mt-1 text-sm font-bold tabular-nums text-indigo-700">
                                {amt != null && amt > 0 ? formatWon(amt) : "—"}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })()}
                <div className="mt-3">
                  <div className="text-xs text-slate-400">세부 내용</div>
                  <div className="mt-1 text-slate-800">{(expense.detail ?? "").trim() || "-"}</div>
                </div>
              </>
            );
          })()
        ) : null}
        {normalizeCategory(expense.category) !== "교통1" &&
        (() => {
          const hideTransitBecauseUsageDay =
            normalizeCategory(expense.category) === "교통2" &&
            expense.plannedAt &&
            yyyyMmDdLocal(new Date(expense.plannedAt)) !== yyyyMmDdLocal(new Date(expense.occurredAt));
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
        {normalizeCategory(expense.category) !== "교통1" && expense.memo ? (
          <div className="mt-3">
            <div className="text-xs text-slate-400">내용</div>
            <div className="mt-1 text-slate-800">{expense.memo}</div>
          </div>
        ) : null}
        {normalizeCategory(expense.category) !== "교통1" && expense.detail ? (
          <div className="mt-3">
            <div className="text-xs text-slate-400">세부 내용</div>
            <div className="mt-1 text-slate-800">
              {stripTransitRoutePrefix(expense.detail, expense.transitFrom, expense.transitTo)}
            </div>
          </div>
        ) : null}
        {companionsExcludingPayerLabel(expense).trim() ? (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <UsersIcon className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
              함께한 사람
            </div>
            <div className="mt-1 text-slate-800">{companionsExcludingPayerLabel(expense)}</div>
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

export function expenseDetailTitle(expense: Expense): ReactNode {
  const merchantLine = (expense.merchant ?? "").trim() || normalizeCategory(expense.category);
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">결제처</div>
      <div className="mt-0.5 text-base font-semibold leading-snug text-slate-900">{merchantLine}</div>
    </div>
  );
}
