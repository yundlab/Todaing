import { http } from "@/lib/http";

export type Expense = {
  id: string;
  occurredAt: string; // ISO
  endAt: string | null; // ISO
  amount: number;
  category: string;
  merchant: string | null;
  /** 결제 건 제목. 구 API 응답에는 없을 수 있음. */
  subject?: string | null;
  detail: string | null;
  memo: string | null;
  paymentType: "CARD" | "CASH" | "ACCOUNT" | "ETC";
  paymentOwner: string | null;
  paymentMethodLabel: string | null;
  installment: boolean;
  installmentMonths: number | null;
  /** API/구데이터에 없을 수 있음 */
  installmentNoInterest?: boolean;
  /** 결제일(occurredAt)과 다른 사용 예정/실제일. null이면 결제일과 동일. */
  plannedAt: string | null;
  plannedEndAt: string | null;
  /** 다른 날 사용 — 실제 이용 제목 */
  plannedMemo: string | null;
  /** 다른 날 사용 — 실제 이용 내용 */
  plannedContent?: string | null;
  plannedDetail: string | null;
  plannedCompanionsText: string | null;
  scope: "PERSONAL" | "SHARED";
  participants: unknown | null;
  transitFrom: string | null;
  transitTo: string | null;
  transitVia: string | null;
  transitLine: string | null;
  transitMode: string | null;
  transitBusNumber: string | null;
  transitSegments: unknown | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseCreateInput = {
  occurredAt: string; // ISO date-time
  endAt?: string | null; // ISO date-time
  amount: number;
  category: string;
  merchant?: string | null;
  subject?: string | null;
  detail?: string | null;
  memo?: string | null;
  paymentType?: "CARD" | "CASH" | "ACCOUNT" | "ETC";
  paymentOwner?: string | null;
  paymentMethodLabel?: string | null;
  installment?: boolean;
  installmentMonths?: number | null;
  installmentNoInterest?: boolean;
  plannedAt?: string | null;
  plannedEndAt?: string | null;
  plannedMemo?: string | null;
  plannedContent?: string | null;
  plannedDetail?: string | null;
  plannedCompanionsText?: string | null;
  scope?: "PERSONAL" | "SHARED";
  participants?: unknown | null;
  transitFrom?: string | null;
  transitTo?: string | null;
  transitVia?: string | null;
  transitLine?: string | null;
  transitMode?: string | null;
  transitBusNumber?: string | null;
  transitSegments?: unknown | null;
};

export type ExpenseListResponse = {
  items: Expense[];
};

export function listExpenses(): Promise<ExpenseListResponse> {
  return http("/api/expenses");
}

export function createExpense(input: ExpenseCreateInput): Promise<Expense> {
  return http("/api/expenses", { method: "POST", body: JSON.stringify(input) });
}

export type ExpenseSummaryResponse = {
  day: string;
  total: number;
  byCategory: Record<string, number>;
};

export type MonthlyExpenseSummaryResponse = {
  month: string;
  total: number;
  byCategory: Record<string, number>;
};

export function getExpenseSummary(day: string): Promise<ExpenseSummaryResponse> {
  return http(`/api/expenses/summary?day=${encodeURIComponent(day)}`);
}

export function getMonthlyExpenseSummary(
  month: string
): Promise<MonthlyExpenseSummaryResponse> {
  return http(`/api/expenses/monthly-summary?month=${encodeURIComponent(month)}`);
}

export function getExpense(id: string): Promise<Expense> {
  return http(`/api/expenses/${encodeURIComponent(id)}`);
}

export type ExpenseUpdateInput = Partial<ExpenseCreateInput>;

export function updateExpense(id: string, input: ExpenseUpdateInput): Promise<Expense> {
  return http(`/api/expenses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteExpense(id: string): Promise<void> {
  return http(`/api/expenses/${encodeURIComponent(id)}`, { method: "DELETE" });
}

