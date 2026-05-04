import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AUTH_SESSION_LS_KEY, AUTH_USER_LS_KEY, decodeAuthSessionPayload, readStoredSessionToken } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import SettlementRecordDialog from "@/components/SettlementRecordDialog";
import StationSearchSheet, { type StationSearchTarget } from "@/components/StationSearchSheet";
import BusStopSearchSheet from "@/components/BusStopSearchSheet";
import BottomNav from "@/components/BottomNav";
import ComposeSheet from "@/components/ComposeSheet";
import { useAppDayNavigation } from "@/hooks/useAppDayNavigation";
import { useAuthBootstrap } from "@/hooks/useAuthBootstrap";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { useSettlementDayState } from "@/hooks/useSettlementDayState";
import { useExpenseComposeForm } from "@/hooks/useExpenseComposeForm";
import { useComposeSubmit } from "@/hooks/useComposeSubmit";
import { pad2 } from "@/domain/date";
import { parseFlexibleTimeToMinutes } from "@/domain/time";
import { encodeScheduleNote, parseScheduleNote } from "@/domain/scheduleNote";
import {
  effectiveMonthlyBudgetWon,
  MONTHLY_BUDGET_BY_YM_LS_KEY,
  parseMonthlyBudgetByYm,
  readLegacyMonthlyBudgetWonFromStorage,
  serializeMonthlyBudgetByYm
} from "@/domain/monthlyBudgetStorage";
import { emojiForCategory, normalizeCategory } from "@/domain/categoryUi";
import { AGGREGATE_MODE_LS_KEY, type AggregateMode } from "@/domain/installment";
import { MonthDetailView } from "@/ui/views/MonthDetailView";
import { TodayDetailView } from "@/ui/views/TodayDetailView";
import AggregateModeToggle from "@/components/AggregateModeToggle";
import { pickSubwayLineForPool, subwayLinePool } from "@/domain/transitSubwayLines";
import { expensesOccurringWithinSchedule } from "@/domain/scheduleExpenseLink";
import { expensePersistedId } from "@/domain/expenseDayUsage";
import { plannedUsageDaySlices } from "@/domain/plannedUsageOnDay";
import type { SettlementRecord } from "@/domain/settlementDay";
import { buildUsageTransit2CountsByDayForMonth, buildUsageTransit2RowsForDay } from "@/domain/routeShellTransit2Usage";
import { useRouteShellHomeDerived } from "@/hooks/useRouteShellHomeDerived";
import { fillComposeFromExpense } from "@/features/compose/fillComposeFromExpense";
import { fillComposeFromSchedule } from "@/features/compose/fillComposeFromSchedule";
import type { FillComposeDispatchers } from "@/features/compose/fillComposeTypes";
import ConfirmDialog from "@/ui/routeShell/ConfirmDialog";
import SettlementSheet from "@/ui/routeShell/SettlementSheet";
import CalendarView from "@/ui/views/CalendarView";
import MainHomeView from "@/ui/views/MainHome/MainHomeView";
import { ComposeForm } from "@/ui/sheets/ComposeForm";
import ExpenseDetailSheet from "@/ui/sheets/ExpenseDetailSheet";
import { expenseDetailSubtitle, expenseDetailTitle } from "@/ui/sheets/ExpenseDetailLabels";
import ScheduleDetailSheet from "@/ui/sheets/ScheduleDetailSheet";
import { loadCapitalMetroStations } from "@/features/transit/stations";

export default function RouteShell({ view }: { view: "main" | "today" | "month" | "calendar" }) {
  const { navigate, selectedDay, setSelectedDay, dayKey, monthKey, dayLocal00 } = useAppDayNavigation(view);
  const { sessionReady, setSessionReady, setAuthUser } = useAuthBootstrap();

  useEffect(() => {
    void loadCapitalMetroStations();
  }, []);

  const { data: expensesData, error: expensesError } = useExpenses({ enabled: sessionReady });
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

  const {
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
    deleteSettlementRecord,
    requestToggleNetSettledForDay,
    isExpenseNetSettledForDay
  } = useSettlementDayState();

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

  const monthlyBudgetWon = useMemo(
    () => effectiveMonthlyBudgetWon(monthKey, budgetByYm, legacyBudgetFallback),
    [monthKey, budgetByYm, legacyBudgetFallback]
  );

  const { data: scheduleData, error: scheduleError } = useSchedules(dayKey, { enabled: sessionReady });
  // 달력·이번 달 화면은 월 단위로 전부 불러옴(`onlyCalendar` 필터는 기본 false인 일정이 누락되어 이모지가 비는 문제가 있음)
  const { data: monthSchedulesData } = useMonthSchedules(monthKey, {
    onlyCalendar: false,
    enabled: sessionReady
  });
  const { data: todaySummary } = useExpenseSummary(dayKey, { enabled: sessionReady });
  useMonthlyExpenseSummary(monthKey, { enabled: sessionReady });

  const {
    resolveOriginalExpense,
    todayExpensesDisplay,
    settlementToday,
    settlementAllByDay,
    budgetUi,
    timeline
  } = useRouteShellHomeDerived({
    expensesData,
    scheduleData,
    dayKey,
    dayLocal00,
    aggregateMode,
    monthKey,
    selectedDay,
    monthlyBudgetWon,
    todaySummaryTotal: todaySummary?.total,
    pacePreview
  });

  useEffect(() => {
    const err = expensesError ?? scheduleError;
    if (!(err instanceof HttpError) || err.status !== 401) return;
    try {
      window.localStorage.removeItem(AUTH_SESSION_LS_KEY);
    } catch {
      void 0;
    }
    setSessionReady(false);
    setAuthUser(null);
  }, [expensesError, scheduleError, setSessionReady, setAuthUser]);

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
  const [scheduleShowOnCalendar, setScheduleShowOnCalendar] = useState(true);
  const [scheduleRepeatYearly, setScheduleRepeatYearly] = useState(false);
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
    plannedUsageDayKey,
    setPlannedUsageDayKey,
    plannedUsageStartText,
    setPlannedUsageStartText,
    plannedUsageEndText,
    setPlannedUsageEndText,
    plannedUsageTitle,
    setPlannedUsageTitle,
    plannedUsageContent,
    setPlannedUsageContent,
    plannedUsageDetail,
    setPlannedUsageDetail,
    plannedUsageCompanionsText,
    setPlannedUsageCompanionsText,
    reset: resetComposeForm
  } = useExpenseComposeForm();

  // 작성 시트가 열리거나 카테고리를 교통1·2가 아닌 것으로 바꿀 때: 시작(필수)이 비어 있으면 현재 시각으로 채움
  // (기본 카테고리가 교통1이라 첫 effect는 건너뛰고, 식비 등으로 바꿔도 이전엔 재실행이 안 돼 저장이 막히는 문제 방지)
  useEffect(() => {
    if (!composeOpen) return;
    const cat = entryCategory.trim();
    if (cat === "교통1" || cat === "교통2") return;
    setEntryStartText((prev) => {
      if (prev.trim()) return prev;
      const now = new Date();
      return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    });
  }, [composeOpen, entryCategory, setEntryStartText]);

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
    setScheduleShowOnCalendar(true);
    setScheduleRepeatYearly(false);
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
    plannedUsageDayKey,
    plannedUsageStartText,
    plannedUsageEndText,
    plannedUsageTitle,
    plannedUsageContent,
    plannedUsageDetail,
    plannedUsageCompanionsText,
    schedulePeopleText,
    schedulePayTimeText,
    scheduleExpenseTitle,
    scheduleWithExpense,
    scheduleShowOnCalendar,
    scheduleRepeatYearly,
    scheduleCancelled,
    transit2SegmentsDraft,
    composeDayLocal00,
    composeEditExpenseId,
    composeEditScheduleId,
    handleComposeClose,
    setComposeConvertFromExpenseId,
    setComposeConvertFromScheduleId
  });

  const fillDispatchersRef = useRef<FillComposeDispatchers | null>(null);
  fillDispatchersRef.current = {
    resolveOriginalExpense,
    setComposeEditScheduleId,
    setComposeEditExpenseId,
    setComposeDayKey,
    setComposeKind,
    setScheduleWithExpense,
    setSchedulePayTimeText,
    setSchedulePeopleText,
    setScheduleShowOnCalendar,
    setScheduleRepeatYearly,
    setScheduleCancelled,
    setScheduleExpenseTitle,
    setEntryStartText,
    setEntryEndText,
    setEntryCategory,
    setEntryTitle,
    setEntryNote,
    setExDetail,
    setExMerchant,
    setExAmount,
    setExPaymentType,
    setExPaymentLabel,
    setExInstallment,
    setExInstallmentMonths,
    setExInstallmentNoInterest,
    setPayerPreset,
    setPayerOther,
    setExpenseScope,
    setSharedNamesText,
    setExpenseCompanionsText,
    setPlannedAtEnabled,
    setPlannedUsageDayKey,
    setPlannedUsageStartText,
    setPlannedUsageEndText,
    setPlannedUsageTitle,
    setPlannedUsageContent,
    setPlannedUsageDetail,
    setPlannedUsageCompanionsText,
    setTransitLegs,
    setTransit2SegmentsDraft,
    setExTransitMode,
    setExTransitFromText,
    setExTransitToText
  };

  if (!sessionReady) {
    return (
      <LoginScreen
        onLogin={(u) => {
          try {
            window.localStorage.setItem(AUTH_USER_LS_KEY, JSON.stringify(u));
          } catch {
            void 0;
          }
          setAuthUser(u);
          setSessionReady(Boolean(readStoredSessionToken() && decodeAuthSessionPayload(readStoredSessionToken()!)));
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
    const monthSchedules = monthSchedulesData?.items ?? [];
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
    const usageTransit2ByDayForMonth = buildUsageTransit2CountsByDayForMonth(monthKey, expensesData?.items ?? []);
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
    const usageTransit2ForDay = buildUsageTransit2RowsForDay(dayKey, expensesData?.items ?? []);
    const plannedUsageDayRowsForDetail = plannedUsageDaySlices(
      dayKey,
      expensesData?.items ?? [],
      dayLocal00
    ).map((s) => ({
      startMs: s.startMs,
      label: s.label,
      startText: s.startText,
      endText: s.endText,
      memo: s.scheduleMemo,
      icon: (s.usageTransitMode ?? "").trim() || emojiForCategory(normalizeCategory(s.expense.category || "기타"))
    }));
    return (
      <>
        <TodayDetailView
          header={headerEl}
          settlementDialog={settlementRecordDialogEl}
          todayExpenses={todayExpensesDisplay}
          schedules={scheduleData?.items ?? []}
          usageTransit2={usageTransit2ForDay}
          plannedUsageDayRows={plannedUsageDayRowsForDetail}
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
              const catNormEarly = normalizeCategory(category);
              if (composeKind === "expense" && catNormEarly !== "교통1") {
                if (!entryNote.trim()) {
                  window.alert("내용을 입력해줘.");
                  return;
                }
              }
              if (composeKind === "schedule") {
                if (!entryTitle.trim()) {
                  window.alert("제목을 입력해줘.");
                  return;
                }
                if (!entryNote.trim()) {
                  window.alert("내용을 입력해줘.");
                  return;
                }
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
              const title =
                composeKind === "expense" && catNormEarly !== "교통1"
                  ? entryNote.trim() || derivedTransitTitle
                  : entryTitle.trim() || derivedTransitTitle;
              if (!title.trim()) {
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
          plannedUsageDayKey={plannedUsageDayKey}
          setPlannedUsageDayKey={setPlannedUsageDayKey}
          plannedUsageStartText={plannedUsageStartText}
          setPlannedUsageStartText={setPlannedUsageStartText}
          plannedUsageEndText={plannedUsageEndText}
          setPlannedUsageEndText={setPlannedUsageEndText}
          plannedUsageTitle={plannedUsageTitle}
          setPlannedUsageTitle={setPlannedUsageTitle}
          plannedUsageContent={plannedUsageContent}
          setPlannedUsageContent={setPlannedUsageContent}
          plannedUsageDetail={plannedUsageDetail}
          setPlannedUsageDetail={setPlannedUsageDetail}
          plannedUsageCompanionsText={plannedUsageCompanionsText}
          setPlannedUsageCompanionsText={setPlannedUsageCompanionsText}
          scheduleWithExpense={scheduleWithExpense}
          setScheduleWithExpense={setScheduleWithExpense}
          schedulePayTimeText={schedulePayTimeText}
          setSchedulePayTimeText={setSchedulePayTimeText}
          schedulePeopleText={schedulePeopleText}
          setSchedulePeopleText={setSchedulePeopleText}
          scheduleShowOnCalendar={scheduleShowOnCalendar}
          setScheduleShowOnCalendar={setScheduleShowOnCalendar}
          scheduleRepeatYearly={scheduleRepeatYearly}
          setScheduleRepeatYearly={setScheduleRepeatYearly}
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
            const leg = transitLegs[legIndex];
            const busLeg = leg?.mode === "BUS" ? (leg as Extract<TransitLeg, { mode: "BUS" }>) : null;
            const b = busLeg?.busApiRoute;
            const busReuse =
              field === "to" &&
              busLeg &&
              b &&
              String(b.routeId ?? "").trim() &&
              String(b.cityCode ?? "").trim()
                ? b
                : undefined;
            setBusStopSearchOpen(busReuse ? { legIndex, field, busReuse } : { legIndex, field });
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
        onPick={(target, stopLabel, busApiContext) => {
          setTransitLegs((arr) => {
            const next = [...arr];
            const leg = next[target.legIndex];
            if (!leg || leg.mode !== "BUS") return next;
            const cur = leg as Extract<TransitLeg, { mode: "BUS" }>;
            if (target.field === "from") {
              const rn = busApiContext?.routeNo?.trim() ?? "";
              next[target.legIndex] = {
                ...cur,
                from: stopLabel,
                ...(busApiContext
                  ? {
                      busApiRoute: busApiContext,
                      ...(rn ? { busNumber: rn } : {})
                    }
                  : { busApiRoute: undefined })
              };
            } else {
              next[target.legIndex] = { ...cur, to: stopLabel };
            }
            return next;
          });
          setBusStopSearchOpen(null);
        }}
      />

      {/* Expense detail sheet */}
      {expenseDetailOpen ? (
        <ExpenseDetailSheet
          expense={expenseDetailOpen}
          title={expenseDetailTitle(expenseDetailOpen, dayKey)}
          subtitle={expenseDetailSubtitle(expenseDetailOpen, dayLocal00)}
          onClose={() => setExpenseDetailOpen(null)}
          isNetSettledForDay={isNetSettledForDay}
          requestToggleNetSettledForDay={requestToggleNetSettledForDay}
          viewerDayKey={dayKey}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
                onClick={async () => {
                  await fillComposeFromExpense(expenseDetailOpen, fillDispatchersRef.current!);
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
                  await fillComposeFromExpense(expenseDetailOpen, fillDispatchersRef.current!);
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
                onClick={() => {
                  const id = expensePersistedId(expenseDetailOpen);
                  requestConfirm("기록이 사라집니다. 삭제하시겠습니까?", async () => {
                    try {
                      await deleteExpense.mutateAsync(id);
                      setExpenseDetailOpen(null);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err);
                      window.alert(`삭제에 실패했어요.\n${msg}`);
                    }
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
                  await fillComposeFromSchedule(full, linked, fillDispatchersRef.current!);
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
                  await fillComposeFromSchedule(full, linked, fillDispatchersRef.current!);
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
                onClick={() => {
                  const id = scheduleDetailOpen.id;
                  requestConfirm("기록이 사라집니다. 삭제하시겠습니까?", async () => {
                    try {
                      await deleteSchedule.mutateAsync(id);
                      setScheduleDetailOpen(null);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err);
                      window.alert(`삭제에 실패했어요.\n${msg}`);
                    }
                  });
                }}
              >
                삭제
              </button>
            </div>
          }
        />
      ) : null}


      {confirmOpen ? (
        <ConfirmDialog
          message={confirmOpen.message}
          onCancel={() => setConfirmOpen(null)}
          onConfirm={async () => {
            const action = confirmOpen.action;
            setConfirmOpen(null);
            await action();
          }}
        />
      ) : null}

      {settlementRecordDialogEl}

      <SettlementSheet
        open={settlementSheetOpen}
        dayKey={dayKey}
        settlementToday={settlementToday}
        onClose={() => setSettlementSheetOpen(false)}
      />

    </div>
  );
}

