import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createSchedule, deleteSchedule, listSchedules, updateSchedule } from "./api";

async function invalidateSchedules(qc: QueryClient, day?: string) {
  const queryKey = day ? ["schedules", day] : ["schedules"];
  await qc.invalidateQueries({ queryKey });
}

export function useSchedules(day: string) {
  return useQuery({
    queryKey: ["schedules", day],
    queryFn: () => listSchedules(day)
  });
}

export function useCreateSchedule(dayToInvalidate?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => invalidateSchedules(qc, dayToInvalidate)
  });
}

export function useUpdateSchedule(dayToInvalidate?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateSchedule>[1] }) =>
      updateSchedule(id, input),
    onSuccess: () => invalidateSchedules(qc, dayToInvalidate)
  });
}

export function useDeleteSchedule(dayToInvalidate?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => invalidateSchedules(qc, dayToInvalidate)
  });
}
