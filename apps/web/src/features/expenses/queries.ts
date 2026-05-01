import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createExpense,
  deleteExpense,
  getExpenseSummary,
  getMonthlyExpenseSummary,
  listExpenses,
  updateExpense
} from "./api";

const EXPENSE_QUERY_KEYS = [
  ["expenses"],
  ["expenses", "summary"],
  ["expenses", "monthlySummary"]
] as const;

async function invalidateExpenseQueries(qc: QueryClient) {
  await Promise.all(EXPENSE_QUERY_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: listExpenses
  });
}

export function useExpenseSummary(day: string) {
  return useQuery({
    queryKey: ["expenses", "summary", day],
    queryFn: () => getExpenseSummary(day)
  });
}

export function useMonthlyExpenseSummary(month: string) {
  return useQuery({
    queryKey: ["expenses", "monthlySummary", month],
    queryFn: () => getMonthlyExpenseSummary(month)
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => invalidateExpenseQueries(qc)
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateExpense>[1] }) =>
      updateExpense(id, input),
    onSuccess: () => invalidateExpenseQueries(qc)
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => invalidateExpenseQueries(qc)
  });
}
