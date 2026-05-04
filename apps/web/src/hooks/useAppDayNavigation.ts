import { useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { yyyyMmDdLocal, yyyyMmLocal } from "@/domain/date";
import { parseMainDayQuery } from "@/domain/mainDayQuery";

export function useAppDayNavigation(view: "main" | "today" | "month" | "calendar") {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const mainDayQuery = searchParams.get("day");

  const selectedDay = useMemo(() => {
    if (view === "today" && typeof params.day === "string") {
      const d = new Date(`${params.day}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        return d;
      }
    }
    if (view === "month" && typeof params.month === "string") {
      const d = new Date(`${params.month}-01T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        return d;
      }
    }
    if (view === "calendar" && typeof params.month === "string") {
      const d = new Date(`${params.month}-01T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        return d;
      }
    }
    if (view === "main") {
      const fromQuery = parseMainDayQuery(mainDayQuery);
      if (fromQuery) return fromQuery;
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [params.day, params.month, view, mainDayQuery]);

  const setSelectedDay = useCallback(
    (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      if (view === "month") navigate(`/month/${yyyyMmLocal(x)}`);
      else if (view === "calendar") navigate(`/calendar/${yyyyMmLocal(x)}`);
      else if (view === "today") navigate(`/today/${yyyyMmDdLocal(x)}`);
      else {
        const key = yyyyMmDdLocal(x);
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set("day", key);
            return next;
          },
          { replace: true }
        );
      }
    },
    [navigate, view, setSearchParams]
  );

  const dayKey = useMemo(() => yyyyMmDdLocal(selectedDay), [selectedDay]);
  const monthKey = useMemo(() => yyyyMmLocal(selectedDay), [selectedDay]);
  const dayLocal00 = useMemo(() => {
    const d = new Date(selectedDay);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDay]);

  return { navigate, selectedDay, setSelectedDay, dayKey, monthKey, dayLocal00 };
}
