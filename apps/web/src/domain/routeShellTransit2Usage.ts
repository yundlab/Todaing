import type { Expense } from "@/features/expenses/api";
import { transit2UsageMemoForCard } from "@/domain/expenseTransitText";
import { eachTransit2OffPaymentSegment } from "@/domain/transit2OffPaymentSegments";

type UsageTransit2DayRow = {
  label: string;
  startText: string;
  endText: string;
  memo: string;
  mode?: string;
};

export function buildUsageTransit2RowsForDay(dayKey: string, all: Expense[]): UsageTransit2DayRow[] {
  const out: UsageTransit2DayRow[] = [];
  eachTransit2OffPaymentSegment(all, { kind: "day", dayKey }, ({ expense, segment }) => {
    const from = typeof segment.from === "string" ? String(segment.from).trim() : "";
    const to = typeof segment.to === "string" ? String(segment.to).trim() : "";
    const label = from || to ? `${from || "?"} → ${to || "?"}`.trim() : "이동";
    const startText = typeof segment.start === "string" ? String(segment.start).trim() : "";
    const endText = typeof segment.end === "string" ? String(segment.end).trim() : "";
    const memo = transit2UsageMemoForCard(expense, segment);
    const mode = typeof segment.mode === "string" ? String(segment.mode).trim() : "";
    out.push({ label, startText, endText, memo, ...(mode ? { mode } : {}) });
  });
  return out;
}

export function buildUsageTransit2CountsByDayForMonth(monthKey: string, all: Expense[]): Map<string, number> {
  const byDay = new Map<string, number>();
  eachTransit2OffPaymentSegment(all, { kind: "month", monthKey }, ({ segmentDayKey }) => {
    byDay.set(segmentDayKey, (byDay.get(segmentDayKey) ?? 0) + 1);
  });
  return byDay;
}
