import type { Expense } from "@/features/expenses/api";
import type { ScheduleItem } from "@/features/schedules/api";
import { dateFromSlotMinutes } from "@/domain/date";
import { parseFlexibleTimeToMinutes } from "@/domain/time";
import type { TimelineItem } from "@/domain/timelineTypes";
import { plannedUsageDaySlices } from "@/domain/plannedUsageOnDay";
import { prettifyTransitPlaceName, transit2UsageMemoForCard } from "@/domain/expenseTransitText";
import { eachTransit2OffPaymentSegment } from "@/domain/transit2OffPaymentSegments";

type BuildMainHomeTimelineArgs = {
  todayExpensesDisplay: Expense[];
  expensesAll: Expense[] | undefined;
  scheduleItems: ScheduleItem[] | undefined;
  dayKey: string;
  dayLocal00: Date;
};

export function buildMainHomeTimelineItems(args: BuildMainHomeTimelineArgs): TimelineItem[] {
  const { todayExpensesDisplay, expensesAll, scheduleItems, dayKey, dayLocal00 } = args;
  const all = expensesAll ?? [];

  const expenseItems: TimelineItem[] = todayExpensesDisplay.map((e) => ({
    kind: "expense",
    startMs: new Date(e.occurredAt).getTime(),
    expense: e
  }));

  const plannedAtUsageExpenseItems: TimelineItem[] = plannedUsageDaySlices(dayKey, all, dayLocal00).map(
    (slice) => ({
      kind: "usage-expense" as const,
      startMs: slice.startMs,
      expense: slice.expense,
      label: slice.label,
      startText: slice.startText,
      endText: slice.endText,
      usageMemo: slice.usageMemo,
      ...(slice.usageTransitMode ? { usageTransitMode: slice.usageTransitMode } : {})
    })
  );

  const usageExpenseItems: TimelineItem[] = [];
  eachTransit2OffPaymentSegment(all, { kind: "day", dayKey }, ({ expense, segment }) => {
    const startText = typeof segment.start === "string" ? String(segment.start).trim() : "";
    const endText = typeof segment.end === "string" ? String(segment.end).trim() : "";
    const usageMemo = transit2UsageMemoForCard(expense, segment);
    const usageTransitMode = typeof segment.mode === "string" ? String(segment.mode).trim() : "";
    const m = startText ? parseFlexibleTimeToMinutes(startText) : null;
    const startMs = m != null ? dateFromSlotMinutes(dayLocal00, m).getTime() : dayLocal00.getTime();
    const from = typeof segment.from === "string" ? String(segment.from).trim() : "";
    const to = typeof segment.to === "string" ? String(segment.to).trim() : "";
    const fromP = prettifyTransitPlaceName(from);
    const toP = prettifyTransitPlaceName(to);
    const label = from || to ? `${fromP || "?"} → ${toP || "?"}` : "이동";
    usageExpenseItems.push({
      kind: "usage-expense",
      startMs,
      expense,
      label,
      startText,
      endText,
      usageMemo,
      ...(usageTransitMode ? { usageTransitMode } : {})
    });
  });

  const schedules = scheduleItems ?? [];
  const scheduleItemsOut: TimelineItem[] = schedules.map((s) => ({
    kind: "schedule",
    startMs: new Date(s.startAt).getTime(),
    id: s.id,
    startAt: s.startAt,
    endAt: s.endAt,
    title: s.title,
    note: s.note,
    linkedExpenseSum: 0
  }));

  return [...scheduleItemsOut, ...expenseItems, ...plannedAtUsageExpenseItems, ...usageExpenseItems].sort(
    (a, b) => a.startMs - b.startMs
  );
}
