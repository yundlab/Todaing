import type { Expense } from "@/features/expenses/api";
import type { MainHomeBudgetUi } from "@/domain/mainHomeBudgetUi";
import type { AggregateMode } from "@/domain/installment";
import type { TimelineItem } from "@/domain/timelineTypes";

export type { MainHomeBudgetUi };

export type MainHomeViewProps = {
  showCategoryPreview: boolean;
  expensesError: unknown;
  scheduleError: unknown;
  budgetUi: MainHomeBudgetUi;
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
