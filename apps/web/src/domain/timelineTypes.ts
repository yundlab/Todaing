import type { Expense } from "@/features/expenses/api";

export type TimelineItem =
  | {
      kind: "schedule";
      startMs: number;
      id: string;
      startAt: string;
      endAt: string | null;
      title: string;
      note: string | null;
      linkedExpenseSum: number;
    }
  | {
      kind: "expense";
      startMs: number;
      expense: Expense;
    }
  | {
      kind: "usage-expense";
      startMs: number;
      expense: Expense;
      label: string;
      startText: string;
      endText: string;
      usageMemo: string;
    };
