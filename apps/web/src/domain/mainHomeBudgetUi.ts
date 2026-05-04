import { daysInMonth } from "@/domain/date";
import { clamp01 } from "@/domain/expensePaymentUi";

export type MainHomeBudgetUi = {
  monthTotal: number;
  todayTotal: number;
  monthTotalOverall: number;
  todayTotalOverall: number;
  dailyBudget: number;
  monthPct: number;
  todayPct: number;
  message: string;
  days: number;
  dayOfMonth: number;
  expectedToDate: number;
  expectedPctText: number;
  monthPctText: number;
  paceUi: { emoji: string; message: string; bubble: string };
  budgetWon: number;
};

export function computeMainHomeBudgetUi(input: {
  monthToDateTotal: number;
  myMonthToDateTotal: number;
  myTodayTotal: number;
  selectedDay: Date;
  todaySummaryTotal: number;
  monthlyBudgetWon: number;
  pacePreview: null | "onTrack" | "under" | "over";
}): MainHomeBudgetUi {
  const {
    monthToDateTotal,
    myMonthToDateTotal,
    myTodayTotal,
    selectedDay,
    todaySummaryTotal,
    monthlyBudgetWon,
    pacePreview
  } = input;

  const monthTotal = myMonthToDateTotal;
  const todayTotal = myTodayTotal;
  const d = daysInMonth(selectedDay);
  const dayOfMonth = selectedDay.getDate();
  const dailyBudget = monthlyBudgetWon / d;
  const monthPct = clamp01(monthTotal / monthlyBudgetWon);
  const todayPct = clamp01(todayTotal / dailyBudget);
  const expectedToDate = (monthlyBudgetWon * dayOfMonth) / d;
  const expectedPct = clamp01(dayOfMonth / d);
  const expectedPctText = Math.round(expectedPct * 100);
  const monthPctText = Math.round(monthPct * 100);
  const delta = monthTotal - expectedToDate;
  const paceBand = Math.max(50_000, monthlyBudgetWon * 0.02);
  const computedPaceStatus: "under" | "onTrack" | "over" =
    Math.abs(delta) <= paceBand ? "onTrack" : delta < 0 ? "under" : "over";
  const paceStatus: "under" | "onTrack" | "over" = pacePreview ?? computedPaceStatus;
  const paceUi =
    paceStatus === "onTrack"
      ? {
          emoji: "✨",
          message: "예산 페이스가 딱 맞아요. 지금처럼만 가면 돼요!",
          bubble: "border-sky-200 bg-sky-50 text-sky-900"
        }
      : paceStatus === "under"
        ? {
            emoji: "😌",
            message: "편안한 마음으로 지출을 이어가도 좋겠어요!",
            bubble: "border-emerald-200 bg-emerald-50 text-emerald-900"
          }
        : {
            emoji: "🔥",
            message: "예산 페이스 초과!!!!! 망함ㅠㅠ",
            bubble: "border-rose-200 bg-rose-50 text-rose-900"
          };

  const message = paceUi.message;
  return {
    monthTotal,
    todayTotal,
    monthTotalOverall: monthToDateTotal,
    todayTotalOverall: todaySummaryTotal,
    dailyBudget,
    monthPct,
    todayPct,
    message,
    days: d,
    dayOfMonth,
    expectedToDate,
    expectedPctText,
    monthPctText,
    paceUi,
    budgetWon: monthlyBudgetWon
  };
}
