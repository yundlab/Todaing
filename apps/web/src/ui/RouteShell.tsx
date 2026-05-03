import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenseSummary,
  useExpenses,
  useMonthlyExpenseSummary,
  useUpdateExpense
} from "@/features/expenses/queries";
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMonthSchedules,
  useSchedules,
  useUpdateSchedule
} from "@/features/schedules/queries";
import type { Expense } from "@/features/expenses/api";
import type { ScheduleItem } from "@/features/schedules/api";
import { emptyTransit1Leg, type TransitLeg, type Transit2SegmentDraft } from "@/domain/transitPayload";
import Header from "@/components/Header";
import LoginScreen from "@/components/LoginScreen";
import { AUTH_USER_LS_KEY, type AuthUser } from "@/lib/auth";
import SettlementRecordDialog from "@/components/SettlementRecordDialog";
import StationSearchSheet, { type StationSearchTarget } from "@/components/StationSearchSheet";
import BusStopSearchSheet from "@/components/BusStopSearchSheet";
import BottomNav from "@/components/BottomNav";
import ComposeSheet from "@/components/ComposeSheet";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { useExpenseComposeForm } from "@/hooks/useExpenseComposeForm";
import { useComposeSubmit } from "@/hooks/useComposeSubmit";
import { dateFromSlotMinutes, daysInMonth, pad2, yyyyMmDdLocal, yyyyMmLocal } from "@/domain/date";
import { parseFlexibleTimeToMinutes } from "@/domain/time";
import { encodeScheduleNote, parseScheduleNote } from "@/domain/scheduleNote";
import {
  effectiveMonthlyBudgetWon,
  MONTHLY_BUDGET_BY_YM_LS_KEY,
  parseMonthlyBudgetByYm,
  readLegacyMonthlyBudgetWonFromStorage,
  serializeMonthlyBudgetByYm
} from "@/domain/monthlyBudgetStorage";
import { formatWon, myShareAmountForMe, settlementDeltaForMe, settlementTransfersForMe } from "@/domain/settlement";
import { normalizeCategory, parseEmojiPrefixedTitle } from "@/domain/categoryUi";
import {
  AGGREGATE_MODE_LS_KEY,
  expenseCashflowAllocations,
  sumExpensesForMonthToDate,
  type AggregateMode
} from "@/domain/installment";
import { MonthDetailView } from "@/ui/views/MonthDetailView";
import { TodayDetailView } from "@/ui/views/TodayDetailView";
import { formatAmountInputWithCommas } from "@/domain/parseAmountInput";
import { cn } from "@/components/cn";
import AggregateModeToggle from "@/components/AggregateModeToggle";
import { transitSegmentToLeg, transit1LegsWithAmountFallback } from "@/domain/transitLegRestore";
import { pickSubwayLineForPool, subwayLinePool } from "@/domain/transitSubwayLines";
import { clamp01 } from "@/domain/expensePaymentUi";
import { expensesOccurringWithinSchedule } from "@/domain/scheduleExpenseLink";
import { parseMainDayQuery } from "@/domain/mainDayQuery";
import type { TimelineItem } from "@/domain/timelineTypes";
import CalendarView from "@/ui/views/CalendarView";
import MainHomeView from "@/ui/views/MainHomeView";
import { ComposeForm } from "@/ui/sheets/ComposeForm";
import ExpenseDetailSheet, {
  expenseDetailSubtitle,
  expenseDetailTitle
} from "@/ui/sheets/ExpenseDetailSheet";
import ScheduleDetailSheet from "@/ui/sheets/ScheduleDetailSheet";
import { loadCapitalMetroStations } from "@/features/transit/stations";

export default function RouteShell({ view }: { view: "main" | "today" | "month" | "calendar" }) {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const raw = window.localStorage.getItem(AUTH_USER_LS_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Redirect-based Google login fallback: API redirects back with `gsi_user`.
    try {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get("gsi_user");
      if (!raw) return;

      const json = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
      const u = JSON.parse(json) as AuthUser;
      if (u?.email) {
        try {
          window.localStorage.setItem(AUTH_USER_LS_KEY, JSON.stringify(u));
        } catch {
          void 0;
        }
        setAuthUser(u);
      }
      url.searchParams.delete("gsi_user");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadCapitalMetroStations();
  }, []);

  const { data: expensesData, error: expensesError } = useExpenses();
  const showCategoryPreview = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("previewCategories") === "1";
    } catch {
      return false;
    }
  }, []);
  const pacePreview = useMemo<null | "onTrack" | "under" | "over">(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("pace");
      if (raw === "on") return "onTrack";
      if (raw === "under") return "under";
      if (raw === "over") return "over";
      return null;
    } catch {
      return null;
    }
  }, []);

  const [confirmOpen, setConfirmOpen] = useState<null | { message: string; action: () => void | Promise<void> }>(
    null
  );
  const requestConfirm = (message: string, action: () => void | Promise<void>) =>
    setConfirmOpen({ message, action });

  type SettlementRecord = {
    paidAtLocal: string; // YYYY-MM-DDTHH:mm (local time, for input[type=datetime-local])
    method: string; // free text: ex) 카뱅, 토스, 신한, 현금
    note: string | null;
    createdAt: string; // ISO
    updatedAt: string; // ISO
  };
  const settlementRecordKey = (day: string, other: string) => `day:${day}::${other}`;
  const [settlementRecordByKey, setSettlementRecordByKey] = useLocalStorageState<
    Record<string, SettlementRecord>
  >("settlementRecordByKey", {});
  const getSettlementRecordForDay = (day: string, other: string) =>
    settlementRecordByKey[settlementRecordKey(day, other)] ?? null;

  const [settlementLogOpen, setSettlementLogOpen] = useState<
    | null
    | { day: string; other: string; revertOnClose: boolean; hadRecordAtOpen?: boolean }
  >(null);
  const [settlementLogPaidAtLocal, setSettlementLogPaidAtLocal] = useState("");
  const [settlementLogMethod, setSettlementLogMethod] = useState<string>("카뱅");
  const [settlementLogNote, setSettlementLogNote] = useState("");

  const [settlementSheetOpen, setSettlementSheetOpen] = useState(false);
  const todayExpenseDetailOpen = view === "today";
  const monthExpenseDetailOpen = view === "month";
  const calendarOpen = view === "calendar";
  const calendarInputRef = useRef<HTMLInputElement>(null!);
  const [legacyBudgetFallback] = useState(() => readLegacyMonthlyBudgetWonFromStorage());
  const [budgetByYm] = useLocalStorageState<Record<string, number>>(MONTHLY_BUDGET_BY_YM_LS_KEY, {}, {
    parse: parseMonthlyBudgetByYm,
    serialize: serializeMonthlyBudgetByYm
  });

  const [aggregateMode, setAggregateMode] = useLocalStorageState<AggregateMode>(
    AGGREGATE_MODE_LS_KEY,
    "usage",
    {
      parse: (raw) => {
        try {
          const v = JSON.parse(raw);
          return v === "cashflow" ? "cashflow" : "usage";
        } catch {
          return "usage";
        }
      }
    }
  );

  const [settledNetByPeriodKey, setSettledNetByPeriodKey] = useLocalStorageState<
    Record<string, string[]>
  >("settledNetByPeriodKey", {});
  const isNetSettled = (periodKey: string, other: string) =>
    (settledNetByPeriodKey[periodKey] ?? []).includes(other);
  const toggleNetSettled = (periodKey: string, other: string) =>
    setSettledNetByPeriodKey((prev) => {
      const list = new Set(prev[periodKey] ?? []);
      if (list.has(other)) list.delete(other);
      else list.add(other);
      const next = { ...prev, [periodKey]: Array.from(list) };
      return next;
    });

  const isNetSettledForDay = (day: string, other: string) => isNetSettled(`day:${day}`, other);
  const toggleNetSettledForDay = (day: string, other: string) =>
    toggleNetSettled(`day:${day}`, other);

  const normalizeLegacySettlementMethod = (m: unknown): string => {
    const v = typeof m === "string" ? m.trim() : "";
    if (!v) return "카뱅";
    // legacy enum compatibility
    if (v === "TRANSFER") return "계좌이체";
    if (v === "CASH") return "현금";
    if (v === "CARD") return "카드";
    if (v === "ETC") return "기타";
    return v;
  };

  const openSettlementLog = (day: string, other: string, revertOnClose: boolean) => {
    const existing = getSettlementRecordForDay(day, other);
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
      hadRecordAtOpen: Boolean(getSettlementRecordForDay(day, other))
    });
  };

  const deleteSettlementRecord = () => {
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
  };

  const requestToggleNetSettledForDay = (day: string, other: string) => {
    const settled = isNetSettledForDay(day, other);
    if (settled) {
      // 이미 완료면 기록 편집(일시·수단·메모). 미완료로 바꾸려면 다이얼로그에서 정산 해제.
      openSettlementLog(day, other, false);
      return;
    }
    // 미완료 → 기록 입력 다이얼로그 먼저 열고, 저장 시 정산 완료 처리
    openSettlementLog(day, other, true);
  };

  const isExpenseNetSettledForDay = (day: string, e: Expense, me: string) => {
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
  };

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
  const monthlyBudgetWon = useMemo(
    () => effectiveMonthlyBudgetWon(monthKey, budgetByYm, legacyBudgetFallback),
    [monthKey, budgetByYm, legacyBudgetFallback]
  );
  const dayLocal00 = useMemo(() => {
    const d = new Date(selectedDay);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDay]);

  const { data: scheduleData, error: scheduleError } = useSchedules(dayKey);
  const { data: monthSchedulesData } = useMonthSchedules(monthKey, { onlyCalendar: calendarOpen });
  const { data: todaySummary } = useExpenseSummary(dayKey);
  useMonthlyExpenseSummary(monthKey);

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const createSchedule = useCreateSchedule(dayKey);
  const updateSchedule = useUpdateSchedule(dayKey);
  const deleteSchedule = useDeleteSchedule(dayKey);

  const [composeOpen, setComposeOpen] = useState(false);

  /** 수정 모드일 때만 설정 (등록 폼과 동일 UI) */
  const [composeEditExpenseId, setComposeEditExpenseId] = useState<string | null>(null);
  const [composeEditScheduleId, setComposeEditScheduleId] = useState<string | null>(null);
  /** 수정 중 탭으로 종류 전환 시: 새로 생성 후 원본 삭제 */
  const [composeConvertFromExpenseId, setComposeConvertFromExpenseId] = useState<string | null>(null);
  const [composeConvertFromScheduleId, setComposeConvertFromScheduleId] = useState<string | null>(null);
  const [composeDayKey, setComposeDayKey] = useState<string>(() => dayKey);
  const composeDayLocal00 = useMemo(() => {
    const d = new Date(`${composeDayKey}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dayLocal00;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [composeDayKey, dayLocal00]);

  useEffect(() => {
    if (!composeOpen) setComposeDayKey(dayKey);
  }, [composeOpen, dayKey]);

  const [composeKind, setComposeKind] = useState<"expense" | "schedule">("expense");
  const [scheduleWithExpense, setScheduleWithExpense] = useState(false);
  const [schedulePayTimeText, setSchedulePayTimeText] = useState("");
  const [schedulePeopleText, setSchedulePeopleText] = useState("");
  const [scheduleShowOnCalendar, setScheduleShowOnCalendar] = useState(false);
  const [scheduleCancelled, setScheduleCancelled] = useState(false);
  const [scheduleExpenseTitle, setScheduleExpenseTitle] = useState("");

  const [expenseDetailOpen, setExpenseDetailOpen] = useState<Expense | null>(null);
  const [scheduleDetailOpen, setScheduleDetailOpen] = useState<ScheduleItem | null>(null);

  const {
    entryStartText,
    setEntryStartText,
    entryEndText,
    setEntryEndText,
    entryCategory,
    setEntryCategory,
    entryTitle,
    setEntryTitle,
    entryNote,
    setEntryNote,
    exMerchant,
    setExMerchant,
    exDetail,
    setExDetail,
    exAmount,
    setExAmount,
    exPaymentType,
    setExPaymentType,
    exPaymentLabel,
    setExPaymentLabel,
    payerPreset,
    setPayerPreset,
    payerOther,
    setPayerOther,
    expenseScope,
    setExpenseScope,
    sharedNamesText,
    setSharedNamesText,
    expenseCompanionsText,
    setExpenseCompanionsText,
    exInstallment,
    setExInstallment,
    exInstallmentMonths,
    setExInstallmentMonths,
    exInstallmentNoInterest,
    setExInstallmentNoInterest,
    plannedAtEnabled,
    setPlannedAtEnabled,
    plannedAtLocal,
    setPlannedAtLocal,
    reset: resetComposeForm
  } = useExpenseComposeForm();

  // 작성 시트 열 때 시작 시간이 비어있으면 현재 시간으로 자동 채움(교통1·2는 구간/상단 시간을 비워 두기)
  useEffect(() => {
    if (!composeOpen || entryStartText.trim()) return;
    const cat = entryCategory.trim();
    if (cat === "교통1" || cat === "교통2") return;
    const now = new Date();
    setEntryStartText(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
    // entryStartText 변경 시에는 다시 채우지 않음(사용자가 지웠다가 시트를 닫지 않은 상태 등)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeOpen]);

  // 교통2 (기차/버스/택시/비행기) - 단일 구간
  const [exTransitMode, setExTransitMode] = useState<string>("🚆"); // 교통2: 🚆🚍🚖✈️
  const [exTransitFromText, setExTransitFromText] = useState<string>("");
  const [exTransitToText, setExTransitToText] = useState<string>("");
  const [transit2SegmentsDraft, setTransit2SegmentsDraft] = useState<Transit2SegmentDraft[]>(() => [
    { dayKey, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }
  ]);

  // 교통1 (대중교통) - 다구간(환승) 지원
  const [transitLegs, setTransitLegs] = useState<TransitLeg[]>(() => [emptyTransit1Leg()]);

  const handleComposeClose = useCallback(() => {
    setComposeOpen(false);
    setComposeEditExpenseId(null);
    setComposeEditScheduleId(null);
    setComposeConvertFromExpenseId(null);
    setComposeConvertFromScheduleId(null);
    setComposeKind("expense");
    setScheduleWithExpense(false);
    setSchedulePayTimeText("");
    setSchedulePeopleText("");
    setScheduleShowOnCalendar(false);
    setScheduleCancelled(false);
    setExTransitMode("🚆");
    setExTransitFromText("");
    setExTransitToText("");
    setTransit2SegmentsDraft([{ dayKey, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }]);
    setTransitLegs([emptyTransit1Leg()]);
    resetComposeForm();
  }, [resetComposeForm, dayKey]);

  const [stationSearchOpen, setStationSearchOpen] = useState<StationSearchTarget | null>(null);
  const [stationQuery, setStationQuery] = useState("");
  const [busStopSearchOpen, setBusStopSearchOpen] = useState<StationSearchTarget | null>(null);

  useEffect(() => {
    if (!composeOpen) {
      setStationSearchOpen(null);
      setBusStopSearchOpen(null);
    }
  }, [composeOpen]);

  const isTransitCategory = useMemo(() => {
    const c = entryCategory.trim();
    return c === "교통1" || c === "교통2";
  }, [entryCategory]);

  const isTransit1 = entryCategory.trim() === "교통1";
  const isTransit2 = entryCategory.trim() === "교통2";

  // 교통1: 일정/지출의 시작·끝 시각은 구간(첫 출발~마지막 도착)과 동일 — 상단 시간 입력은 숨기고 여기서 맞춤
  useEffect(() => {
    if (!isTransit1 || transitLegs.length === 0) return;
    const first = transitLegs[0] as { start?: string };
    const last = transitLegs[transitLegs.length - 1] as { end?: string };
    setEntryStartText(String(first?.start ?? "").trim());
    setEntryEndText(String(last?.end ?? "").trim());
  }, [isTransit1, transitLegs, setEntryStartText, setEntryEndText]);

  const todayExpenses = useMemo(() => {
    const items = expensesData?.items ?? [];
    return items
      .filter((e) => yyyyMmDdLocal(new Date(e.occurredAt)) === dayKey)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  }, [expensesData, dayKey]);

  const resolveOriginalExpense = useCallback(
    (e: Expense) => {
      const id = String(e.id || "");
      const marker = "::cashflow::";
      if (!id.includes(marker)) return e;
      const originalId = id.split(marker)[0] ?? id;
      const all = expensesData?.items ?? [];
      return all.find((x) => x.id === originalId) ?? e;
    },
    [expensesData?.items]
  );

  const todayExpensesDisplay = useMemo(() => {
    if (aggregateMode !== "cashflow") return todayExpenses;
    const all = expensesData?.items ?? [];
    const targetMonthKey = yyyyMmLocal(new Date(`${dayKey}T00:00:00`));
    const targetYear = Number(targetMonthKey.slice(0, 4));
    const targetMonthIdx = Number(targetMonthKey.slice(5, 7)) - 1;
    const dayNum = Number(dayKey.slice(8, 10));

    const out: Expense[] = [];
    for (const e of all) {
      const occurredAt = new Date(e.occurredAt);
      const isInstallment =
        e.paymentType === "CARD" && !!e.installment && !!e.installmentMonths && e.installmentMonths >= 2;

      if (!isInstallment) {
        if (yyyyMmDdLocal(occurredAt) === dayKey) out.push(e);
        continue;
      }

      // For installment: show monthly split on the same day-of-month (clamped) for each month in the split period.
      const allocs = expenseCashflowAllocations(e);
      const hit = allocs.find((a) => a.monthKey === targetMonthKey);
      if (!hit || hit.amount <= 0) continue;

      // Only show on the "same day-of-month" as the original payment day (clamped to last day of month).
      const originalDay = occurredAt.getDate();
      const targetLastDay = new Date(targetYear, targetMonthIdx + 1, 0).getDate();
      const anchorDay = Math.max(1, Math.min(targetLastDay, originalDay));
      if (dayNum !== anchorDay) continue;

      // Build virtual expense for display
      const virtDate = new Date(targetYear, targetMonthIdx, anchorDay, occurredAt.getHours(), occurredAt.getMinutes());
      const virt: Expense = {
        ...e,
        id: `${e.id}::cashflow::${targetMonthKey}`,
        amount: hit.amount,
        occurredAt: virtDate.toISOString(),
        // keep endAt null for a simpler card
        endAt: null
      };
      out.push(virt);
    }
    return out.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  }, [aggregateMode, dayKey, expensesData?.items, todayExpenses]);

  async function fillComposeFromExpense(e: Expense) {
    await loadCapitalMetroStations();
    const base = resolveOriginalExpense(e);
    setComposeEditScheduleId(null);
    setComposeEditExpenseId(base.id);
    setComposeDayKey(yyyyMmDdLocal(new Date(base.occurredAt)));
    setComposeKind("expense");
    setScheduleWithExpense(false);
    setSchedulePayTimeText("");
    setSchedulePeopleText("");
    setScheduleShowOnCalendar(false);
    const od = new Date(base.occurredAt);
    setEntryStartText(`${pad2(od.getHours())}:${pad2(od.getMinutes())}`);
    if (base.endAt) {
      const ed = new Date(base.endAt);
      setEntryEndText(`${pad2(ed.getHours())}:${pad2(ed.getMinutes())}`);
    } else {
      setEntryEndText("");
    }
    setEntryCategory(base.category);
    setEntryTitle((base.memo ?? "").trim());
    setExDetail((base.detail ?? "").trim());
    setExMerchant(base.merchant ?? "");
    setEntryNote("");
    setExAmount(formatAmountInputWithCommas(String(base.amount)));
    setExPaymentType(base.paymentType);
    setExPaymentLabel(base.paymentMethodLabel ?? "");
    setExInstallment(base.paymentType === "CARD" && !!base.installment);
    setExInstallmentMonths(
      base.paymentType === "CARD" &&
        base.installment &&
        base.installmentMonths != null &&
        base.installmentMonths >= 2 &&
        base.installmentMonths <= 36
        ? base.installmentMonths
        : 2
    );
    setExInstallmentNoInterest(
      base.paymentType === "CARD" && !!base.installment && !!base.installmentNoInterest
    );
    const owner = base.paymentOwner ?? "나";
    setPayerPreset(owner === "나" ? "나" : "기타");
    setPayerOther(owner === "나" ? "" : owner);
    setExpenseScope(base.scope ?? "PERSONAL");
    if (base.scope === "SHARED") {
      setSharedNamesText(
        Array.isArray(base.participants) ? (base.participants as unknown[]).map(String).join(", ") : ""
      );
      setExpenseCompanionsText("");
    } else {
      setSharedNamesText("");
      setExpenseCompanionsText(
        Array.isArray(base.participants) && base.participants.length
          ? (base.participants as unknown[]).map(String).join(", ")
          : ""
      );
    }

    // plannedAt 복원: occurredAt과 다를 때만 토글 ON, datetime-local 입력값 채움
    if (base.plannedAt) {
      const planned = new Date(base.plannedAt);
      const occurred = new Date(base.occurredAt);
      const sameMoment = planned.getTime() === occurred.getTime();
      if (!sameMoment && !Number.isNaN(planned.getTime())) {
        setPlannedAtEnabled(true);
        const yyyy = planned.getFullYear();
        const mm = pad2(planned.getMonth() + 1);
        const dd = pad2(planned.getDate());
        const hh = pad2(planned.getHours());
        const mi = pad2(planned.getMinutes());
        setPlannedAtLocal(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
      } else {
        setPlannedAtEnabled(false);
        setPlannedAtLocal("");
      }
    } else {
      setPlannedAtEnabled(false);
      setPlannedAtLocal("");
    }

    if (normalizeCategory(base.category) === "교통1") {
      const seg = base.transitSegments;
      if (Array.isArray(seg) && seg.length) {
        setTransitLegs(() => {
          const mapped = seg.map(transitSegmentToLeg).filter((x): x is TransitLeg => x != null);
          const legs: TransitLeg[] = mapped.length ? mapped : [emptyTransit1Leg()];
          return transit1LegsWithAmountFallback(legs, base.amount);
        });
      } else {
        setTransitLegs([
          {
            ...emptyTransit1Leg(),
            amount: base.amount > 0 ? formatAmountInputWithCommas(String(base.amount)) : ""
          }
        ]);
      }
    } else {
      setTransitLegs([emptyTransit1Leg()]);
    }
    if (normalizeCategory(base.category) === "교통2") {
      const seg = base.transitSegments;
      const occurredDayKey = yyyyMmDdLocal(new Date(base.occurredAt));
      if (Array.isArray(seg) && seg.length && typeof seg[0] === "object") {
        const mapped = seg
          .map((s: any) => {
            const dayKeySeg = typeof s?.dayKey === "string" ? s.dayKey : occurredDayKey;
            const start = typeof s?.start === "string" ? s.start : "";
            const end = typeof s?.end === "string" ? s.end : "";
            const fromText = typeof s?.from === "string" ? s.from : (base.transitFrom ?? "");
            const toText = typeof s?.to === "string" ? s.to : (base.transitTo ?? "");
            const mode = typeof s?.mode === "string" ? s.mode : (base.transitMode ?? "🚆");
            const memoText = typeof s?.memo === "string" ? s.memo : "";
            return { dayKey: dayKeySeg, start, end, fromText, toText, mode, memoText };
          })
          .filter(Boolean) as Transit2SegmentDraft[];

        setTransit2SegmentsDraft(
          mapped.length
            ? mapped
            : [{ dayKey: occurredDayKey, start: "", end: "", fromText: e.transitFrom ?? "", toText: e.transitTo ?? "", mode: e.transitMode ?? "🚆", memoText: "" }]
        );

        const first = mapped[0];
        setExTransitMode(first?.mode ?? base.transitMode ?? "🚆");
        setExTransitFromText(first?.fromText ?? base.transitFrom ?? "");
        setExTransitToText(first?.toText ?? base.transitTo ?? "");
      } else {
        const mode = (base.transitMode ?? "").trim() || "🚆";
        const from = (base.transitFrom ?? "").trim();
        const to = (e.transitTo ?? "").trim();
        setExTransitMode(mode);
        setExTransitFromText(from);
        setExTransitToText(to);
        setTransit2SegmentsDraft([{ dayKey: occurredDayKey, start: "", end: "", fromText: from, toText: to, mode, memoText: "" }]);
      }
    } else {
      setExTransitMode("🚆");
      setExTransitFromText("");
      setExTransitToText("");
      setTransit2SegmentsDraft([{ dayKey: yyyyMmDdLocal(new Date(e.occurredAt)), start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }]);
    }
  }

  async function fillComposeFromSchedule(full: ScheduleItem, linked: Expense[]) {
    await loadCapitalMetroStations();
    setComposeEditExpenseId(null);
    setComposeEditScheduleId(full.id);
    setComposeDayKey(yyyyMmDdLocal(new Date(full.startAt)));
    setComposeKind("schedule");
    setScheduleWithExpense(false);
    setSchedulePayTimeText("");
    setScheduleShowOnCalendar(Boolean(full.showOnCalendar));

    const s = new Date(full.startAt);
    const startHhMm = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
    const endHhMm = full.endAt
      ? `${pad2(new Date(full.endAt).getHours())}:${pad2(new Date(full.endAt).getMinutes())}`
      : "";
    const parsed = parseEmojiPrefixedTitle(full.title);
    if (parsed.category === "교통1" || parsed.category === "교통2") {
      setEntryStartText("");
      setEntryEndText("");
    } else {
      setEntryStartText(startHhMm);
      setEntryEndText(endHhMm);
    }
    setEntryCategory(parsed.category);
    setEntryTitle(parsed.content);
    const np = parseScheduleNote(full.note);
    setSchedulePeopleText(np.people.join(", "));
    setScheduleCancelled(Boolean(np.cancelled));
    const stripTransit2Line = (raw: string) =>
      raw
        .split("\n")
        .map((s) => s.trim())
        .filter(
          (s) =>
            !(
              s.includes("→") &&
              (s.startsWith("🚆") || s.startsWith("🚍") || s.startsWith("🚖") || s.startsWith("✈"))
            )
        )
        .join("\n")
        .trim();
    setEntryNote(stripTransit2Line(np.memo ?? ""));
    setScheduleExpenseTitle(parsed.content);

    setExAmount("");
    setExMerchant("");
    setExDetail(np.detail ?? "");
    setExPaymentType("CARD");
    setExPaymentLabel("");
    setPayerPreset("나");
    setPayerOther("");
    setExpenseScope("PERSONAL");
    setSharedNamesText("");
    setExpenseCompanionsText("");
    setExInstallment(false);
    setExInstallmentMonths(2);
    setExInstallmentNoInterest(false);

    const trExTransit1 = linked.find((x) => normalizeCategory(x.category) === "교통1");
    if (parsed.category === "교통1") {
      const seg = trExTransit1?.transitSegments;
      if (Array.isArray(seg) && seg.length) {
        setTransitLegs(() => {
          const mapped = seg.map(transitSegmentToLeg).filter((x): x is TransitLeg => x != null);
          const legs: TransitLeg[] = mapped.length ? mapped : [emptyTransit1Leg()];
          const totalWon = typeof trExTransit1?.amount === "number" ? trExTransit1.amount : 0;
          return transit1LegsWithAmountFallback(legs, totalWon);
        });
      } else {
        const amt = typeof trExTransit1?.amount === "number" ? trExTransit1.amount : 0;
        setTransitLegs([
          {
            ...emptyTransit1Leg(),
            amount: amt > 0 ? formatAmountInputWithCommas(String(amt)) : ""
          }
        ]);
      }
      if (trExTransit1 && typeof trExTransit1.amount === "number") {
        setExAmount(formatAmountInputWithCommas(String(trExTransit1.amount)));
      }
    } else {
      setTransitLegs([emptyTransit1Leg()]);
    }
    const scheduleDayKey = yyyyMmDdLocal(new Date(full.startAt));
    if (parsed.category === "교통2") {
      const tr2 = linked.find((x) => normalizeCategory(x.category) === "교통2");
      if (tr2) {
        setExTransitMode(tr2.transitMode ?? "🚆");
        setExTransitFromText(tr2.transitFrom ?? "");
        setExTransitToText(tr2.transitTo ?? "");
        const seg = tr2.transitSegments;
        if (Array.isArray(seg) && seg.length && typeof seg[0] === "object") {
          const mapped = seg
            .map((s: any) => {
              const dayKeySeg = typeof s?.dayKey === "string" ? s.dayKey : scheduleDayKey;
              const start = typeof s?.start === "string" ? s.start : "";
              const end = typeof s?.end === "string" ? s.end : "";
              const fromText = typeof s?.from === "string" ? s.from : (tr2.transitFrom ?? "");
              const toText = typeof s?.to === "string" ? s.to : (tr2.transitTo ?? "");
              const mode = typeof s?.mode === "string" ? s.mode : (tr2.transitMode ?? "🚆");
              const memoText = typeof s?.memo === "string" ? s.memo : "";
              return { dayKey: dayKeySeg, start, end, fromText, toText, mode, memoText };
            })
            .filter(Boolean) as Transit2SegmentDraft[];
          setTransit2SegmentsDraft(
            mapped.length
              ? mapped
              : [
                  {
                    dayKey: scheduleDayKey,
                    start: "",
                    end: "",
                    fromText: tr2.transitFrom ?? "",
                    toText: tr2.transitTo ?? "",
                    mode: tr2.transitMode ?? "🚆",
                    memoText: ""
                  }
                ]
          );
        } else {
          setTransit2SegmentsDraft([
            {
              dayKey: scheduleDayKey,
              start: "",
              end: "",
              fromText: tr2.transitFrom ?? "",
              toText: tr2.transitTo ?? "",
              mode: (tr2.transitMode ?? "").trim() || "🚆",
              memoText: ""
            }
          ]);
        }
      } else {
        const memo = np.memo ?? "";
        const transitLine = memo
          .split("\n")
          .map((s) => s.trim())
          .find((s) => s.includes("→") && (s.startsWith("🚆") || s.startsWith("🚍") || s.startsWith("🚖") || s.startsWith("✈")));
        if (transitLine) {
          const token = transitLine.trimStart().split(/\s+/)[0] ?? "";
          const rest = transitLine.trimStart().slice(token.length).trim();
          const [fromRaw, toRaw] = rest.split("→").map((s) => s.trim());
          setExTransitMode(token || "🚆");
          setExTransitFromText(fromRaw ?? "");
          setExTransitToText(toRaw ?? "");
          setTransit2SegmentsDraft([
            {
              dayKey: scheduleDayKey,
              start: "",
              end: "",
              fromText: fromRaw ?? "",
              toText: toRaw ?? "",
              mode: (token || "🚆").trim() || "🚆",
              memoText: ""
            }
          ]);
        } else {
          setExTransitMode("🚆");
          setExTransitFromText("");
          setExTransitToText("");
          setTransit2SegmentsDraft([
            { dayKey: scheduleDayKey, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }
          ]);
        }
      }
    } else {
      setExTransitMode("🚆");
      setExTransitFromText("");
      setExTransitToText("");
      setTransit2SegmentsDraft([
        { dayKey: scheduleDayKey, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }
      ]);
    }
  }

  const monthToDateTotal = useMemo(() => {
    const items = expensesData?.items ?? [];
    return sumExpensesForMonthToDate(aggregateMode, items, monthKey, dayKey);
  }, [aggregateMode, dayKey, expensesData, monthKey]);

  const myMonthToDateTotal = useMemo(() => {
    const items = expensesData?.items ?? [];
    return sumExpensesForMonthToDate(aggregateMode, items, monthKey, dayKey, {
      onlyMine: true,
      me: "나"
    });
  }, [aggregateMode, dayKey, expensesData, monthKey]);

  const myTodayTotal = useMemo(() => {
    const me = "나";
    return todayExpenses.reduce((sum, e) => sum + myShareAmountForMe(e, me), 0);
  }, [todayExpenses]);

  const settlementToday = useMemo(() => {
    const me = "나";
    let iPay = 0;
    let iReceive = 0;
    const perPerson = new Map<string, number>();
    for (const e of todayExpenses) {
      const d = settlementDeltaForMe(e, me);
      iPay += d.iPay;
      iReceive += d.iReceive;
      for (const [name, amt] of d.perPerson.entries()) {
        perPerson.set(name, (perPerson.get(name) ?? 0) + amt);
      }
    }
    return { me, iPay, iReceive, perPerson };
  }, [todayExpenses]);

  const settlementAllByDay = useMemo(() => {
    const all = expensesData?.items ?? [];
    const me = "나";
    const byDay = new Map<string, Map<string, number>>();
    for (const e of all) {
      const day = yyyyMmDdLocal(new Date(e.occurredAt));
      const d = settlementDeltaForMe(e, me);
      if (!d.perPerson.size) continue;
      const per = byDay.get(day) ?? new Map<string, number>();
      for (const [name, amt] of d.perPerson.entries()) {
        per.set(name, (per.get(name) ?? 0) + amt);
      }
      if (per.size) byDay.set(day, per);
    }
    // keep only days with at least one non-zero entry
    for (const [day, per] of Array.from(byDay.entries())) {
      const cleaned = new Map(Array.from(per.entries()).filter(([, amt]) => Math.abs(amt) > 0.0001));
      if (cleaned.size) byDay.set(day, cleaned);
      else byDay.delete(day);
    }
    return byDay;
  }, [expensesData?.items]);

  const budgetUi = useMemo(() => {
    const monthTotal = myMonthToDateTotal;
    const todayTotal = myTodayTotal;
    const d = daysInMonth(selectedDay);
    const dayOfMonth = selectedDay.getDate(); // 1..d
    // Fixed daily budget = monthly budget / days in month
    const dailyBudget = monthlyBudgetWon / d;
    const monthPct = clamp01(monthTotal / monthlyBudgetWon);
    const todayPct = clamp01(todayTotal / dailyBudget);
    const expectedToDate = (monthlyBudgetWon * dayOfMonth) / d;
    const expectedPct = clamp01(dayOfMonth / d);
    const expectedPctText = Math.round(expectedPct * 100);
    const monthPctText = Math.round(monthPct * 100);
    const delta = monthTotal - expectedToDate; // + means overspent vs pace
    const paceBand = Math.max(50_000, monthlyBudgetWon * 0.02); // 2% or 5만원
    const computedPaceStatus: "under" | "onTrack" | "over" =
      Math.abs(delta) <= paceBand ? "onTrack" : delta < 0 ? "under" : "over";
    const paceStatus: "under" | "onTrack" | "over" = pacePreview ?? computedPaceStatus;
    const paceUi =
      paceStatus === "onTrack"
        ? {
            emoji: "✨",
            message: "예산 페이스가 딱 맞아요. 지금처럼만 가면 돼요!",
            bubble: "border-sky-200 bg-sky-50 text-sky-900"
          }
        : paceStatus === "under"
          ? {
              emoji: "😌",
              message: "편안한 마음으로 지출을 이어가도 좋겠어요!",
              bubble: "border-emerald-200 bg-emerald-50 text-emerald-900"
            }
          : {
              emoji: "🔥",
              message: "예산 페이스 초과!!!!! 망함ㅠㅠ",
              bubble: "border-rose-200 bg-rose-50 text-rose-900"
            };

    const message = paceUi.message;
    return {
      monthTotal,
      todayTotal,
      monthTotalOverall: monthToDateTotal,
      todayTotalOverall: todaySummary?.total ?? 0,
      dailyBudget,
      monthPct,
      todayPct,
      message,
      days: d,
      dayOfMonth,
      expectedToDate,
      expectedPctText,
      monthPctText,
      paceUi,
      budgetWon: monthlyBudgetWon
    };
  }, [
    monthToDateTotal,
    myMonthToDateTotal,
    myTodayTotal,
    selectedDay,
    todaySummary?.total,
    monthlyBudgetWon,
    pacePreview
  ]);

  const timeline = useMemo(() => {
    const expenses = todayExpensesDisplay;
    const expenseItems: TimelineItem[] = expenses.map((e) => ({
      kind: "expense",
      startMs: new Date(e.occurredAt).getTime(),
      expense: e
    }));

    // 결제일(occurredAt)과 다른 "이용일" 표시용(합계 미포함): 교통2 Method C의 transitSegments dayKey를 사용
    const usageExpenseItems: TimelineItem[] = (() => {
      const all = expensesData?.items ?? [];
      const out: TimelineItem[] = [];
      for (const e of all) {
        if (normalizeCategory(e.category) !== "교통2") continue;
        if (!Array.isArray(e.transitSegments) || !e.transitSegments.length) continue;
        const occurredDay = yyyyMmDdLocal(new Date(e.occurredAt));
        for (const s of e.transitSegments as any[]) {
          const dk = typeof s?.dayKey === "string" ? s.dayKey : null;
          if (dk !== dayKey) continue;
          if (occurredDay === dayKey) continue; // same-day면 중복표시 X
          const startText = typeof s?.start === "string" ? String(s.start).trim() : "";
          const endText = typeof s?.end === "string" ? String(s.end).trim() : "";
          const usageMemo = typeof s?.memo === "string" ? String(s.memo).trim() : "";
          const m = startText ? parseFlexibleTimeToMinutes(startText) : null;
          const startMs = m != null ? dateFromSlotMinutes(dayLocal00, m).getTime() : dayLocal00.getTime();
          const from = typeof s?.from === "string" ? String(s.from).trim() : "";
          const to = typeof s?.to === "string" ? String(s.to).trim() : "";
          const label = from || to ? `${from || "?"} → ${to || "?"}` : "이동";
          out.push({ kind: "usage-expense", startMs, expense: e, label, startText, endText, usageMemo });
        }
      }
      return out;
    })();

    const schedules = scheduleData?.items ?? [];
    const scheduleItems: TimelineItem[] = schedules.map((s) => ({
      kind: "schedule",
      startMs: new Date(s.startAt).getTime(),
      id: s.id,
      startAt: s.startAt,
      endAt: s.endAt,
      title: s.title,
      note: s.note,
      linkedExpenseSum: 0
    }));
    return [...scheduleItems, ...expenseItems, ...usageExpenseItems].sort((a, b) => a.startMs - b.startMs);
  }, [todayExpensesDisplay, scheduleData?.items, expensesData?.items, dayKey, dayLocal00]);

  const {
    submitEditSchedule,
    submitEditExpense,
    submitNewSchedule,
    submitNewExpense
  } = useComposeSubmit({
    createExpense: createExpense.mutateAsync,
    updateExpense: updateExpense.mutateAsync,
    createSchedule: createSchedule.mutateAsync,
    updateSchedule: updateSchedule.mutateAsync,
    deleteExpense: deleteExpense.mutateAsync,
    deleteSchedule: deleteSchedule.mutateAsync,
    entryStartText,
    entryEndText,
    entryCategory,
    entryNote,
    exMerchant,
    exDetail,
    exAmount,
    exPaymentType,
    exPaymentLabel,
    exTransitMode,
    exTransitFromText,
    exTransitToText,
    transitLegs,
    payerPreset,
    payerOther,
    expenseScope,
    sharedNamesText,
    expenseCompanionsText,
    exInstallment,
    exInstallmentMonths,
    exInstallmentNoInterest,
    plannedAtEnabled,
    plannedAtLocal,
    schedulePeopleText,
    schedulePayTimeText,
    scheduleExpenseTitle,
    scheduleWithExpense,
    scheduleShowOnCalendar,
    scheduleCancelled,
    transit2SegmentsDraft,
    composeDayLocal00,
    composeEditExpenseId,
    composeEditScheduleId,
    handleComposeClose,
    setComposeConvertFromExpenseId,
    setComposeConvertFromScheduleId
  });

  if (!authUser) {
    return (
      <LoginScreen
        onLogin={(u) => {
          try {
            window.localStorage.setItem(AUTH_USER_LS_KEY, JSON.stringify(u));
          } catch {
            void 0;
          }
          setAuthUser(u);
        }}
      />
    );
  }

  const headerEl = (
    <Header
      dayKey={dayKey}
      monthKey={monthKey}
      monthMode={monthExpenseDetailOpen || calendarOpen}
      calendarInputRef={calendarInputRef}
      onPick={(d) => setSelectedDay(d)}
      onPrev={() => {
        const d = new Date(selectedDay);
        if (monthExpenseDetailOpen || calendarOpen) {
          d.setDate(1);
          d.setMonth(d.getMonth() - 1);
        } else {
          d.setDate(d.getDate() - 1);
        }
        setSelectedDay(d);
      }}
      onNext={() => {
        const d = new Date(selectedDay);
        if (monthExpenseDetailOpen || calendarOpen) {
          d.setDate(1);
          d.setMonth(d.getMonth() + 1);
        } else {
          d.setDate(d.getDate() + 1);
        }
        setSelectedDay(d);
      }}
      rightSlot={<AggregateModeToggle mode={aggregateMode} onChange={setAggregateMode} size="xs" />}
    />
  );

  const settlementRecordDialogEl = (
    <SettlementRecordDialog
      open={settlementLogOpen}
      paidAtLocal={settlementLogPaidAtLocal}
      method={settlementLogMethod}
      note={settlementLogNote}
      onPaidAtLocalChange={setSettlementLogPaidAtLocal}
      onMethodChange={setSettlementLogMethod}
      onNoteChange={setSettlementLogNote}
      onCancel={() => {
        if (
          settlementLogOpen?.revertOnClose &&
          isNetSettledForDay(settlementLogOpen.day, settlementLogOpen.other)
        ) {
          toggleNetSettledForDay(settlementLogOpen.day, settlementLogOpen.other);
        }
        setSettlementLogOpen(null);
      }}
      onUnset={
        settlementLogOpen && !settlementLogOpen.revertOnClose
          ? () => {
              toggleNetSettledForDay(settlementLogOpen.day, settlementLogOpen.other);
              setSettlementLogOpen(null);
            }
          : undefined
      }
      onDeleteRecord={deleteSettlementRecord}
      onSave={() => {
        if (!settlementLogOpen) return;
        const day = settlementLogOpen.day;
        const other = settlementLogOpen.other;
        const key = settlementRecordKey(day, other);
        const nowIso = new Date().toISOString();
        setSettlementRecordByKey((prev) => {
          const next: Record<string, SettlementRecord> = {
            ...prev,
            [key]: {
              paidAtLocal: settlementLogPaidAtLocal,
              method: settlementLogMethod.trim() || "카뱅",
              note: settlementLogNote.trim() ? settlementLogNote.trim() : null,
              createdAt: prev[key]?.createdAt ?? nowIso,
              updatedAt: nowIso
            }
          };
          return next;
        });
        if (settlementLogOpen.revertOnClose && !isNetSettledForDay(day, other)) {
          toggleNetSettledForDay(day, other);
        }
        setSettlementLogOpen(null);
      }}
    />
  );

  if (calendarOpen) {
    const expensesAll = expensesData?.items ?? [];
    const monthSchedules = (monthSchedulesData?.items ?? []).filter(
      (s) => yyyyMmLocal(new Date(s.startAt)) === monthKey
    );
    return (
      <CalendarView
        headerEl={headerEl}
        navigate={navigate}
        monthKey={monthKey}
        aggregateMode={aggregateMode}
        expensesAll={expensesAll}
        monthSchedules={monthSchedules}
      />
    );
  }

  if (monthExpenseDetailOpen) {
    const usageTransit2ByDayForMonth = (() => {
      const all = expensesData?.items ?? [];
      const byDay = new Map<string, number>();
      for (const e of all) {
        if (normalizeCategory(e.category) !== "교통2") continue;
        if (!Array.isArray(e.transitSegments) || !e.transitSegments.length) continue;
        const occurredDay = yyyyMmDdLocal(new Date(e.occurredAt));
        for (const s of e.transitSegments as any[]) {
          const dk = typeof s?.dayKey === "string" ? s.dayKey : null;
          if (!dk || !/^\d{4}-\d{2}-\d{2}$/.test(dk)) continue;
          if (yyyyMmLocal(new Date(`${dk}T00:00:00`)) !== monthKey) continue;
          if (occurredDay === dk) continue;
          byDay.set(dk, (byDay.get(dk) ?? 0) + 1);
        }
      }
      return byDay;
    })();
    return (
      <>
        <MonthDetailView
          header={headerEl}
          settlementDialog={settlementRecordDialogEl}
          expenses={expensesData?.items}
          schedules={monthSchedulesData?.items ?? []}
          usageTransit2ByDay={usageTransit2ByDayForMonth}
          monthKey={monthKey}
          monthlyBudgetWon={monthlyBudgetWon}
          me="나"
          isNetSettledForDay={isNetSettledForDay}
          requestToggleNetSettledForDay={requestToggleNetSettledForDay}
          settlementAllByDay={settlementAllByDay}
          aggregateMode={aggregateMode}
        />
        <BottomNav />
      </>
    );
  }

  if (todayExpenseDetailOpen) {
    const usageTransit2ForDay = (() => {
      const all = expensesData?.items ?? [];
      const out: Array<{ label: string; startText: string; endText: string; memo: string }> = [];
      for (const e of all) {
        if (normalizeCategory(e.category) !== "교통2") continue;
        if (!Array.isArray(e.transitSegments) || !e.transitSegments.length) continue;
        const occurredDay = yyyyMmDdLocal(new Date(e.occurredAt));
        for (const s of e.transitSegments as any[]) {
          const dk = typeof s?.dayKey === "string" ? s.dayKey : null;
          if (dk !== dayKey) continue;
          if (occurredDay === dayKey) continue;
          const from = typeof s?.from === "string" ? String(s.from).trim() : "";
          const to = typeof s?.to === "string" ? String(s.to).trim() : "";
          const label = from || to ? `${from || "?"} → ${to || "?"}`.trim() : "이동";
          const startText = typeof s?.start === "string" ? String(s.start).trim() : "";
          const endText = typeof s?.end === "string" ? String(s.end).trim() : "";
          const memo = typeof s?.memo === "string" ? String(s.memo).trim() : "";
          out.push({ label, startText, endText, memo });
        }
      }
      return out;
    })();
    return (
      <>
        <TodayDetailView
          header={headerEl}
          settlementDialog={settlementRecordDialogEl}
          todayExpenses={todayExpensesDisplay}
          schedules={scheduleData?.items ?? []}
          usageTransit2={usageTransit2ForDay}
          budgetUi={budgetUi}
          settlementToday={settlementToday}
          dayKey={dayKey}
          isNetSettledForDay={isNetSettledForDay}
          requestToggleNetSettledForDay={requestToggleNetSettledForDay}
          settlementAllByDay={settlementAllByDay}
        />
        <BottomNav />
      </>
    );
  }

  return (
    <div className="min-h-dvh">
      {headerEl}

      <MainHomeView
        showCategoryPreview={showCategoryPreview}
        expensesError={expensesError}
        scheduleError={scheduleError}
        budgetUi={budgetUi}
        monthlyBudgetWon={monthlyBudgetWon}
        timeline={timeline}
        aggregateMode={aggregateMode}
        dayKey={dayKey}
        dayLocal00={dayLocal00}
        onOpenScheduleId={(id) => {
          const full = (scheduleData?.items ?? []).find((x) => x.id === id);
          if (full) setScheduleDetailOpen(full);
        }}
        onOpenExpense={(e) => setExpenseDetailOpen(resolveOriginalExpense(e))}
        resolveOriginalExpense={resolveOriginalExpense}
        isExpenseNetSettledForDay={isExpenseNetSettledForDay}
      />

      {/* FAB — 하단 네비 위로 */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40">
        <div className="mx-auto flex w-full max-w-md justify-end px-6">
          <button
            className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-500 active:scale-[0.99]"
            onClick={() => {
              setComposeEditExpenseId(null);
              setComposeEditScheduleId(null);
              setComposeDayKey(dayKey);
              setComposeKind("expense");
              setScheduleWithExpense(false);
              setSchedulePayTimeText("");
              setSchedulePeopleText("");
              resetComposeForm();
              setTransitLegs([emptyTransit1Leg()]);
              setTransit2SegmentsDraft([
                { dayKey, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }
              ]);
              setExTransitMode("🚆");
              setExTransitFromText("");
              setExTransitToText("");
              setComposeOpen(true);
            }}
            aria-label="기록하기"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
              <path
                d="M12 20h9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4 11.5-11.5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <BottomNav />

      {/* Unified compose sheet */}
      <ComposeSheet
        open={composeOpen}
        title={
          composeEditExpenseId ||
          composeEditScheduleId ||
          composeConvertFromExpenseId ||
          composeConvertFromScheduleId
            ? "기록 수정"
            : "기록 작성"
        }
        subtitle={composeDayKey}
        onClose={handleComposeClose}
        footer={
          <button
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={
              createSchedule.isPending ||
              createExpense.isPending ||
              updateExpense.isPending ||
              updateSchedule.isPending
            }
            onClick={async () => {
              const convertFromExpenseId = composeConvertFromExpenseId;
              const convertFromScheduleId = composeConvertFromScheduleId;
              const category = entryCategory.trim();
              if (!category) {
                window.alert("카테고리를 선택해줘.");
                return;
              }
              const derivedTransitTitle = (() => {
                const catNorm = normalizeCategory(category);
                if (catNorm === "교통2") {
                  const from = (transit2SegmentsDraft[0]?.fromText ?? exTransitFromText).trim();
                  const to = (transit2SegmentsDraft[0]?.toText ?? exTransitToText).trim();
                  if (from || to) return `${from || "?"} → ${to || "?"}`.trim();
                  return "이동";
                }
                if (catNorm === "교통1") {
                  const first = transitLegs[0];
                  const last = transitLegs[transitLegs.length - 1];
                  const from =
                    first?.mode === "BUS" ? (first.from || "") : (first?.from?.name ?? "");
                  const to = last?.mode === "BUS" ? (last.to || "") : (last?.to?.name ?? "");
                  if (from || to) return `${from || "?"} → ${to || "?"}`.trim();
                  return "이동";
                }
                return "";
              })();
              const title = entryTitle.trim() || derivedTransitTitle;
              if (!title.trim()) {
                window.alert("내용을 입력해줘.");
                return;
              }
              if (composeKind === "schedule" && !entryNote.trim()) {
                window.alert("내용을 입력해줘.");
                return;
              }

              const catNormForTime = normalizeCategory(category);
              const startMin =
                !entryStartText.trim() && catNormForTime === "교통2"
                  ? 0
                  : parseFlexibleTimeToMinutes(entryStartText);
              if (startMin == null) {
                window.alert("시작 시간을 확인해줘.");
                return;
              }

              const args = {
                category,
                title,
                startMin,
                convertFromExpenseId,
                convertFromScheduleId
              };
              if (composeEditScheduleId) return submitEditSchedule(args);
              if (composeEditExpenseId) return submitEditExpense(args);
              if (composeKind === "schedule") return submitNewSchedule(args);
              return submitNewExpense(args);
            }}
          >
            저장
          </button>
        }
      >
        <ComposeForm
          composeKind={composeKind}
          setComposeKind={setComposeKind}
          composeEditExpenseId={composeEditExpenseId}
          setComposeEditExpenseId={setComposeEditExpenseId}
          composeEditScheduleId={composeEditScheduleId}
          setComposeEditScheduleId={setComposeEditScheduleId}
          composeConvertFromExpenseId={composeConvertFromExpenseId}
          setComposeConvertFromExpenseId={setComposeConvertFromExpenseId}
          composeConvertFromScheduleId={composeConvertFromScheduleId}
          setComposeConvertFromScheduleId={setComposeConvertFromScheduleId}
          composeDayKey={composeDayKey}
          setComposeDayKey={setComposeDayKey}
          isTransit1={isTransit1}
          isTransit2={isTransit2}
          isTransitCategory={isTransitCategory}
          entryStartText={entryStartText}
          setEntryStartText={setEntryStartText}
          entryEndText={entryEndText}
          setEntryEndText={setEntryEndText}
          entryCategory={entryCategory}
          setEntryCategory={setEntryCategory}
          entryTitle={entryTitle}
          setEntryTitle={setEntryTitle}
          entryNote={entryNote}
          setEntryNote={setEntryNote}
          exMerchant={exMerchant}
          setExMerchant={setExMerchant}
          exDetail={exDetail}
          setExDetail={setExDetail}
          exAmount={exAmount}
          setExAmount={setExAmount}
          exPaymentType={exPaymentType}
          setExPaymentType={setExPaymentType}
          exPaymentLabel={exPaymentLabel}
          setExPaymentLabel={setExPaymentLabel}
          payerPreset={payerPreset}
          setPayerPreset={setPayerPreset}
          payerOther={payerOther}
          setPayerOther={setPayerOther}
          expenseScope={expenseScope}
          setExpenseScope={setExpenseScope}
          sharedNamesText={sharedNamesText}
          setSharedNamesText={setSharedNamesText}
          expenseCompanionsText={expenseCompanionsText}
          setExpenseCompanionsText={setExpenseCompanionsText}
          exInstallment={exInstallment}
          setExInstallment={setExInstallment}
          exInstallmentMonths={exInstallmentMonths}
          setExInstallmentMonths={setExInstallmentMonths}
          exInstallmentNoInterest={exInstallmentNoInterest}
          setExInstallmentNoInterest={setExInstallmentNoInterest}
          plannedAtEnabled={plannedAtEnabled}
          setPlannedAtEnabled={setPlannedAtEnabled}
          plannedAtLocal={plannedAtLocal}
          setPlannedAtLocal={setPlannedAtLocal}
          scheduleWithExpense={scheduleWithExpense}
          setScheduleWithExpense={setScheduleWithExpense}
          schedulePayTimeText={schedulePayTimeText}
          setSchedulePayTimeText={setSchedulePayTimeText}
          schedulePeopleText={schedulePeopleText}
          setSchedulePeopleText={setSchedulePeopleText}
          scheduleShowOnCalendar={scheduleShowOnCalendar}
          setScheduleShowOnCalendar={setScheduleShowOnCalendar}
          scheduleExpenseTitle={scheduleExpenseTitle}
          setScheduleExpenseTitle={setScheduleExpenseTitle}
          transitLegs={transitLegs}
          setTransitLegs={setTransitLegs}
          transit2SegmentsDraft={transit2SegmentsDraft}
          setTransit2SegmentsDraft={setTransit2SegmentsDraft}
          setExTransitMode={setExTransitMode}
          setExTransitFromText={setExTransitFromText}
          setExTransitToText={setExTransitToText}
          requestConfirm={requestConfirm}
          onOpenStationSearch={(legIndex, field) => {
            setBusStopSearchOpen(null);
            setStationQuery("");
            setStationSearchOpen({ legIndex, field });
          }}
          onOpenBusStopSearch={(legIndex, field) => {
            setStationSearchOpen(null);
            setBusStopSearchOpen({ legIndex, field });
          }}
        />
      </ComposeSheet>

      {/* Station search sheet */}
      <StationSearchSheet
        open={stationSearchOpen}
        query={stationQuery}
        onQueryChange={setStationQuery}
        onClose={() => setStationSearchOpen(null)}
        onPick={(target, station) => {
          setTransitLegs((arr) => {
            const next = [...arr];
            const leg = next[target.legIndex];
            if (!leg || leg.mode !== "SUBWAY") return next;
            const cur = leg as Extract<TransitLeg, { mode: "SUBWAY" }>;
            const updated =
              target.field === "from"
                ? { ...cur, from: station }
                : { ...cur, to: station };

            if (updated.from && updated.to) {
              const pool = subwayLinePool(updated.from, updated.to);
              const prev =
                target.legIndex > 0 && next[target.legIndex - 1]?.mode === "SUBWAY"
                  ? (next[target.legIndex - 1] as Extract<TransitLeg, { mode: "SUBWAY" }>)
                  : null;
              const transfer =
                Boolean(prev?.to && updated.from && prev.to.name === updated.from.name);
              updated.line = pickSubwayLineForPool(pool, { prevLine: prev?.line, transferFromPrev: transfer }, updated.line);
            } else if (target.field === "from") {
              const only = [...station.lines].sort((x, y) => x.localeCompare(y, "ko"));
              updated.line = only.length === 1 ? only[0]! : only.includes(updated.line) ? updated.line : "";
            } else {
              const only = [...station.lines].sort((x, y) => x.localeCompare(y, "ko"));
              if (only.length === 1) updated.line = only[0]!;
              else if (!only.includes(updated.line)) updated.line = "";
            }

            next[target.legIndex] = updated;
            return next;
          });
          setStationSearchOpen(null);
        }}
      />

      <BusStopSearchSheet
        open={busStopSearchOpen}
        onClose={() => setBusStopSearchOpen(null)}
        onPick={(target, stopLabel) => {
          setTransitLegs((arr) => {
            const next = [...arr];
            const leg = next[target.legIndex];
            if (!leg || leg.mode !== "BUS") return next;
            const cur = leg as Extract<TransitLeg, { mode: "BUS" }>;
            next[target.legIndex] =
              target.field === "from" ? { ...cur, from: stopLabel } : { ...cur, to: stopLabel };
            return next;
          });
          setBusStopSearchOpen(null);
        }}
      />

      {/* Expense detail sheet */}
      {expenseDetailOpen ? (
        <ExpenseDetailSheet
          expense={expenseDetailOpen}
          title={expenseDetailTitle(expenseDetailOpen)}
          subtitle={expenseDetailSubtitle(expenseDetailOpen, dayLocal00)}
          onClose={() => setExpenseDetailOpen(null)}
          isNetSettledForDay={isNetSettledForDay}
          requestToggleNetSettledForDay={requestToggleNetSettledForDay}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
                onClick={async () => {
                  await fillComposeFromExpense(expenseDetailOpen);
                  setExpenseDetailOpen(null);
                  setComposeOpen(true);
                }}
              >
                수정
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm"
                onClick={async () => {
                  await fillComposeFromExpense(expenseDetailOpen);
                  setComposeEditExpenseId(null);
                  setComposeConvertFromExpenseId(null);
                  setExpenseDetailOpen(null);
                  setComposeOpen(true);
                }}
              >
                복제
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm"
                onClick={async () => {
                  const id = expenseDetailOpen.id;
                  requestConfirm('기록이 사라집니다. 삭제하시겠습니까?', async () => {
                    await deleteExpense.mutateAsync(id);
                    setExpenseDetailOpen(null);
                  });
                }}
              >
                삭제
              </button>
            </div>
          }
        />
      ) : null}

      {scheduleDetailOpen ? (
        <ScheduleDetailSheet
          schedule={scheduleDetailOpen}
          onClose={() => setScheduleDetailOpen(null)}
          onCancelledChange={async (next) => {
            const cur = scheduleDetailOpen;
            const parsed = parseScheduleNote(cur.note);
            const peopleCsv = parsed.people.join(",");
            const memo = parsed.memo ?? "";
            const detail = parsed.detail ?? "";
            const note = encodeScheduleNote(peopleCsv, memo, detail, next);
            try {
              const updated = await updateSchedule.mutateAsync({
                id: cur.id,
                input: { note }
              });
              setScheduleDetailOpen(updated);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              window.alert(`저장에 실패했어요.\n${msg}`);
            }
          }}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
                onClick={async () => {
                  const full = scheduleDetailOpen;
                  const linked = expensesOccurringWithinSchedule(expensesData?.items ?? [], full);
                  await fillComposeFromSchedule(full, linked);
                  setScheduleDetailOpen(null);
                  setComposeOpen(true);
                }}
              >
                수정
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm"
                onClick={async () => {
                  const full = scheduleDetailOpen;
                  const linked = expensesOccurringWithinSchedule(expensesData?.items ?? [], full);
                  await fillComposeFromSchedule(full, linked);
                  setComposeEditScheduleId(null);
                  setComposeConvertFromScheduleId(null);
                  setScheduleDetailOpen(null);
                  setComposeOpen(true);
                }}
              >
                복제
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm"
                onClick={async () => {
                  const id = scheduleDetailOpen.id;
                  requestConfirm("기록이 사라집니다. 삭제하시겠습니까?", async () => {
                    await deleteSchedule.mutateAsync(id);
                    setScheduleDetailOpen(null);
                  });
                }}
              >
                삭제
              </button>
            </div>
          }
        />
      ) : null}


      {/* Confirm dialog */}
      {confirmOpen ? (
        <div className="fixed inset-0 z-[80]">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfirmOpen(null)}
            aria-label="닫기"
          />
          <div className="absolute inset-x-0 top-1/2 mx-auto w-full max-w-md -translate-y-1/2 px-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="text-sm font-semibold text-slate-900">삭제 확인</div>
              <div className="mt-2 text-sm text-slate-700">{confirmOpen.message}</div>
              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm"
                  onClick={() => setConfirmOpen(null)}
                >
                  취소
                </button>
                <button
                  className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700 shadow-sm"
                  onClick={async () => {
                    const action = confirmOpen.action;
                    setConfirmOpen(null);
                    await action();
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {settlementRecordDialogEl}

      {/* Settlement sheet */}
      {settlementSheetOpen ? (
        <div className="fixed inset-0 z-[75]">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setSettlementSheetOpen(false)}
            aria-label="닫기"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">정산표</div>
                <div className="mt-1 text-xs text-slate-500">{dayKey} · {settlementToday.me} 기준</div>
              </div>
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
                onClick={() => setSettlementSheetOpen(false)}
              >
                닫기
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {Array.from(settlementToday.perPerson.entries())
                .filter(([, amt]) => Math.abs(amt) >= 1)
                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                .map(([name, amt]) => {
                  const isReceive = amt >= 0;
                  return (
                    <div
                      key={name}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border p-3",
                        isReceive ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                      )}
                    >
                      <div className="text-sm font-semibold text-slate-900">
                        <span className={cn("mr-2 rounded-full px-2 py-0.5 text-xs text-white", isReceive ? "bg-emerald-600" : "bg-rose-600")}>
                          {isReceive ? name : "나"}
                        </span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs text-white",
                            isReceive ? "bg-slate-900" : "bg-indigo-600"
                          )}
                        >
                          {isReceive ? "나" : name}
                        </span>
                      </div>
                      <div className={cn("text-sm font-semibold tabular-nums", isReceive ? "text-emerald-700" : "text-rose-700")}>
                        {formatWon(Math.round(Math.abs(amt)))}
                      </div>
                    </div>
                  );
                })}
              {!settlementToday.perPerson.size ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  오늘 정산 항목이 없어요.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

