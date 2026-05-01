import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createSchedule, deleteSchedule, listSchedules, updateSchedule } from "./api";

async function invalidateSchedules(qc: QueryClient) {
  // day별 쿼리가 여러 개라서 prefix로 전부 무효화 (작성일 ≠ 현재 화면 날짜일 때도 갱신됨)
  await qc.invalidateQueries({ queryKey: ["schedules"] });
}

export function useSchedules(day: string) {
  return useQuery({
    queryKey: ["schedules", day],
    queryFn: () => listSchedules(day)
  });
}

export function useCreateSchedule(_dayToInvalidate?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => invalidateSchedules(qc)
  });
}

export function useUpdateSchedule(_dayToInvalidate?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateSchedule>[1] }) =>
      updateSchedule(id, input),
    onSuccess: () => invalidateSchedules(qc)
  });
}

export function useDeleteSchedule(_dayToInvalidate?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => invalidateSchedules(qc)
  });
}
