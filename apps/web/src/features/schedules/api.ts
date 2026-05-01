import { http } from "../../lib/http";

export type ScheduleItem = {
  id: string;
  startAt: string;
  endAt: string;
  title: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleCreateInput = {
  startAt: string;
  endAt: string;
  title: string;
  note?: string | null;
};

export type ScheduleListResponse = {
  items: ScheduleItem[];
};

export function listSchedules(day: string): Promise<ScheduleListResponse> {
  return http(`/api/schedules?day=${encodeURIComponent(day)}`);
}

export function createSchedule(input: ScheduleCreateInput): Promise<ScheduleItem> {
  return http("/api/schedules", { method: "POST", body: JSON.stringify(input) });
}

export type ScheduleUpdateInput = Partial<ScheduleCreateInput>;

export function updateSchedule(id: string, input: ScheduleUpdateInput): Promise<ScheduleItem> {
  return http(`/api/schedules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteSchedule(id: string): Promise<void> {
  return http(`/api/schedules/${encodeURIComponent(id)}`, { method: "DELETE" });
}

