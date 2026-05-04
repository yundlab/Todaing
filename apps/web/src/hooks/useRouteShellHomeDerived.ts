import { useCallback, useMemo } from "react";
import type { Expense } from "@/features/expenses/api";
import type { ScheduleItem } from "@/features/schedules/api";
import { yyyyMmDdLocal } from "@/domain/date";
import { sumExpensesForMonthToDate, type AggregateMode } from "@/domain/installment";
import { buildMainHomeTimelineItems } from "@/domain/mainHomeTimeline";
import { computeMainHomeBudgetUi } from "@/domain/mainHomeBudgetUi";
import {
  computeMyTodayTotal,
  computeSettlementAllByDay,
  computeSettlementToday
} from "@/domain/routeShellSettlement";
import { buildTodayExpensesDisplay } from "@/domain/todayExpensesCashflowDisplay";

export function useRouteShellHomeDerived(input: {
  expensesData: { items?: Expense[] } | undefined;
  scheduleData: { items?: ScheduleItem[] } | undefined;
  dayKey: string;
  dayLocal00: Date;
  aggregateMode: AggregateMode;
  monthKey: string;
  selectedDay: Date;
  monthlyBudgetWon: number;
  todaySummaryTotal: number | undefined;
  pacePreview: null | "onTrack" | "under" | "over";
}) {
  const {
    expensesData,
    scheduleData,
    dayKey,
    dayLocal00,
    aggregateMode,
    monthKey,
    selectedDay,
    monthlyBudgetWon,
    todaySummaryTotal,
    pacePreview
  } = input;

  const todayExpenses = useMemo(() => {
    const items = expensesData?.items ?? [];
    return items
      .filter((e) => yyyyMmDdLocal(new Date(e.occurredAt)) === dayKey)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [expensesData, dayKey]);

  const resolveOriginalExpense = useCallback(
    (e: Expense) => {
      const id = String(e.id || "");
      const marker = "::cashflow::";
      if (!id.includes(marker)) return e;
      const originalId = id.split(marker)[0] ?? id;
      const all = expensesData?.items ?? [];
      return all.find((x) => x.id === originalId) ?? e;
    },
    [expensesData?.items]
  );

  const todayExpensesDisplay = useMemo(
    () => buildTodayExpensesDisplay(aggregateMode, dayKey, expensesData?.items, todayExpenses),
    [aggregateMode, dayKey, expensesData?.items, todayExpenses]
  );

  const monthToDateTotal = useMemo(() => {
    const items = expensesData?.items ?? [];
    return sumExpensesForMonthToDate(aggregateMode, items, monthKey, dayKey);
  }, [aggregateMode, dayKey, expensesData, monthKey]);

  const myMonthToDateTotal = useMemo(() => {
    const items = expensesData?.items ?? [];
    return sumExpensesForMonthToDate(aggregateMode, items, monthKey, dayKey, {
      onlyMine: true,
      me: "나"
    });
  }, [aggregateMode, dayKey, expensesData, monthKey]);

  const myTodayTotal = useMemo(() => computeMyTodayTotal(todayExpenses), [todayExpenses]);

  const settlementToday = useMemo(() => computeSettlementToday(todayExpenses), [todayExpenses]);

  const settlementAllByDay = useMemo(
    () => computeSettlementAllByDay(expensesData?.items ?? []),
    [expensesData?.items]
  );

  const budgetUi = useMemo(
    () =>
      computeMainHomeBudgetUi({
        monthToDateTotal,
        myMonthToDateTotal,
        myTodayTotal,
        selectedDay,
        todaySummaryTotal: todaySummaryTotal ?? 0,
        monthlyBudgetWon,
        pacePreview
      }),
    [
      monthToDateTotal,
      myMonthToDateTotal,
      myTodayTotal,
      selectedDay,
      todaySummaryTotal,
      monthlyBudgetWon,
      pacePreview
    ]
  );

  const timeline = useMemo(
    () =>
      buildMainHomeTimelineItems({
        todayExpensesDisplay,
        expensesAll: expensesData?.items,
        scheduleItems: scheduleData?.items,
        dayKey,
        dayLocal00
      }),
    [todayExpensesDisplay, scheduleData?.items, expensesData?.items, dayKey, dayLocal00]
  );

  return {
    todayExpenses,
    resolveOriginalExpense,
    todayExpensesDisplay,
    monthToDateTotal,
    myMonthToDateTotal,
    myTodayTotal,
    settlementToday,
    settlementAllByDay,
    budgetUi,
    timeline
  };
}
