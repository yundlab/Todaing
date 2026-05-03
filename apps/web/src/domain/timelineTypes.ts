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
      /** 교통2 구간별 이용 카드: 그날 구간에 저장된 수단 이모지(🚆·🚍·🚖·✈️ 등) */
      usageTransitMode?: string;
    };
