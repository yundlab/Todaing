import type { ReactNode } from "react";
import { ClockIcon, PaymentMethodIcon } from "@/components/icons";
import type { Expense } from "@/features/expenses/api";
import { expenseTimeLabel, timeRangeLabel } from "@/domain/date";
import { normalizeCategory } from "@/domain/categoryUi";
import { PAYMENT_TYPE_LABEL } from "@/domain/expensePaymentUi";
import {
  findTransit2SegmentForViewerDay,
  transit2SegmentRouteLabel
} from "@/domain/expenseTransitText";

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
