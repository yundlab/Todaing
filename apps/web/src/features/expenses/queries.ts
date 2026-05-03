import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createExpense,
  deleteExpense,
  getExpenseSummary,
  getMonthlyExpenseSummary,
  listExpenses,
  updateExpense,
  type ExpenseListResponse
} from "@/features/expenses/api";

const EXPENSE_QUERY_KEYS = [
  ["expenses"],
  ["expenses", "summary"],
  ["expenses", "monthlySummary"]
] as const;

async function invalidateExpenseQueries(qc: QueryClient) {
  await Promise.all(EXPENSE_QUERY_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useExpenses(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  return useQuery({
    queryKey: ["expenses"],
    queryFn: listExpenses,
    enabled,
    // 리패치 중에도 이전 목록 유지 → 방금 등록한 지출 카드가 비었다가 사라지는 느낌 완화
    placeholderData: (previousData) => previousData
  });
}

export function useExpenseSummary(day: string, opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  return useQuery({
    queryKey: ["expenses", "summary", day],
    queryFn: () => getExpenseSummary(day),
    enabled
  });
}

export function useMonthlyExpenseSummary(month: string, opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  return useQuery({
    queryKey: ["expenses", "monthlySummary", month],
    queryFn: () => getMonthlyExpenseSummary(month),
    enabled
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExpense,
    onSuccess: (created) => {
      qc.setQueryData<ExpenseListResponse>(["expenses"], (old) => {
        const prev = old?.items ?? [];
        const rest = prev.filter((e) => e.id !== created.id);
        const items = [created, ...rest].sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );
        return { items };
      });
      void invalidateExpenseQueries(qc);
    }
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateExpense>[1] }) =>
      updateExpense(id, input),
    onSuccess: (updated) => {
      qc.setQueryData<ExpenseListResponse>(["expenses"], (old) => {
        const prev = old?.items ?? [];
        const items = prev.map((e) => (e.id === updated.id ? updated : e)).sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );
        return { items };
      });
      void invalidateExpenseQueries(qc);
    }
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<ExpenseListResponse>(["expenses"], (old) => {
        if (!old?.items?.length) return old;
        return { items: old.items.filter((e) => e.id !== id) };
      });
      void invalidateExpenseQueries(qc);
    }
  });
}
