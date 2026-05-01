import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenseSummary,
  useExpenses,
  useMonthlyExpenseSummary,
  useUpdateExpense
} from "../features/expenses/queries";
import {
  useCreateSchedule,
  useDeleteSchedule,
  useSchedules,
  useUpdateSchedule
} from "../features/schedules/queries";
import type { Expense } from "../features/expenses/api";
import type { ScheduleItem } from "../features/schedules/api";
import { type Station } from "../features/transit/stations";
import { buildTransitPayload, type TransitLeg } from "../domain/transitPayload";
import Header from "../components/Header";
import LoginScreen from "../components/LoginScreen";
import { AUTH_USER_LS_KEY, type AuthUser } from "../lib/auth";
import SettlementRecordDialog from "../components/SettlementRecordDialog";
import StationSearchSheet, { type StationSearchTarget } from "../components/StationSearchSheet";
import ComposeSheet from "../components/ComposeSheet";
import ExpenseCard from "../components/ExpenseCard";
import { useLocalStorageState } from "../hooks/useLocalStorageState";
import { useExpenseComposeForm } from "../hooks/useExpenseComposeForm";
import { useExpenseEditForm } from "../hooks/useExpenseEditForm";
import { useScheduleEditForm } from "../hooks/useScheduleEditForm";
import {
  dateFromSlotMinutes,
  daysInMonth,
  expenseTimeLabel,
  pad2,
  timeRangeLabel,
  yyyyMmDdLocal,
  yyyyMmLocal
} from "../domain/date";
import { parseFlexibleTimeToMinutes } from "../domain/time";
import { parseAmountInput } from "../domain/parseAmountInput";
import {
  effectiveMonthlyBudgetWon,
  MONTHLY_BUDGET_BY_YM_LS_KEY,
  parseMonthlyBudgetByYm,
  readLegacyMonthlyBudgetWonFromStorage,
  serializeMonthlyBudgetByYm
} from "../domain/monthlyBudgetStorage";
import {
  formatWon,
  myShareAmountForMe,
  participantsCount,
  settlementDeltaForMe,
  settlementLineForExpense,
  settlementTransfersForMe,
  sharedParticipantsAll
} from "../domain/settlement";
import {
  ALL_CATEGORIES,
  CATEGORY_GROUPS,
  emojiForCategory,
  normalizeCategory,
  parseEmojiPrefixedTitle
} from "../domain/categoryUi";
import { MonthDetailView } from "../pages/MonthDetailView";
import { TodayDetailView } from "../pages/TodayDetailView";

type Tint = { bg: string; border: string; text: string };

const GROUP_TINT: Record<"fixed" | "food" | "optionalFixed" | "living" | "other", Tint> = {
  // 1) 교통1, 교통2, 통신, 보험
  fixed: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900" },
  // 2) 식비, 간식 (식음료 = 연한 주황)
  food: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-900" },
  // 3) 선택 고정비 - 담배, 구독 (연한 노랑)
  optionalFixed: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900" },
  // 4) 생활, 병원, 선물
  living: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900" },
  other: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-900" }
};

// 카테고리 개별 색상 우선 적용
const CATEGORY_TINT_OVERRIDE: Record<string, Tint> = {
  // 생활/병원/선물: 연한 청록색으로 통일
  생활: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900" },
  병원: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900" },
  선물: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900" },
  // god: 하늘색
  god: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-900" },
  // PPTNZ: 초록색
  PPTNZ: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900" },
  // 안재현: 검정 계열
  안재현: { bg: "bg-slate-900", border: "border-slate-900", text: "text-white" },
  // 덕질/영화/뮤지컬: 검정 계열
  덕질: { bg: "bg-slate-900", border: "border-slate-900", text: "text-white" },
  영화: { bg: "bg-slate-900", border: "border-slate-900", text: "text-white" },
  뮤지컬: { bg: "bg-slate-900", border: "border-slate-900", text: "text-white" },
  "공연/전시": { bg: "bg-slate-900", border: "border-slate-900", text: "text-white" }
};

function groupForCategory(category: string) {
  if (["교통1", "교통2", "통신", "보험"].includes(category)) return "fixed";
  if (["식비", "간식"].includes(category)) return "food";
  if (["담배", "구독"].includes(category)) return "optionalFixed";
  if (["생활", "병원", "선물"].includes(category)) return "living";
  return "other";
}

function tintForCategory(category: string): Tint {
  const c = normalizeCategory(category);
  return CATEGORY_TINT_OVERRIDE[c] ?? GROUP_TINT[groupForCategory(c)];
}

const PAYMENT_TYPE_LABEL: Record<Expense["paymentType"], string> = {
  CARD: "카드",
  CASH: "현금",
  ACCOUNT: "계좌",
  ETC: "기타"
};

const PAYMENT_TYPE_OPTIONS: Array<{ key: Expense["paymentType"]; label: string }> = [
  { key: "CARD", label: "카드" },
  { key: "CASH", label: "현금" },
  { key: "ACCOUNT", label: "이체" },
  { key: "ETC", label: "기타" }
];

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function chipClass(variant: "gray" | "orange" | "teal") {
  if (variant === "orange") return "bg-orange-50 text-orange-700 border-orange-100";
  if (variant === "teal") return "bg-indigo-50 text-indigo-700 border-indigo-100";
  return "bg-slate-100 text-slate-600 border-slate-200";
}


function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** 메인 예산 카드 — 오늘/이번달 지출 상세 진입 버튼 공통 스타일 */
const BUDGET_DETAIL_LINK_BTN =
  "shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm active:scale-[0.99]";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="9" r="4" />
    </svg>
  );
}

function MoneyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 7h18v10H3z" />
      <path d="M7 7v10" />
      <path d="M17 7v10" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function Transit1Fields({
  legs,
  setLegs,
  openStationSearch,
  requestConfirm
}: {
  legs: Array<
    | {
        mode: "BUS";
        start: string;
        end: string;
        busNumber: string;
        from: string;
        to: string;
      }
    | {
        mode: "SUBWAY";
        start: string;
        end: string;
        from: Station | null;
        to: Station | null;
        line: string;
      }
  >;
  setLegs: React.Dispatch<
    React.SetStateAction<
      Array<
        | {
            mode: "BUS";
            start: string;
            end: string;
            busNumber: string;
            from: string;
            to: string;
          }
        | {
            mode: "SUBWAY";
            start: string;
            end: string;
            from: Station | null;
            to: Station | null;
            line: string;
          }
      >
    >
  >;
  // eslint-disable-next-line no-unused-vars
  openStationSearch: (_legIndex: number, _field: "from" | "to") => void;
  // eslint-disable-next-line no-unused-vars
  requestConfirm: (_message: string, _action: () => void | Promise<void>) => void;
}) {
  return (
    <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-600">교통1 (대중교통)</div>
      <div className="mt-3 space-y-2">
        {legs.map((leg, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500">
                {idx === 0 ? "구간" : `환승 ${idx}`}
              </div>
              {idx > 0 ? (
                <button
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                  onClick={() => {
                    requestConfirm("이 구간이 삭제됩니다. 삭제하시겠습니까?", () =>
                      setLegs((arr) => arr.filter((_, i) => i !== idx))
                    );
                  }}
                >
                  삭제
                </button>
              ) : null}
            </div>

            <div className="mt-2 flex gap-2">
              {[
                { label: "버스", mode: "BUS" as const, emoji: "🚌" },
                { label: "지하철", mode: "SUBWAY" as const, emoji: "🚈" }
              ].map((opt) => (
                <button
                  key={opt.mode}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                    leg.mode === opt.mode
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-800"
                  )}
                  onClick={() => {
                    setLegs((arr) => {
                      const next = [...arr];
                      const current = next[idx] as any;
                      if (current?.mode === opt.mode) return next;
                      next[idx] =
                        opt.mode === "BUS"
                          ? {
                              mode: "BUS",
                              start: current.start,
                              end: current.end,
                              busNumber: "",
                              from: "",
                              to: ""
                            }
                          : {
                              mode: "SUBWAY",
                              start: current.start,
                              end: current.end,
                              from: null,
                              to: null,
                              line: ""
                            };
                      return next;
                    });
                  }}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label>
                <div className="mb-1 text-xs text-slate-500">출발시간</div>
                <input
                  value={leg.start}
                  onChange={(e) =>
                    setLegs((arr) => {
                      const next = [...arr];
                      next[idx] = { ...(next[idx] as any), start: e.target.value };
                      return next;
                    })
                  }
                  placeholder="예: 09:00"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label>
                <div className="mb-1 text-xs text-slate-500">도착시간</div>
                <input
                  value={leg.end}
                  onChange={(e) =>
                    setLegs((arr) => {
                      const next = [...arr];
                      next[idx] = { ...(next[idx] as any), end: e.target.value };
                      return next;
                    })
                  }
                  placeholder="예: 09:30"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            {leg.mode === "BUS" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-500">버스번호</div>
                  <input
                    value={(leg as any).busNumber}
                    onChange={(e) =>
                      setLegs((arr) => {
                        const next = [...arr];
                        next[idx] = { ...(next[idx] as any), busNumber: e.target.value };
                        return next;
                      })
                    }
                    placeholder="예: 500"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-slate-500">출발</div>
                  <input
                    value={(leg as any).from}
                    onChange={(e) =>
                      setLegs((arr) => {
                        const next = [...arr];
                        next[idx] = { ...(next[idx] as any), from: e.target.value };
                        return next;
                      })
                    }
                    placeholder="예: 집앞"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-slate-500">도착</div>
                  <input
                    value={(leg as any).to}
                    onChange={(e) =>
                      setLegs((arr) => {
                        const next = [...arr];
                        next[idx] = { ...(next[idx] as any), to: e.target.value };
                        return next;
                      })
                    }
                    placeholder="예: 회사앞"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900"
                  onClick={() => openStationSearch(idx, "from")}
                >
                  출발역: {(leg as any).from?.name ?? "선택"}
                </button>
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900"
                  onClick={() => openStationSearch(idx, "to")}
                >
                  도착역: {(leg as any).to?.name ?? "선택"}
                </button>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-500">호선(선택)</div>
                  <input
                    value={(leg as any).line}
                    onChange={(e) =>
                      setLegs((arr) => {
                        const next = [...arr];
                        next[idx] = { ...(next[idx] as any), line: e.target.value };
                        return next;
                      })
                    }
                    placeholder="예: 2호선"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm"
        onClick={() =>
          setLegs((arr) => [
            ...arr,
            { mode: "SUBWAY", start: arr[arr.length - 1]?.end ?? "09:30", end: "10:00", from: null, to: null, line: "" }
          ])
        }
      >
        + 환승 추가
      </button>
    </div>
  );
}

function Transit2Fields({
  mode,
  setMode,
  fromText,
  setFromText,
  toText,
  setToText
}: {
  mode: string;
  // eslint-disable-next-line no-unused-vars
  setMode: (_m: string) => void;
  fromText: string;
  // eslint-disable-next-line no-unused-vars
  setFromText: (_v: string) => void;
  toText: string;
  // eslint-disable-next-line no-unused-vars
  setToText: (_v: string) => void;
}) {
  return (
    <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-600">교통2 (기차/시외버스/택시/비행기)</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label>
          <div className="mb-1 text-xs text-slate-500">출발지</div>
          <input
            value={fromText}
            onChange={(e) => setFromText(e.target.value)}
            placeholder="예: 서울역"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
          />
        </label>
        <label>
          <div className="mb-1 text-xs text-slate-500">도착지</div>
          <input
            value={toText}
            onChange={(e) => setToText(e.target.value)}
            placeholder="예: 부산역"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
          />
        </label>
      </div>
      <div className="mt-2">
        <div className="mb-1 text-xs text-slate-500">수단</div>
        <div className="flex gap-2">
          {["🚆", "🚍", "🚖", "✈️"].map((m) => (
            <button
              key={m}
              className={`h-12 w-12 rounded-xl border text-xl ${
                mode === m
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
              onClick={() => setMode(m)}
              aria-label={`교통수단 ${m}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type TimelineItem =
  | {
      kind: "schedule";
      startMs: number;
      id: string;
      startAt: string;
      endAt: string;
      title: string;
      note: string | null;
      linkedExpenseSum: number;
    }
  | {
      kind: "expense";
      startMs: number;
      expense: Expense;
    };

function parseMainDayQuery(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function App({ view }: { view: "main" | "today" | "month" }) {
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
  const [calendarPopoverOpen, setCalendarPopoverOpen] = useState(false);
  const calendarInputRef = useRef<HTMLInputElement>(null as unknown as HTMLInputElement);
  const [legacyBudgetFallback] = useState(() => readLegacyMonthlyBudgetWonFromStorage());
  const [budgetByYm] = useLocalStorageState<Record<string, number>>(MONTHLY_BUDGET_BY_YM_LS_KEY, {}, {
    parse: parseMonthlyBudgetByYm,
    serialize: serializeMonthlyBudgetByYm
  });

  const [settledTransfersByExpenseId, setSettledTransfersByExpenseId] = useState<
    Map<string, Set<string>>
  >(() => new Map());

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
      // If already settled, open editor instead of unchecking.
      openSettlementLog(day, other, false);
      return;
    }
    // Optimistically check, then ask for record. If user cancels, we revert.
    toggleNetSettledForDay(day, other);
    openSettlementLog(day, other, true);
  };

  const settlementOthersForExpense = (e: Expense, me: string) => {
    const transfers = settlementTransfersForMe(e, me);
    if (!transfers.length) return [];
    return Array.from(
      new Set(
        transfers
          .flatMap((t) => [t.from, t.to])
          .map((x) => String(x).trim())
          .filter((x) => x && x !== me)
      )
    );
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
  const transferKey = (t: { from: string; to: string; amount: number }) =>
    `${t.from}→${t.to}:${t.amount}`;
  const isTransferSettled = (expenseId: string, key: string) =>
    settledTransfersByExpenseId.get(expenseId)?.has(key) ?? false;
  const toggleTransferSettled = (expenseId: string, key: string) =>
    setSettledTransfersByExpenseId((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(expenseId) ?? []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      next.set(expenseId, set);
      return next;
    });
  const isExpenseFullySettled = (e: Expense, me: string) => {
    const transfers = settlementTransfersForMe(e, me);
    if (!transfers.length) return false;
    const set = settledTransfersByExpenseId.get(e.id) ?? new Set<string>();
    return transfers.every((t) => set.has(transferKey(t)));
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
  const { data: todaySummary } = useExpenseSummary(dayKey);
  useMonthlyExpenseSummary(monthKey);

  useEffect(() => {
    if (!calendarPopoverOpen) return;
    const t = window.setTimeout(() => {
      const el = calendarInputRef.current;
      if (!el) return;
      (el as any).showPicker?.();
      el.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [calendarPopoverOpen]);

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const createSchedule = useCreateSchedule(dayKey);
  const updateSchedule = useUpdateSchedule(dayKey);
  const deleteSchedule = useDeleteSchedule(dayKey);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDayKey, setComposeDayKey] = useState<string>(() => dayKey);
  const composeDayLocal00 = useMemo(() => {
    const d = new Date(`${composeDayKey}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dayLocal00;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [composeDayKey, dayLocal00]);
  const [expenseDetailOpen, setExpenseDetailOpen] = useState<Expense | null>(null);
  const [expenseEditOpen, setExpenseEditOpen] = useState<Expense | null>(null);
  const [scheduleDetailOpen, setScheduleDetailOpen] = useState<ScheduleItem | null>(null);
  const [scheduleEditOpen, setScheduleEditOpen] = useState<ScheduleItem | null>(null);

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
    reset: resetComposeForm
  } = useExpenseComposeForm();

  const {
    editAmount,
    setEditAmount,
    editCategory,
    setEditCategory,
    editMerchant,
    setEditMerchant,
    editDetail,
    setEditDetail,
    editTimeText,
    setEditTimeText,
    editEndTimeText,
    setEditEndTimeText,
    editPaymentType,
    setEditPaymentType,
    editPaymentLabel,
    setEditPaymentLabel,
    editPayerPreset,
    setEditPayerPreset,
    editPayerOther,
    setEditPayerOther,
    editExpenseScope,
    setEditExpenseScope,
    editSharedNamesText,
    setEditSharedNamesText
  } = useExpenseEditForm();

  const {
    editSchedStart,
    setEditSchedStart,
    editSchedEnd,
    setEditSchedEnd,
    editSchedCategory,
    setEditSchedCategory,
    editSchedTitle,
    setEditSchedTitle,
    editSchedNote,
    setEditSchedNote,
    editSchedAmount,
    setEditSchedAmount,
    editSchedPaymentType,
    setEditSchedPaymentType,
    editSchedPaymentLabel,
    setEditSchedPaymentLabel,
    editSchedPayerPreset,
    setEditSchedPayerPreset,
    editSchedPayerOther,
    setEditSchedPayerOther,
    editSchedExpenseScope,
    setEditSchedExpenseScope,
    editSchedSharedNamesText,
    setEditSchedSharedNamesText
  } = useScheduleEditForm();
  // 교통2 (기차/시외/택시/비행기) - 단일 구간
  const [exTransitMode, setExTransitMode] = useState<string>("🚆"); // 교통2: 🚆🚍🚖✈️
  const [exTransitFromText, setExTransitFromText] = useState<string>("");
  const [exTransitToText, setExTransitToText] = useState<string>("");

  // 교통1 (대중교통) - 다구간(환승) 지원
  const [transitLegs, setTransitLegs] = useState<TransitLeg[]>(() => [
    { mode: "SUBWAY", start: "09:00", end: "09:30", from: null, to: null, line: "" }
  ]);

  const [stationSearchOpen, setStationSearchOpen] = useState<StationSearchTarget | null>(null);
  const [stationQuery, setStationQuery] = useState("");

  const isTransitCategory = useMemo(() => {
    const c = entryCategory.trim();
    return c === "교통1" || c === "교통2";
  }, [entryCategory]);

  const isTransit1 = entryCategory.trim() === "교통1";
  const isTransit2 = entryCategory.trim() === "교통2";

  // 교통1 상태를 작성 화면 열 때/카테고리 바뀔 때 기본값으로 동기화
  const transit1Legs = isTransit1 ? transitLegs : [];

  const todayExpenses = useMemo(() => {
    const items = expensesData?.items ?? [];
    return items
      .filter((e) => yyyyMmDdLocal(new Date(e.occurredAt)) === dayKey)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  }, [expensesData, dayKey]);

  const monthToDateTotal = useMemo(() => {
    const items = expensesData?.items ?? [];
    return items.reduce((sum, e) => {
      const d = new Date(e.occurredAt);
      if (yyyyMmLocal(d) !== monthKey) return sum;
      if (yyyyMmDdLocal(d) > dayKey) return sum;
      return sum + (Number(e.amount) || 0);
    }, 0);
  }, [dayKey, expensesData, monthKey]);

  const myMonthToDateTotal = useMemo(() => {
    const items = expensesData?.items ?? [];
    const me = "나";
    return items.reduce((sum, e) => {
      const d = new Date(e.occurredAt);
      if (yyyyMmLocal(d) !== monthKey) return sum;
      if (yyyyMmDdLocal(d) > dayKey) return sum;
      return sum + myShareAmountForMe(e, me);
    }, 0);
  }, [dayKey, expensesData, monthKey]);

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
      if (e.scope !== "SHARED") continue;
      const d = settlementDeltaForMe(e, me);
      iPay += d.iPay;
      iReceive += d.iReceive;
      for (const [name, amt] of d.perPerson.entries()) {
        perPerson.set(name, (perPerson.get(name) ?? 0) + amt);
      }
    }
    return { me, iPay, iReceive, perPerson };
  }, [todayExpenses]);

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
    // Treat everything as expense; schedules are not shown.
    const expenses = todayExpenses;
    const expenseItems: TimelineItem[] = expenses.map((e) => ({
      kind: "expense",
      startMs: new Date(e.occurredAt).getTime(),
      expense: e
    }));
    return expenseItems.sort((a, b) => a.startMs - b.startMs);
  }, [todayExpenses]);

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
      monthMode={monthExpenseDetailOpen}
      calendarPopoverOpen={calendarPopoverOpen}
      setCalendarPopoverOpen={setCalendarPopoverOpen}
      calendarInputRef={calendarInputRef}
      onPick={(d) => setSelectedDay(d)}
      onPrev={() => {
        const d = new Date(selectedDay);
        if (monthExpenseDetailOpen) {
          d.setDate(1);
          d.setMonth(d.getMonth() - 1);
        } else {
          d.setDate(d.getDate() - 1);
        }
        setSelectedDay(d);
      }}
      onNext={() => {
        const d = new Date(selectedDay);
        if (monthExpenseDetailOpen) {
          d.setDate(1);
          d.setMonth(d.getMonth() + 1);
        } else {
          d.setDate(d.getDate() + 1);
        }
        setSelectedDay(d);
      }}
      showDetailClose={todayExpenseDetailOpen || monthExpenseDetailOpen}
      onDetailClose={() => navigate("/", { replace: false })}
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
        if (settlementLogOpen?.revertOnClose) {
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
        setSettlementLogOpen(null);
      }}
    />
  );

  if (monthExpenseDetailOpen) {
    return (
      <MonthDetailView
        header={headerEl}
        settlementDialog={settlementRecordDialogEl}
        expenses={expensesData?.items}
        monthKey={monthKey}
        monthlyBudgetWon={monthlyBudgetWon}
        me="나"
        isNetSettledForDay={isNetSettledForDay}
        requestToggleNetSettledForDay={requestToggleNetSettledForDay}
      />
    );
  }

  if (todayExpenseDetailOpen) {
    return (
      <TodayDetailView
        header={headerEl}
        settlementDialog={settlementRecordDialogEl}
        todayExpenses={todayExpenses}
        budgetUi={budgetUi}
        settlementToday={settlementToday}
        dayKey={dayKey}
        isNetSettledForDay={isNetSettledForDay}
        requestToggleNetSettledForDay={requestToggleNetSettledForDay}
      />
    );
  }

  return (
    <div className="min-h-dvh">
      {headerEl}

      <main className="mx-auto w-full max-w-md px-4 pb-6 pt-2">
        {expensesError || scheduleError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            API 연결 실패. 서버 실행 상태를 확인하세요.
          </div>
        ) : null}

        {showCategoryPreview ? (
          <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">카테고리 이모티콘 미리보기</h2>
              <div className="text-xs text-slate-500">?previewCategories=1</div>
            </div>
            <div className="mt-3 space-y-4">
              {CATEGORY_GROUPS.map((g) => (
                <div key={g.label}>
                  <div className="text-xs font-semibold text-slate-500">{g.label}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {g.items.map((c) => {
                      const tint = tintForCategory(c);
                      return (
                        <div
                          key={c}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 shadow-sm",
                            tint.bg,
                            tint.border
                          )}
                        >
                          <div className={cn("text-sm font-semibold", tint.text)}>
                            <span className="mr-2">{emojiForCategory(c)}</span>
                            {c}
                          </div>
                          <div className="text-xs text-slate-500">{emojiForCategory(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mb-4 overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
          <div className="h-2 w-full bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400" />
          <div className="px-5 pb-5 pt-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-500">오늘 지출</div>
                <div className="mt-1 flex items-baseline gap-1 tabular-nums text-slate-900">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {Math.round(budgetUi.todayTotal).toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">원</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">오늘 예산 {formatWon(Math.round(budgetUi.dailyBudget))}</div>
              </div>
              <button
                type="button"
                className={BUDGET_DETAIL_LINK_BTN}
                onClick={() => navigate(`/today/${encodeURIComponent(dayKey)}`)}
              >
                오늘 지출 상세
              </button>
            </div>

            <div className="mt-4 rounded-3xl border border-indigo-200/70 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-500">이번달 예산 현황</div>
                <button
                  type="button"
                  className={BUDGET_DETAIL_LINK_BTN}
                  onClick={() => navigate(`/month/${encodeURIComponent(monthKey)}`)}
                  title="이번달 지출 상세"
                >
                  이번달 지출 상세
                </button>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-white">
                <div
                  className="h-2 rounded-full bg-indigo-600"
                  style={{ width: `${budgetUi.monthPctText}%` }}
                />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500">이번달 지출</div>
                  <div className="mt-1 flex items-baseline gap-1 tabular-nums text-slate-900">
                    <span className="text-base font-extrabold tracking-tight">
                      {Math.round(budgetUi.monthTotal).toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">원</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold text-slate-500">예산</div>
                  <div className="mt-1 flex items-baseline justify-end gap-1 tabular-nums text-slate-900">
                    <span className="text-base font-extrabold tracking-tight">{monthlyBudgetWon.toLocaleString()}</span>
                    <span className="text-xs font-semibold text-slate-400">원</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "mt-4 flex items-start gap-3 rounded-2xl border p-4",
                // keep bubble tone but on light card
                budgetUi.paceUi.bubble
              )}
            >
              <div className="shrink-0 text-2xl leading-none">{budgetUi.paceUi.emoji}</div>
              <div className="min-w-0">
                <div className="whitespace-pre-line text-sm font-semibold">{budgetUi.message}</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500">
                  예산 {formatWon(monthlyBudgetWon)}원 중 {budgetUi.monthPctText}% 사용
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">오늘 기록</h2>

          <ul className="mt-2 space-y-2">
            {timeline.length === 0 ? (
              <li className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
                아직 기록이 없어요. 오른쪽 아래 + 버튼으로 기록해봐.
              </li>
            ) : null}

            {timeline.map((it) => {
              if (it.kind === "schedule") {
                const parsedTitle = parseEmojiPrefixedTitle(it.title);
                const cat = normalizeCategory(parsedTitle.category);
                const tint = tintForCategory(cat);
                return (
                  <li key={`s-${it.id}`}>
                    <button
                      className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:brightness-[0.99]"
                      onClick={() => {
                        const full = (scheduleData?.items ?? []).find((s) => s.id === it.id);
                        if (!full) return;
                        // 카드 클릭 시 바로 "기록 수정" 폼 열기 (작성 폼과 동일한 편집 흐름)
                        setScheduleEditOpen(full);
                        const s = new Date(full.startAt);
                        const e = new Date(full.endAt);
                        setEditSchedStart(`${pad2(s.getHours())}:${pad2(s.getMinutes())}`);
                        setEditSchedEnd(`${pad2(e.getHours())}:${pad2(e.getMinutes())}`);
                        const parsed = parseEmojiPrefixedTitle(full.title);
                        setEditSchedCategory(parsed.category);
                        setEditSchedTitle(parsed.content);
                        setEditSchedNote(full.note ?? "");
                        setEditSchedAmount("");
                        setEditSchedPaymentType("CARD");
                        setEditSchedPaymentLabel("");
                        setEditSchedPayerPreset("나");
                        setEditSchedPayerOther("");
                        setEditSchedExpenseScope("PERSONAL");
                        setEditSchedSharedNamesText("");

                        // 교통 카테고리면 작성 폼과 같은 입력 UI 기본값 동기화
                        if (parsed.category === "교통1") {
                          setTransitLegs([
                            {
                              mode: "SUBWAY",
                              start: `${pad2(s.getHours())}:${pad2(s.getMinutes())}`,
                              end: `${pad2(e.getHours())}:${pad2(e.getMinutes())}`,
                              from: null,
                              to: null,
                              line: ""
                            }
                          ]);
                        }
                        if (parsed.category === "교통2") {
                          setExTransitMode("🚆");
                          setExTransitFromText("");
                          setExTransitToText("");
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <div
                            className={cn(
                              "mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl",
                              tint.border,
                              tint.bg
                            )}
                          >
                            {emojiForCategory(cat)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-900">
                              {parsedTitle.content || it.title}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <ClockIcon className="h-4 w-4 text-slate-300" />
                                <span className="tabular-nums">
                                  {timeRangeLabel(it.startAt, it.endAt)}
                                </span>
                              </span>
                              {it.note ? (
                                <>
                                  <span>·</span>
                                  <span className="truncate">{it.note}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-semibold text-slate-400">기록</div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              }

              const e = it.expense;
              const tint = tintForCategory(e.category || "기타");
              const settlementLine = settlementLineForExpense(e, "나");
              const isSettled = isExpenseNetSettledForDay(dayKey, e, "나") || isExpenseFullySettled(e, "나");
              const settlementRecText =
                isSettled && settlementLine
                  ? (() => {
                      const others = settlementOthersForExpense(e, "나");
                      const recs = others.map((o) => ({ other: o, rec: getSettlementRecordForDay(dayKey, o) }));
                      const first = recs.find((x) => x.rec)?.rec;
                      if (!first) return null;
                      const methodText = normalizeLegacySettlementMethod(first.method);
                      const extra = recs.filter((x) => x.rec).length;
                      const extraPart = extra > 1 ? ` 외 ${extra - 1}` : "";
                      return `${first.paidAtLocal.replace("T", " ")} · ${methodText}${extraPart}`;
                    })()
                  : null;
              const openSettlementEditorFromTag = () => {
                const others = settlementOthersForExpense(e, "나");
                if (!others.length) {
                  setExpenseDetailOpen(e);
                  return;
                }
                const hasRecord = others.some((o) => getSettlementRecordForDay(dayKey, o));
                const netDone = isExpenseNetSettledForDay(dayKey, e, "나");
                if (hasRecord || netDone) {
                  const other =
                    others.find((o) => getSettlementRecordForDay(dayKey, o)) ??
                    others.find((o) => isNetSettledForDay(dayKey, o)) ??
                    others[0]!;
                  openSettlementLog(dayKey, other, false);
                  return;
                }
                if (isExpenseFullySettled(e, "나")) {
                  setExpenseDetailOpen(e);
                  return;
                }
                setExpenseDetailOpen(e);
              };
              const onSettlementTagClick = (ev: MouseEvent | KeyboardEvent) => {
                ev.stopPropagation();
                if ("preventDefault" in ev) ev.preventDefault();
                openSettlementEditorFromTag();
              };
              return (
                <li key={`e-${e.id}`}>
                  <ExpenseCard
                    onClick={() => setExpenseDetailOpen(e)}
                    leftIcon={
                      <div
                        className={cn(
                          "mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl",
                          tint.border,
                          tint.bg
                        )}
                      >
                        {emojiForCategory(e.category)}
                      </div>
                    }
                    title={e.merchant ?? normalizeCategory(e.category)}
                    chips={
                      <>
                        {e.scope === "SHARED" ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              chipClass("teal")
                            )}
                        >
                          공동 · {participantsCount(e) ?? "?"}명
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              chipClass("gray")
                            )}
                          >
                            개인
                          </span>
                        )}
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            chipClass("gray")
                          )}
                        >
                          {PAYMENT_TYPE_LABEL[e.paymentType]}
                        </span>
                      </>
                    }
                    meta={
                      <>
                        <span className="inline-flex items-center gap-1">
                          <ClockIcon className="h-4 w-4 text-slate-300" />
                          <span className="tabular-nums">
                            {e.endAt
                              ? timeRangeLabel(e.occurredAt, e.endAt)
                              : expenseTimeLabel(e.occurredAt, dayLocal00)}
                          </span>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="h-4 w-4 text-slate-300" />
                          <span>{e.paymentOwner ?? "-"}</span>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <MoneyIcon className="h-4 w-4 text-slate-300" />
                          <span>
                            {e.paymentType === "CASH"
                              ? "현금"
                              : e.paymentMethodLabel || PAYMENT_TYPE_LABEL[e.paymentType]}
                          </span>
                        </span>
                      </>
                    }
                    quote={
                      e.detail || e.memo ? (
                        <div className="line-clamp-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          “{e.detail ?? e.memo ?? ""}”
                        </div>
                      ) : null
                    }
                    amount={
                      e.amount > 0 ? (
                        <div className="flex items-baseline justify-end gap-1 tabular-nums text-slate-900">
                          <span className="text-lg font-extrabold tracking-tight">
                            {e.amount.toLocaleString()}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">원</span>
                        </div>
                      ) : (
                        <div className="text-lg font-semibold tabular-nums text-slate-300"> </div>
                      )
                    }
                    settlement={
                      settlementLine ? (
                        <>
                          <span
                            className={cn(
                              "min-w-0 flex-1 text-left text-[11px] font-semibold leading-snug text-slate-400",
                              settlementRecText ? "pl-[calc(3rem+0.75rem)]" : ""
                            )}
                          >
                            {settlementRecText ?? ""}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            className="inline-flex shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-indigo-500"
                            onClick={onSettlementTagClick}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter" || ev.key === " ") onSettlementTagClick(ev);
                            }}
                          >
                            <div
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                                isSettled
                                  ? "bg-slate-100 text-slate-500"
                                  : settlementLine.kind === "receive"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700"
                              )}
                            >
                              <span className="opacity-80">🏷</span>
                              <span className="tabular-nums">
                                {settlementLine.kind === "receive" ? "+" : "-"}
                                {formatWon(settlementLine.amount)}
                              </span>
                            </div>
                          </span>
                        </>
                      ) : null
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      {/* FAB (keep inside mobile-first width) */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40">
        <div className="mx-auto flex w-full max-w-md justify-end px-6">
          <button
            className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.99]"
            onClick={() => {
              setComposeDayKey(dayKey);
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

      {/* Unified compose sheet */}
      <ComposeSheet
        open={composeOpen}
        title="기록 작성"
        subtitle={composeDayKey}
        onClose={() => setComposeOpen(false)}
        footer={
          <button
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={createSchedule.isPending || createExpense.isPending}
            onClick={async () => {
              const category = entryCategory.trim();
              if (!category) {
                window.alert("카테고리를 선택해줘.");
                return;
              }
              const title = entryTitle.trim();
              if (!title) {
                window.alert("내용을 입력해줘.");
                return;
              }
              if (exPaymentType === "ETC" && !exPaymentLabel.trim()) {
                window.alert("기타 결제수단 이름을 입력해줘.");
                return;
              }

              // 공통: 시간 파싱
              const startMin = parseFlexibleTimeToMinutes(entryStartText);
              const endMin = parseFlexibleTimeToMinutes(entryEndText);
              if (startMin == null || endMin == null) return;
              if (!(startMin < endMin)) return;

              // Always save as "expense". If amount is empty -> store 0 (UI hides it).
              const amount = parseAmountInput(exAmount);
              if (amount == null) {
                window.alert("금액은 숫자로 입력해줘. (예: 12000 또는 12,000)");
                return;
              }
              const occurredAt = dateFromSlotMinutes(composeDayLocal00, startMin).toISOString();
              const endAt = dateFromSlotMinutes(composeDayLocal00, endMin).toISOString();

              const transitPayload = buildTransitPayload(entryCategory, {
                legs: transitLegs,
                transit2: {
                  mode: exTransitMode,
                  start: entryStartText.trim(),
                  end: entryEndText.trim(),
                  fromText: exTransitFromText,
                  toText: exTransitToText
                }
              });

              const payerName =
                payerPreset === "나" ? "나" : payerOther.trim() ? payerOther.trim() : "기타";

              const participants =
                expenseScope === "SHARED"
                  ? Array.from(
                      new Set(
                        sharedNamesText
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    )
                  : null;
              const participantsAll =
                expenseScope === "SHARED" ? sharedParticipantsAll(payerName, participants) : null;

              await createExpense.mutateAsync({
                occurredAt,
                endAt,
                amount,
                category,
                merchant: title,
                detail: exDetail.trim() ? exDetail.trim() : null,
                memo: entryNote.trim() ? entryNote.trim() : null,
                paymentType: exPaymentType,
                paymentOwner: payerName,
                paymentMethodLabel:
                  exPaymentType === "CASH" ? null : exPaymentLabel.trim() ? exPaymentLabel.trim() : null,
                installment: false,
                installmentMonths: null,
                scope: expenseScope,
                participants: participantsAll,
                ...transitPayload
              });

              setComposeOpen(false);
              resetComposeForm();
            }}
          >
            저장
          </button>
        }
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">날짜</div>
                  <input
                    type="date"
                    value={composeDayKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      setComposeDayKey(v);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-slate-400">
                    {isTransitCategory ? "출발시간" : "시작"}
                  </div>
                  <input
                    value={entryStartText}
                    onChange={(e) => {
                      setEntryStartText(e.target.value);
                    }}
                    placeholder="예: 09:00 (05:00~28:30)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-slate-400">
                    {isTransitCategory ? "도착시간" : "끝"}
                  </div>
                  <input
                    value={entryEndText}
                    onChange={(e) => setEntryEndText(e.target.value)}
                    placeholder="예: 09:30 (05:00~28:30)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">카테고리</div>
                  <select
                    value={entryCategory}
                    onChange={(e) => setEntryCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    {CATEGORY_GROUPS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.items.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                {isTransit1 ? (
                  <Transit1Fields
                    legs={transit1Legs as any}
                    setLegs={setTransitLegs as any}
                    requestConfirm={requestConfirm}
                    openStationSearch={(legIndex, field) => {
                      setStationQuery("");
                      setStationSearchOpen({ legIndex, field });
                    }}
                  />
                ) : null}

                {isTransit2 ? (
                  <Transit2Fields
                    mode={exTransitMode}
                    setMode={setExTransitMode}
                    fromText={exTransitFromText}
                    setFromText={setExTransitFromText}
                    toText={exTransitToText}
                    setToText={setExTransitToText}
                  />
                ) : null}

                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">내용</div>
                  <input
                    value={entryTitle}
                    onChange={(e) => setEntryTitle(e.target.value)}
                    placeholder="예: 교통 이동시간 / 영화 / 헬스 / 오늘 뭐했는지"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>

                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">메모</div>
                  <input
                    value={entryNote}
                    onChange={(e) => setEntryNote(e.target.value)}
                    placeholder="선택"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>

                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">금액(없으면 비워도 됨)</div>
                  <input
                    inputMode="numeric"
                    value={exAmount}
                    onChange={(e) => setExAmount(e.target.value)}
                    placeholder={isTransitCategory ? "예: 교통비" : "예: 12000"}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-slate-400"
                  />
                </label>

                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <label className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-500">결제자</div>
                    <div className="flex gap-2">
                      {(["나", "기타"] as const).map((p) => (
                        <button
                          key={p}
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                            payerPreset === p
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 bg-white text-slate-800"
                          )}
                          onClick={() => setPayerPreset(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    {payerPreset === "기타" ? (
                      <input
                        value={payerOther}
                        onChange={(e) => setPayerOther(e.target.value)}
                        placeholder="결제자 이름"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      />
                    ) : null}
                  </label>

                  <label className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-500">지출 유형</div>
                    <div className="flex gap-2">
                      {[
                        { key: "PERSONAL" as const, label: "개인" },
                        { key: "SHARED" as const, label: "공동" }
                      ].map((t) => (
                        <button
                          key={t.key}
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                            expenseScope === t.key
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 bg-white text-slate-800"
                          )}
                          onClick={() => setExpenseScope(t.key)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {expenseScope === "SHARED" ? (
                      <input
                        value={sharedNamesText}
                        onChange={(e) => setSharedNamesText(e.target.value)}
                        placeholder="함께한 사람 (쉼표로 구분) 예: 나,철수,영희"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      />
                    ) : null}
                  </label>
                </div>

                <label className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-500">결제수단</div>
                  <div className="flex gap-2">
                    {PAYMENT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        className={cn(
                          "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                          exPaymentType === opt.key
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-white text-slate-800"
                        )}
                        onClick={() => {
                          setExPaymentType(opt.key);
                          if (opt.key === "CASH") setExPaymentLabel("");
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {exPaymentType !== "CASH" ? (
                    <input
                      value={exPaymentLabel}
                      onChange={(e) => setExPaymentLabel(e.target.value)}
                      placeholder={
                        exPaymentType === "CARD"
                          ? "카드 이름(선택)"
                          : exPaymentType === "ACCOUNT"
                            ? "이체 메모(선택) 예: 토스/계좌"
                            : "기타 결제수단 이름(필수)"
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  ) : null}
                </label>

                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">결제처(선택)</div>
                  <input
                    value={exMerchant}
                    onChange={(e) => setExMerchant(e.target.value)}
                    placeholder="예: CGV / 편의점 / 택시"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">세부내용(선택)</div>
                  <input
                    value={exDetail}
                    onChange={(e) => setExDetail(e.target.value)}
                    placeholder="예: 팝콘, 콜라 / 영등포→서울역"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
              </div>
        </div>
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

            // 라인 자동 추천(교집합)
            if (updated.from && updated.to) {
              const common = updated.from.lines.find((l) => updated.to?.lines.includes(l));
              updated.line = common ?? updated.from.lines[0] ?? "";
            } else if (target.field === "from") {
              updated.line = station.lines[0] ?? updated.line;
            }

            next[target.legIndex] = updated;
            return next;
          });
          setStationSearchOpen(null);
        }}
      />

      {/* Expense detail sheet */}
      {expenseDetailOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setExpenseDetailOpen(null)}
            aria-label="닫기"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-screen-sm max-h-[90dvh] flex-col rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  <span className="mr-2 text-base">{emojiForCategory(expenseDetailOpen.category)}</span>
                  {expenseDetailOpen.merchant ?? normalizeCategory(expenseDetailOpen.category)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {(expenseDetailOpen.endAt
                    ? timeRangeLabel(expenseDetailOpen.occurredAt, expenseDetailOpen.endAt)
                    : expenseTimeLabel(expenseDetailOpen.occurredAt, dayLocal00)) + " · "}
                  {PAYMENT_TYPE_LABEL[expenseDetailOpen.paymentType]}
                  {expenseDetailOpen.installment && expenseDetailOpen.installmentMonths
                    ? ` · 할부 ${expenseDetailOpen.installmentMonths}개월`
                    : ""}
                </div>
              </div>
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
                onClick={() => setExpenseDetailOpen(null)}
              >
                닫기
              </button>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto overscroll-contain pb-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {expenseDetailOpen.amount > 0 ? (
                <div className="flex items-baseline justify-between">
                  <div className="text-xs text-slate-400">금액</div>
                  <div className="text-base font-semibold tabular-nums text-slate-900">
                    {formatWon(expenseDetailOpen.amount)}
                  </div>
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">결제수단</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {PAYMENT_TYPE_LABEL[expenseDetailOpen.paymentType]}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">결제자</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {expenseDetailOpen.paymentOwner ?? "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">카드/수단명</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {expenseDetailOpen.paymentMethodLabel ?? "-"}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-slate-500">결제처</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {expenseDetailOpen.merchant ?? "-"}
                  </div>
                </div>
              </div>
              {expenseDetailOpen.transitFrom || expenseDetailOpen.transitTo ? (
                <div className="mt-3">
                  <div className="text-xs text-slate-500">이동</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {(expenseDetailOpen.transitMode ?? "") + " "}
                    {(expenseDetailOpen.transitFrom ?? "?") +
                      (expenseDetailOpen.transitVia
                        ? ` → ${expenseDetailOpen.transitVia.split("|").join(" → ")}`
                        : "") +
                      " → " +
                      (expenseDetailOpen.transitTo ?? "?")}
                    {expenseDetailOpen.transitLine ? ` · ${expenseDetailOpen.transitLine}` : ""}
                    {expenseDetailOpen.transitBusNumber
                      ? ` · ${expenseDetailOpen.transitBusNumber}`
                      : ""}
                  </div>
                </div>
              ) : null}
              {expenseDetailOpen.detail ? (
                <div className="mt-3">
                  <div className="text-xs text-slate-500">세부내용</div>
                  <div className="mt-1 text-sm text-slate-800">{expenseDetailOpen.detail}</div>
                </div>
              ) : null}
              {expenseDetailOpen.memo ? (
                <div className="mt-3">
                  <div className="text-xs text-slate-500">메모</div>
                  <div className="mt-1 text-sm text-slate-800">{expenseDetailOpen.memo}</div>
                </div>
              ) : null}
              {expenseDetailOpen.participants ? (
                <div className="mt-3">
                  <div className="text-xs text-slate-500">함께한 사람</div>
                  <div className="mt-1 text-sm text-slate-800">
                    {Array.isArray(expenseDetailOpen.participants)
                      ? (expenseDetailOpen.participants as unknown[]).join(", ")
                      : JSON.stringify(expenseDetailOpen.participants)}
                  </div>
                </div>
              ) : null}

              {settlementTransfersForMe(expenseDetailOpen, "나").length ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">정산</div>
                    <div className="text-xs font-semibold text-slate-500">건별 완료</div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {settlementTransfersForMe(expenseDetailOpen, "나").map((t, idx) => {
                      const key = transferKey(t);
                      const done = isTransferSettled(expenseDetailOpen.id, key);
                      return (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="text-sm font-semibold text-slate-700">
                          <span className="mr-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
                            {t.from}
                          </span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">
                            {t.to}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-semibold tabular-nums text-slate-900">
                            {formatWon(t.amount)}
                          </div>
                          <button
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                              done
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-600"
                            )}
                            onClick={() => toggleTransferSettled(expenseDetailOpen.id, key)}
                          >
                            <span
                              className={cn(
                                "inline-flex h-4 w-4 items-center justify-center rounded-full border",
                                done ? "border-emerald-300 bg-emerald-100" : "border-slate-300 bg-white"
                              )}
                            >
                              {done ? "✓" : ""}
                            </span>
                            완료
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            </div>

            <div className="mt-3 flex gap-2 border-t border-slate-200 pt-3">
              <button
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm"
                onClick={() => {
                  setExpenseEditOpen(expenseDetailOpen);
                  const d = new Date(expenseDetailOpen.occurredAt);
                  setEditTimeText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
                  const ed = expenseDetailOpen.endAt ? new Date(expenseDetailOpen.endAt) : d;
                  setEditEndTimeText(`${pad2(ed.getHours())}:${pad2(ed.getMinutes())}`);
                  setEditAmount(String(expenseDetailOpen.amount));
                  setEditCategory(expenseDetailOpen.category);
                  setEditMerchant(expenseDetailOpen.merchant ?? "");
                  setEditDetail(expenseDetailOpen.detail ?? "");
                  setEditPaymentType(expenseDetailOpen.paymentType);
                  setEditPaymentLabel(expenseDetailOpen.paymentMethodLabel ?? "");
                  const owner = expenseDetailOpen.paymentOwner ?? "나";
                  setEditPayerPreset(owner === "나" ? "나" : "기타");
                  setEditPayerOther(owner === "나" ? "" : owner);
                  setEditExpenseScope(expenseDetailOpen.scope ?? "PERSONAL");
                  setEditSharedNamesText(
                    Array.isArray(expenseDetailOpen.participants)
                      ? (expenseDetailOpen.participants as unknown[]).join(", ")
                      : ""
                  );
                  if (normalizeCategory(expenseDetailOpen.category) === "교통1") {
                    const seg = expenseDetailOpen.transitSegments;
                    if (Array.isArray(seg) && seg.length) {
                      setTransitLegs(() => {
                        const mapped = seg
                          .map((s) => {
                            if (!s || typeof s !== "object") return null;
                            const anyS: any = s;
                            if (anyS.mode === "BUS") {
                              return {
                                mode: "BUS" as const,
                                start: anyS.start ?? "09:00",
                                end: anyS.end ?? "09:30",
                                busNumber: anyS.busNumber ?? "",
                                from: anyS.from ?? "",
                                to: anyS.to ?? ""
                              };
                            }
                            if (anyS.mode === "SUBWAY") {
                              return {
                                mode: "SUBWAY" as const,
                                start: anyS.start ?? "09:00",
                                end: anyS.end ?? "09:30",
                                from: null,
                                to: null,
                                line: anyS.line ?? ""
                              };
                            }
                            return null;
                          })
                          .filter(Boolean) as any[];
                        return mapped.length
                          ? (mapped as any)
                          : [
                              {
                                mode: "SUBWAY",
                                start: "09:00",
                                end: "09:30",
                                from: null,
                                to: null,
                                line: ""
                              }
                            ];
                      });
                    }
                  }
                  if (normalizeCategory(expenseDetailOpen.category) === "교통2") {
                    setExTransitMode(expenseDetailOpen.transitMode ?? "🚆");
                    setExTransitFromText(expenseDetailOpen.transitFrom ?? "");
                    setExTransitToText(expenseDetailOpen.transitTo ?? "");
                  }
                  setExpenseDetailOpen(null);
                }}
              >
                수정
              </button>
              <button
                className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm"
                onClick={async () => {
                  const id = expenseDetailOpen.id;
                  requestConfirm("기록이 사라집니다. 삭제하시겠습니까?", async () => {
                    await deleteExpense.mutateAsync(id);
                    setExpenseDetailOpen(null);
                  });
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Expense edit full screen */}
      {expenseEditOpen ? (
        <div className="fixed inset-0 z-[55]">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setExpenseEditOpen(null)}
            aria-label="닫기"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-sm rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">기록 수정</div>
                <div className="mt-1 text-xs text-slate-500">{expenseEditOpen.id}</div>
              </div>
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
                onClick={() => setExpenseEditOpen(null)}
              >
                닫기
              </button>
            </div>

            <div className="mt-3 max-h-[70dvh] overflow-auto">
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <div className="mb-1 text-xs text-slate-400">시작</div>
                  <input
                    value={editTimeText}
                    onChange={(e) => setEditTimeText(e.target.value)}
                    placeholder="예: 09:00 (05:00~28:30)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-slate-400">끝</div>
                  <input
                    value={editEndTimeText}
                    onChange={(e) => setEditEndTimeText(e.target.value)}
                    placeholder="예: 09:30 (05:00~28:30)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-slate-400">카테고리</div>
                  <select
                    value={normalizeCategory(editCategory)}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    {!ALL_CATEGORIES.includes(normalizeCategory(editCategory)) ? (
                      <option value={normalizeCategory(editCategory)}>
                        {normalizeCategory(editCategory)}
                      </option>
                    ) : null}
                    {CATEGORY_GROUPS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.items.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                {normalizeCategory(editCategory) === "교통1" ? (
                  <Transit1Fields
                    legs={transitLegs as any}
                    setLegs={setTransitLegs as any}
                    requestConfirm={requestConfirm}
                    openStationSearch={(legIndex, field) => {
                      setStationQuery("");
                      setStationSearchOpen({ legIndex, field });
                    }}
                  />
                ) : null}

                {normalizeCategory(editCategory) === "교통2" ? (
                  <Transit2Fields
                    mode={exTransitMode}
                    setMode={setExTransitMode}
                    fromText={exTransitFromText}
                    setFromText={setExTransitFromText}
                    toText={exTransitToText}
                    setToText={setExTransitToText}
                  />
                ) : null}

                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">금액</div>
                  <input
                    inputMode="numeric"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-slate-400"
                  />
                </label>

                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <label className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-500">결제자</div>
                    <div className="flex gap-2">
                      {(["나", "기타"] as const).map((p) => (
                        <button
                          key={p}
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                            editPayerPreset === p
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 bg-white text-slate-800"
                          )}
                          onClick={() => setEditPayerPreset(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    {editPayerPreset === "기타" ? (
                      <input
                        value={editPayerOther}
                        onChange={(e) => setEditPayerOther(e.target.value)}
                        placeholder="결제자 이름"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      />
                    ) : null}
                  </label>

                  <label className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-500">지출 유형</div>
                    <div className="flex gap-2">
                      {[
                        { key: "PERSONAL" as const, label: "개인" },
                        { key: "SHARED" as const, label: "공동" }
                      ].map((t) => (
                        <button
                          key={t.key}
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                            editExpenseScope === t.key
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 bg-white text-slate-800"
                          )}
                          onClick={() => setEditExpenseScope(t.key)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {editExpenseScope === "SHARED" ? (
                      <input
                        value={editSharedNamesText}
                        onChange={(e) => setEditSharedNamesText(e.target.value)}
                        placeholder="함께한 사람 (쉼표로 구분) 예: 나,철수,영희"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      />
                    ) : null}
                  </label>
                </div>

                <label className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-500">결제수단</div>
                  <div className="flex gap-2">
                    {PAYMENT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        className={cn(
                          "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                          editPaymentType === opt.key
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-white text-slate-800"
                        )}
                        onClick={() => {
                          setEditPaymentType(opt.key);
                          if (opt.key === "CASH") setEditPaymentLabel("");
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {editPaymentType !== "CASH" ? (
                    <input
                      value={editPaymentLabel}
                      onChange={(e) => setEditPaymentLabel(e.target.value)}
                      placeholder={
                        editPaymentType === "CARD"
                          ? "카드 이름(선택)"
                          : editPaymentType === "ACCOUNT"
                            ? "이체 메모(선택) 예: 토스/계좌"
                            : "기타 결제수단 이름(필수)"
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  ) : null}
                </label>

                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">결제처(선택)</div>
                  <input
                    value={editMerchant}
                    onChange={(e) => setEditMerchant(e.target.value)}
                    placeholder="예: CGV / 편의점 / 택시"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">세부내용(선택)</div>
                  <input
                    value={editDetail}
                    onChange={(e) => setEditDetail(e.target.value)}
                    placeholder="예: 팝콘, 콜라 / 영등포→서울역"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
              </div>
            </div>

            <button
              className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              disabled={updateExpense.isPending}
              onClick={async () => {
                const parsed = parseAmountInput(editAmount);
                  if (parsed == null) return;
                const mm = parseFlexibleTimeToMinutes(editTimeText);
                const em = parseFlexibleTimeToMinutes(editEndTimeText);
                if (mm == null || em == null) return;
                if (!(mm < em)) return;
                if (editPaymentType === "ETC" && !editPaymentLabel.trim()) return;
                const payerName =
                  editPayerPreset === "나"
                    ? "나"
                    : editPayerOther.trim()
                      ? editPayerOther.trim()
                      : "기타";
                const participants =
                  editExpenseScope === "SHARED"
                    ? Array.from(
                        new Set(
                          editSharedNamesText
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      )
                    : null;
                const participantsAll =
                  editExpenseScope === "SHARED" ? sharedParticipantsAll(payerName, participants) : null;
                const occurredAt = dateFromSlotMinutes(dayLocal00, mm).toISOString();
                const endAt = dateFromSlotMinutes(dayLocal00, em).toISOString();
                const cat = normalizeCategory(editCategory) || expenseEditOpen.category;
                const transitPayload = buildTransitPayload(cat, {
                  legs: transitLegs,
                  transit2: {
                    mode: exTransitMode,
                    start: editTimeText.trim(),
                    end: editTimeText.trim(),
                    fromText: exTransitFromText,
                    toText: exTransitToText
                  }
                });
                await updateExpense.mutateAsync({
                  id: expenseEditOpen.id,
                  input: {
                    occurredAt,
                    endAt,
                    amount: parsed,
                    category: cat,
                    paymentType: editPaymentType,
                    paymentMethodLabel:
                      editPaymentType === "CASH"
                        ? null
                        : editPaymentLabel.trim()
                          ? editPaymentLabel.trim()
                          : null,
                    paymentOwner: payerName,
                    scope: editExpenseScope,
                    participants: participantsAll,
                    merchant: editMerchant.trim() ? editMerchant.trim() : null,
                    detail: editDetail.trim() ? editDetail.trim() : null,
                    ...transitPayload
                  }
                });
                setExpenseEditOpen(null);
              }}
            >
              저장
            </button>
          </div>
        </div>
      ) : null}

      {/* Schedule detail sheet */}
      {scheduleDetailOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setScheduleDetailOpen(null)}
            aria-label="닫기"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-screen-sm max-h-[90dvh] flex-col rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{scheduleDetailOpen.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {timeRangeLabel(scheduleDetailOpen.startAt, scheduleDetailOpen.endAt)}
                </div>
              </div>
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
                onClick={() => setScheduleDetailOpen(null)}
              >
                닫기
              </button>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto overscroll-contain pb-4">
              {scheduleDetailOpen.note ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {scheduleDetailOpen.note}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  메모 없음
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-2 border-t border-slate-200 pt-3">
              <button
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm"
                onClick={() => {
                  setScheduleEditOpen(scheduleDetailOpen);
                  // 기본값 채우기 (시간은 HH:MM만)
                  const s = new Date(scheduleDetailOpen.startAt);
                  const e = new Date(scheduleDetailOpen.endAt);
                  setEditSchedStart(`${pad2(s.getHours())}:${pad2(s.getMinutes())}`);
                  setEditSchedEnd(`${pad2(e.getHours())}:${pad2(e.getMinutes())}`);
                  const parsed = parseEmojiPrefixedTitle(scheduleDetailOpen.title);
                  setEditSchedCategory(parsed.category);
                  setEditSchedTitle(parsed.content);
                  setEditSchedNote(scheduleDetailOpen.note ?? "");
                  setEditSchedAmount("");
                  setEditSchedPaymentType("CARD");
                  setEditSchedPaymentLabel("");
                  setEditSchedPayerPreset("나");
                  setEditSchedPayerOther("");
                  setEditSchedExpenseScope("PERSONAL");
                  setEditSchedSharedNamesText("");
                  setScheduleDetailOpen(null);
                }}
              >
                수정
              </button>
              <button
                className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm"
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
          </div>
        </div>
      ) : null}

      {/* Schedule edit full screen */}
      {scheduleEditOpen ? (
        <div className="fixed inset-0 z-[55]">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setScheduleEditOpen(null)}
            aria-label="닫기"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-sm rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">기록 수정</div>
                <div className="mt-1 text-xs text-slate-500">{scheduleEditOpen.id}</div>
              </div>
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
                onClick={() => setScheduleEditOpen(null)}
              >
                닫기
              </button>
            </div>

            <div className="mt-3 max-h-[70dvh] overflow-auto">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <div className="mb-1 text-xs text-slate-400">
                    {editSchedCategory === "교통1" || editSchedCategory === "교통2" ? "출발시간" : "시작"}
                  </div>
                  <input
                    value={editSchedStart}
                    onChange={(e) => setEditSchedStart(e.target.value)}
                    placeholder="예: 09:00 (05:00~28:30)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-slate-400">
                    {editSchedCategory === "교통1" || editSchedCategory === "교통2" ? "도착시간" : "끝"}
                  </div>
                  <input
                    value={editSchedEnd}
                    onChange={(e) => setEditSchedEnd(e.target.value)}
                    placeholder="예: 09:30 (05:00~28:30)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">카테고리</div>
                  <select
                    value={editSchedCategory}
                    onChange={(e) => setEditSchedCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    {CATEGORY_GROUPS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.items.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                {editSchedCategory === "교통1" ? (
                  <Transit1Fields
                    legs={transitLegs as any}
                    setLegs={setTransitLegs as any}
                    requestConfirm={requestConfirm}
                    openStationSearch={(legIndex, field) => {
                      setStationQuery("");
                      setStationSearchOpen({ legIndex, field });
                    }}
                  />
                ) : null}

                {editSchedCategory === "교통2" ? (
                  <Transit2Fields
                    mode={exTransitMode}
                    setMode={setExTransitMode}
                    fromText={exTransitFromText}
                    setFromText={setExTransitFromText}
                    toText={exTransitToText}
                    setToText={setExTransitToText}
                  />
                ) : null}

                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">내용</div>
                  <input
                    value={editSchedTitle}
                    onChange={(e) => setEditSchedTitle(e.target.value)}
                    placeholder="예: 교통 이동시간 / 영화 / 헬스 / 오늘 뭐했는지"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">메모(선택)</div>
                  <input
                    value={editSchedNote}
                    onChange={(e) => setEditSchedNote(e.target.value)}
                    placeholder="선택"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>

                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">금액(없으면 비워도 됨)</div>
                  <input
                    inputMode="numeric"
                    value={editSchedAmount}
                    onChange={(e) => setEditSchedAmount(e.target.value)}
                    placeholder="예: 12000"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-slate-400"
                  />
                </label>

                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <label className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-500">결제자</div>
                    <div className="flex gap-2">
                      {(["나", "기타"] as const).map((p) => (
                        <button
                          key={p}
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                            editSchedPayerPreset === p
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 bg-white text-slate-800"
                          )}
                          onClick={() => setEditSchedPayerPreset(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    {editSchedPayerPreset === "기타" ? (
                      <input
                        value={editSchedPayerOther}
                        onChange={(e) => setEditSchedPayerOther(e.target.value)}
                        placeholder="결제자 이름"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      />
                    ) : null}
                  </label>

                  <label className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-500">지출 유형</div>
                    <div className="flex gap-2">
                      {[
                        { key: "PERSONAL" as const, label: "개인" },
                        { key: "SHARED" as const, label: "공동" }
                      ].map((t) => (
                        <button
                          key={t.key}
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                            editSchedExpenseScope === t.key
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 bg-white text-slate-800"
                          )}
                          onClick={() => setEditSchedExpenseScope(t.key)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {editSchedExpenseScope === "SHARED" ? (
                      <input
                        value={editSchedSharedNamesText}
                        onChange={(e) => setEditSchedSharedNamesText(e.target.value)}
                        placeholder="함께한 사람 (쉼표로 구분) 예: 나,철수,영희"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      />
                    ) : null}
                  </label>
                </div>

                <label className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-500">결제수단</div>
                  <div className="flex gap-2">
                    {PAYMENT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        className={cn(
                          "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                          editSchedPaymentType === opt.key
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-white text-slate-800"
                        )}
                        onClick={() => {
                          setEditSchedPaymentType(opt.key);
                          if (opt.key === "CASH") setEditSchedPaymentLabel("");
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {editSchedPaymentType !== "CASH" ? (
                    <input
                      value={editSchedPaymentLabel}
                      onChange={(e) => setEditSchedPaymentLabel(e.target.value)}
                      placeholder={
                        editSchedPaymentType === "CARD"
                          ? "카드 이름(선택)"
                          : editSchedPaymentType === "ACCOUNT"
                            ? "이체 메모(선택) 예: 토스/계좌"
                            : "기타 결제수단 이름(필수)"
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  ) : null}
                </label>
              </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm disabled:opacity-50"
                disabled={deleteSchedule.isPending}
                onClick={() => {
                  const id = scheduleEditOpen.id;
                  requestConfirm("기록이 사라집니다. 삭제하시겠습니까?", async () => {
                    await deleteSchedule.mutateAsync(id);
                    setScheduleEditOpen(null);
                  });
                }}
              >
                삭제
              </button>
              <button
                className="flex-[2] rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                disabled={updateSchedule.isPending}
                onClick={async () => {
                  const sMin = parseFlexibleTimeToMinutes(editSchedStart);
                  const eMin = parseFlexibleTimeToMinutes(editSchedEnd);
                  if (sMin == null || eMin == null) return;
                  if (!(sMin < eMin)) return;
                  const title = editSchedTitle.trim();
                  if (!title) return;
                  const cat = editSchedCategory.trim() || "기타";
                  const amount = parseAmountInput(editSchedAmount);
                  if (amount == null) return;
                  if (editSchedPaymentType === "ETC" && !editSchedPaymentLabel.trim()) return;

                  // Convert schedule -> expense (amount may be 0)
                  const occurredAt = dateFromSlotMinutes(dayLocal00, sMin).toISOString();
                  const payerName =
                    editSchedPayerPreset === "나"
                      ? "나"
                      : editSchedPayerOther.trim()
                        ? editSchedPayerOther.trim()
                        : "기타";
                  const participants =
                    editSchedExpenseScope === "SHARED"
                      ? Array.from(
                          new Set(
                            editSchedSharedNamesText
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          )
                        )
                      : null;
                  const participantsAll =
                    editSchedExpenseScope === "SHARED"
                      ? sharedParticipantsAll(payerName, participants)
                      : null;

                  await createExpense.mutateAsync({
                    occurredAt,
                    amount,
                    category: cat,
                    merchant: title,
                    detail: null,
                    memo: editSchedNote.trim() ? editSchedNote.trim() : null,
                    paymentType: editSchedPaymentType,
                    paymentOwner: payerName,
                    paymentMethodLabel:
                      editSchedPaymentType === "CASH"
                        ? null
                        : editSchedPaymentLabel.trim()
                          ? editSchedPaymentLabel.trim()
                          : null,
                    installment: false,
                    installmentMonths: null,
                    scope: editSchedExpenseScope,
                    participants: participantsAll,
                    transitFrom: null,
                    transitTo: null,
                    transitVia: null,
                    transitLine: null,
                    transitMode: null,
                    transitBusNumber: null,
                    transitSegments: null
                  });
                  await deleteSchedule.mutateAsync(scheduleEditOpen.id);
                  setScheduleEditOpen(null);
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm dialog */}
      {confirmOpen ? (
        <div className="fixed inset-0 z-[80]">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfirmOpen(null)}
            aria-label="닫기"
          />
          <div className="absolute inset-x-0 top-1/2 mx-auto w-full max-w-screen-sm -translate-y-1/2 px-4">
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
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-sm rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl">
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

      {/* Calendar popover rendered in header */}
    </div>
  );
}

