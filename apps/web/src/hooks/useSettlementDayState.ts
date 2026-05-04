import { useCallback, useState } from "react";
import type { Expense } from "@/features/expenses/api";
import { settlementTransfersForMe } from "@/domain/settlement";
import {
  normalizeLegacySettlementMethod,
  settlementRecordKey,
  type SettlementRecord
} from "@/domain/settlementDay";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";

type SettlementLogOpen =
  | null
  | { day: string; other: string; revertOnClose: boolean; hadRecordAtOpen?: boolean };

export function useSettlementDayState() {
  const [settlementRecordByKey, setSettlementRecordByKey] = useLocalStorageState<
    Record<string, SettlementRecord>
  >("settlementRecordByKey", {});

  const [settledNetByPeriodKey, setSettledNetByPeriodKey] = useLocalStorageState<
    Record<string, string[]>
  >("settledNetByPeriodKey", {});

  const isNetSettled = useCallback(
    (periodKey: string, other: string) => (settledNetByPeriodKey[periodKey] ?? []).includes(other),
    [settledNetByPeriodKey]
  );

  const toggleNetSettled = useCallback((periodKey: string, other: string) => {
    setSettledNetByPeriodKey((prev) => {
      const list = new Set(prev[periodKey] ?? []);
      if (list.has(other)) list.delete(other);
      else list.add(other);
      return { ...prev, [periodKey]: Array.from(list) };
    });
  }, [setSettledNetByPeriodKey]);

  const isNetSettledForDay = useCallback(
    (day: string, other: string) => isNetSettled(`day:${day}`, other),
    [isNetSettled]
  );

  const toggleNetSettledForDay = useCallback(
    (day: string, other: string) => toggleNetSettled(`day:${day}`, other),
    [toggleNetSettled]
  );

  const [settlementLogOpen, setSettlementLogOpen] = useState<SettlementLogOpen>(null);
  const [settlementLogPaidAtLocal, setSettlementLogPaidAtLocal] = useState("");
  const [settlementLogMethod, setSettlementLogMethod] = useState<string>("카뱅");
  const [settlementLogNote, setSettlementLogNote] = useState("");

  const openSettlementLog = useCallback(
    (day: string, other: string, revertOnClose: boolean) => {
      const existing = settlementRecordByKey[settlementRecordKey(day, other)] ?? null;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const defaultLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
        now.getHours()
      )}:${pad(now.getMinutes())}`;
      setSettlementLogPaidAtLocal(existing?.paidAtLocal ?? defaultLocal);
      setSettlementLogMethod(normalizeLegacySettlementMethod(existing?.method));
      setSettlementLogNote(existing?.note ?? "");
      setSettlementLogOpen({
        day,
        other,
        revertOnClose,
        hadRecordAtOpen: Boolean(settlementRecordByKey[settlementRecordKey(day, other)])
      });
    },
    [settlementRecordByKey]
  );

  const deleteSettlementRecord = useCallback(() => {
    if (!settlementLogOpen) return;
    const { day, other } = settlementLogOpen;
    const key = settlementRecordKey(day, other);
    if (isNetSettledForDay(day, other)) {
      toggleNetSettledForDay(day, other);
    }
    setSettlementRecordByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSettlementLogOpen(null);
  }, [settlementLogOpen, isNetSettledForDay, toggleNetSettledForDay, setSettlementRecordByKey]);

  const requestToggleNetSettledForDay = useCallback(
    (day: string, other: string) => {
      const settled = isNetSettledForDay(day, other);
      if (settled) {
        openSettlementLog(day, other, false);
        return;
      }
      openSettlementLog(day, other, true);
    },
    [isNetSettledForDay, openSettlementLog]
  );

  const isExpenseNetSettledForDay = useCallback(
    (day: string, e: Expense, me: string) => {
      const transfers = settlementTransfersForMe(e, me);
      if (!transfers.length) return false;
      const others = Array.from(
        new Set(
          transfers
            .flatMap((t) => [t.from, t.to])
            .map((x) => String(x).trim())
            .filter((x) => x && x !== me)
        )
      );
      if (!others.length) return false;
      return others.every((o) => isNetSettledForDay(day, o));
    },
    [isNetSettledForDay]
  );

  return {
    settlementRecordKey,
    setSettlementRecordByKey,
    isNetSettledForDay,
    toggleNetSettledForDay,
    settlementLogOpen,
    setSettlementLogOpen,
    settlementLogPaidAtLocal,
    setSettlementLogPaidAtLocal,
    settlementLogMethod,
    setSettlementLogMethod,
    settlementLogNote,
    setSettlementLogNote,
    openSettlementLog,
    deleteSettlementRecord,
    requestToggleNetSettledForDay,
    isExpenseNetSettledForDay
  };
}
