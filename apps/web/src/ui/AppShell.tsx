import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
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
  useMonthSchedules,
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
import BottomNav from "../components/BottomNav";
import ComposeSheet from "../components/ComposeSheet";
import DateMonthInput from "../components/DateMonthInput";
import ExpenseCard from "../components/ExpenseCard";
import SettlementRow from "../components/SettlementRow";
import { useLocalStorageState } from "../hooks/useLocalStorageState";
import { useExpenseComposeForm } from "../hooks/useExpenseComposeForm";
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
import { encodeScheduleNote, parseScheduleNote } from "../domain/scheduleNote";
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
  participantsDisplayWithoutMe,
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
import {
  AGGREGATE_MODE_LS_KEY,
  expenseCashflowAllocations,
  spendByDayForCalendar,
  sumExpensesForMonth,
  sumExpensesForMonthToDate,
  type AggregateMode
} from "../domain/installment";
import { MonthDetailView } from "../pages/MonthDetailView";
import { TodayDetailView } from "../pages/TodayDetailView";

type Tint = { bg: string; border: string; text: string };

function formatAmountInputWithCommas(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const digits = trimmed.replaceAll(",", "").replaceAll(" ", "").replace(/[^\d]/g, "");
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return Math.trunc(n).toLocaleString();
}

function stripTransitRoutePrefix(detail: string, transitFrom: string | null, transitTo: string | null) {
  const d = (detail ?? "").trim();
  if (!d) return detail;
  const from = (transitFrom ?? "").trim();
  const to = (transitTo ?? "").trim();
  const route = from && to ? `${from} → ${to}` : "";
  if (!route) return detail;
  const prefix1 = `${route} · `;
  const prefix2 = `${route}·`;
  if (d.startsWith(prefix1)) return d.slice(prefix1.length);
  if (d.startsWith(prefix2)) return d.slice(prefix2.length);
  return detail;
}

function isUsageDayDifferent(e: Expense, currentDayKey: string) {
  if (!e.plannedAt) return false;
  const plannedDay = yyyyMmDdLocal(new Date(e.plannedAt));
  return plannedDay !== currentDayKey;
}

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
  if (["식사", "간식"].includes(category)) return "food";
  if (["담배", "구독"].includes(category)) return "optionalFixed";
  if (["생활", "병원", "선물"].includes(category)) return "living";
  return "other";
}

function tintForCategory(category: string): Tint {
  const c = normalizeCategory(category);
  return CATEGORY_TINT_OVERRIDE[c] ?? GROUP_TINT[groupForCategory(c)];
}

/** 타임라인 카드 왼쪽과 동일 — 배경·테두리·이모지 */
function CategoryCardPreview({ category }: { category: string }) {
  const c = normalizeCategory(category);
  const tint = tintForCategory(c);
  return (
    <div
      className={cn(
        "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl",
        tint.border,
        tint.bg
      )}
      aria-hidden
    >
      {emojiForCategory(c)}
    </div>
  );
}

/** 네이티브 select 화살표는 오른쪽에 붙어 보이므로 제거 후 여백 있는 커스텀 화살표 사용 */
const CATEGORY_SELECT_CLASS =
  "min-w-0 flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white py-3 pl-3 pr-12 text-sm outline-none focus:border-slate-400 [appearance:none] [-webkit-appearance:none] [-moz-appearance:none]";
const CATEGORY_SELECT_ARROW_STYLE: CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.875rem center",
  backgroundSize: "1.125rem 1.125rem"
};

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

function monthIndexDiff(fromMonthKey: string, toMonthKey: string) {
  // YYYY-MM
  const fy = Number(fromMonthKey.slice(0, 4));
  const fm = Number(fromMonthKey.slice(5, 7));
  const ty = Number(toMonthKey.slice(0, 4));
  const tm = Number(toMonthKey.slice(5, 7));
  if (!Number.isFinite(fy) || !Number.isFinite(fm) || !Number.isFinite(ty) || !Number.isFinite(tm)) return 0;
  return (ty - fy) * 12 + (tm - fm);
}


function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const INSTALLMENT_MONTH_OPTIONS = Array.from({ length: 35 }, (_, i) => i + 2);

function installmentPayload(
  paymentType: Expense["paymentType"],
  useInstallment: boolean,
  months: number,
  noInterest: boolean
): {
  installment: boolean;
  installmentMonths: number | null;
  installmentNoInterest: boolean;
} {
  if (paymentType !== "CARD" || !useInstallment) {
    return { installment: false, installmentMonths: null, installmentNoInterest: false };
  }
  const m = Math.round(months);
  if (!Number.isFinite(m) || m < 2 || m > 36) {
    return { installment: false, installmentMonths: null, installmentNoInterest: false };
  }
  return {
    installment: true,
    installmentMonths: m,
    installmentNoInterest: noInterest
  };
}

function CardInstallmentFields(props: {
  installment: boolean;
  setInstallment: (_v: boolean) => void;
  months: number;
  setMonths: (_n: number) => void;
  noInterest: boolean;
  setNoInterest: (_v: boolean) => void;
}) {
  return (
    <div className="mt-2">
      <div className="mb-1 text-xs text-slate-400">카드 결제 방식</div>
      <div className="flex gap-2">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
            !props.installment
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-slate-200 bg-white text-slate-800"
          )}
          onClick={() => {
            props.setInstallment(false);
            props.setNoInterest(false);
          }}
        >
          일시불
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
            props.installment
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-slate-200 bg-white text-slate-800"
          )}
          onClick={() => props.setInstallment(true)}
        >
          할부
        </button>
      </div>
      {props.installment ? (
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
          <label className="min-w-[8rem] flex-1">
            <div className="mb-1 text-xs text-slate-400">할부 개월 수</div>
            <select
              value={props.months}
              onChange={(e) => props.setMonths(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-3 text-sm outline-none focus:border-slate-400"
            >
              {INSTALLMENT_MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}개월
                </option>
              ))}
            </select>
          </label>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 pb-2.5">
            <input
              type="checkbox"
              checked={props.noInterest}
              onChange={(e) => props.setNoInterest(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-800">무이자</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

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

function ScheduleDetailNoteBlock(props: { scheduleId: string; note: string | null }) {
  const n = parseScheduleNote(props.note);
  if (!n.people.length && !n.memo) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        메모 없음
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {n.people.length ? (
        <div className="flex min-w-0 items-start gap-2 text-sm font-medium text-slate-700">
          <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0 break-words">{n.people.join(", ")}</span>
        </div>
      ) : null}
      {n.memo ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{n.memo}</div>
      ) : null}
    </div>
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
   
  openStationSearch: (_legIndex: number, _field: "from" | "to") => void;
   
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

function AggregateModeToggle({
  mode,
  onChange,
  size = "sm"
}: {
  mode: AggregateMode;
   
  onChange: (_next: AggregateMode) => void;
  size?: "sm" | "xs";
}) {
  const padding = size === "xs" ? "px-2 py-0.5" : "px-2.5 py-1";
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";
  return (
    <div
      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5"
      role="tablist"
      aria-label="합계 기준"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "usage"}
        className={cn(
          "rounded-full font-semibold tabular-nums tracking-tight transition",
          padding,
          text,
          mode === "usage"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
        onClick={() => onChange("usage")}
      >
        사용액
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "cashflow"}
        className={cn(
          "rounded-full font-semibold tabular-nums tracking-tight transition",
          padding,
          text,
          mode === "cashflow"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
        onClick={() => onChange("cashflow")}
      >
        실출금
      </button>
    </div>
  );
}

function formatCalendarWon(n: number) {
  const v = Math.round(Number(n) || 0);
  if (!Number.isFinite(v) || v === 0) return "";
  const abs = Math.abs(v);
  // Compact for narrow calendar cells
  if (abs >= 1_000_000) {
    const x = Math.round((v / 10_000) * 10) / 10; // 만원 단위, 소수 1자리
    return `${x}만`;
  }
  if (abs >= 100_000) {
    const x = Math.round((v / 10_000) * 10) / 10; // 54.8만
    return `${x}만`;
  }
  return v.toLocaleString();
}

type Transit2SegmentDraft = {
  dayKey: string; // YYYY-MM-DD (usage day)
  start: string; // HH:mm
  end: string; // HH:mm (optional)
  fromText: string;
  toText: string;
  mode: string; // 🚆🚍🚖✈️
  memoText: string;
};

function Transit2Fields({
  segments,
  setSegments
}: {
  segments: Transit2SegmentDraft[];
  setSegments: (_next: Transit2SegmentDraft[]) => void;
}) {
  return (
    <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-600">교통2 (기차/시외버스/택시/비행기)</div>
      <div className="mt-3 space-y-3">
        {segments.map((seg, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-600">구간 {idx + 1}</div>
              {segments.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-700"
                  onClick={() => setSegments(segments.filter((_, i) => i !== idx))}
                >
                  삭제
                </button>
              ) : null}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="col-span-2">
                <div className="mb-1 text-xs text-slate-500">사용일</div>
                <input
                  type="date"
                  value={seg.dayKey}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, dayKey: v } : s)));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label>
                <div className="mb-1 text-xs text-slate-500">출발시간</div>
                <input
                  value={seg.start}
                  onChange={(e) =>
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, start: e.target.value } : s)))
                  }
                  placeholder="예: 15:00"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label>
                <div className="mb-1 text-xs text-slate-500">도착시간</div>
                <input
                  value={seg.end}
                  onChange={(e) =>
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, end: e.target.value } : s)))
                  }
                  placeholder="선택"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label>
                <div className="mb-1 text-xs text-slate-500">출발지</div>
                <input
                  value={seg.fromText}
                  onChange={(e) =>
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, fromText: e.target.value } : s)))
                  }
                  placeholder="예: 김포"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label>
                <div className="mb-1 text-xs text-slate-500">도착지</div>
                <input
                  value={seg.toText}
                  onChange={(e) =>
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, toText: e.target.value } : s)))
                  }
                  placeholder="예: 도쿄(하네다)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="col-span-2">
                <div className="mb-1 text-xs text-slate-500">메모(선택)</div>
                <input
                  value={seg.memoText}
                  onChange={(e) =>
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, memoText: e.target.value } : s)))
                  }
                  placeholder="예: 항공편 / 좌석 / 수하물"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="mt-2">
              <div className="mb-1 text-xs text-slate-500">수단</div>
              <div className="flex gap-2">
                {["🚆", "🚍", "🚖", "✈️"].map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={`h-11 w-11 rounded-xl border text-xl ${
                      seg.mode === m
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-900"
                    }`}
                    onClick={() => setSegments(segments.map((s, i) => (i === idx ? { ...s, mode: m } : s)))}
                    aria-label={`교통수단 ${m}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm"
          onClick={() => {
            const baseDay = segments[segments.length - 1]?.dayKey ?? yyyyMmDdLocal(new Date());
            setSegments([
              ...segments,
              { dayKey: baseDay, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }
            ]);
          }}
        >
          + 구간 추가(출국/입국)
        </button>
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
      endAt: string | null;
      title: string;
      note: string | null;
      linkedExpenseSum: number;
    }
  | {
      kind: "expense";
      startMs: number;
      expense: Expense;
    }
  | {
      kind: "usage-expense";
      startMs: number;
      expense: Expense;
      label: string;
      startText: string;
      endText: string;
      usageMemo: string;
    };

/** 일정 시작~끝 구간 안에 occurredAt이 들어오는 지출 (일정+비용 동시 기록 등). 끝 시간 없으면 해당 날 23:59:59까지. */
function expensesOccurringWithinSchedule(expenses: Expense[], schedule: ScheduleItem): Expense[] {
  const s0 = new Date(schedule.startAt).getTime();
  if (!Number.isFinite(s0)) return [];
  let s1: number;
  if (schedule.endAt) {
    s1 = new Date(schedule.endAt).getTime();
  } else {
    const dayEnd = new Date(schedule.startAt);
    dayEnd.setHours(23, 59, 59, 999);
    s1 = dayEnd.getTime();
  }
  if (!Number.isFinite(s1) || s0 > s1) return [];
  return expenses.filter((e) => {
    const t = new Date(e.occurredAt).getTime();
    return Number.isFinite(t) && t >= s0 && t <= s1;
  });
}

function parseMainDayQuery(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function App({ view }: { view: "main" | "today" | "month" | "calendar" }) {
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

  const [expenseDetailOpen, setExpenseDetailOpen] = useState<Expense | null>(null);
  const [scheduleDetailOpen, setScheduleDetailOpen] = useState<ScheduleItem | null>(null);
  const [scheduleDetailTab, setScheduleDetailTab] = useState<"schedule" | "expense">("schedule");

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
    setExTransitMode("🚆");
    setExTransitFromText("");
    setExTransitToText("");
    setTransit2SegmentsDraft([{ dayKey, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }]);
    resetComposeForm();
  }, [resetComposeForm, dayKey]);
  // 교통2 (기차/시외/택시/비행기) - 단일 구간
  const [exTransitMode, setExTransitMode] = useState<string>("🚆"); // 교통2: 🚆🚍🚖✈️
  const [exTransitFromText, setExTransitFromText] = useState<string>("");
  const [exTransitToText, setExTransitToText] = useState<string>("");
  const [transit2SegmentsDraft, setTransit2SegmentsDraft] = useState<Transit2SegmentDraft[]>(() => [
    { dayKey, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }
  ]);

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

  function fillComposeFromExpense(e: Expense) {
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
    const rawDetail = base.detail?.trim() ?? "";
    if (rawDetail.includes(" · ")) {
      const idx = rawDetail.indexOf(" · ");
      setEntryTitle(rawDetail.slice(0, idx));
      setExDetail(rawDetail.slice(idx + 3));
    } else {
      setEntryTitle("");
      setExDetail(rawDetail);
    }
    setExMerchant(base.merchant ?? "");
    setEntryNote(base.memo ?? "");
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
    setSharedNamesText(
      Array.isArray(base.participants) ? (base.participants as unknown[]).map(String).join(", ") : ""
    );

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
          const mapped = seg
            .map((s) => {
              if (!s || typeof s !== "object") return null;
              const anyS: Record<string, unknown> = s as Record<string, unknown>;
              if (anyS.mode === "BUS") {
                return {
                  mode: "BUS" as const,
                  start: String(anyS.start ?? "09:00"),
                  end: String(anyS.end ?? "09:30"),
                  busNumber: String(anyS.busNumber ?? ""),
                  from: String(anyS.from ?? ""),
                  to: String(anyS.to ?? "")
                };
              }
              if (anyS.mode === "SUBWAY") {
                return {
                  mode: "SUBWAY" as const,
                  start: String(anyS.start ?? "09:00"),
                  end: String(anyS.end ?? "09:30"),
                  from: null,
                  to: null,
                  line: String(anyS.line ?? "")
                };
              }
              return null;
            })
            .filter(Boolean) as TransitLeg[];
          return mapped.length
            ? mapped
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
      } else {
        setTransitLegs([
          { mode: "SUBWAY", start: "09:00", end: "09:30", from: null, to: null, line: "" }
        ]);
      }
    } else {
      setTransitLegs([
        { mode: "SUBWAY", start: "09:00", end: "09:30", from: null, to: null, line: "" }
      ]);
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

  function fillComposeFromSchedule(full: ScheduleItem, linked: Expense[]) {
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
    setEntryStartText(startHhMm);
    setEntryEndText(endHhMm);
    const parsed = parseEmojiPrefixedTitle(full.title);
    setEntryCategory(parsed.category);
    setEntryTitle(parsed.content);
    const np = parseScheduleNote(full.note);
    setSchedulePeopleText(np.people.join(", "));
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

    setExAmount("");
    setExMerchant("");
    setExDetail("");
    setExPaymentType("CARD");
    setExPaymentLabel("");
    setPayerPreset("나");
    setPayerOther("");
    setExpenseScope("PERSONAL");
    setSharedNamesText("");
    setExInstallment(false);
    setExInstallmentMonths(2);
    setExInstallmentNoInterest(false);

    if (parsed.category === "교통1") {
      const trEx = linked.find((x) => normalizeCategory(x.category) === "교통1");
      const seg = trEx?.transitSegments;
      if (Array.isArray(seg) && seg.length) {
        setTransitLegs(() => {
          const mapped = seg
            .map((el) => {
              if (!el || typeof el !== "object") return null;
              const anyS: Record<string, unknown> = el as Record<string, unknown>;
              if (anyS.mode === "BUS") {
                return {
                  mode: "BUS" as const,
                  start: String(anyS.start ?? "09:00"),
                  end: String(anyS.end ?? "09:30"),
                  busNumber: String(anyS.busNumber ?? ""),
                  from: String(anyS.from ?? ""),
                  to: String(anyS.to ?? "")
                };
              }
              if (anyS.mode === "SUBWAY") {
                return {
                  mode: "SUBWAY" as const,
                  start: String(anyS.start ?? "09:00"),
                  end: String(anyS.end ?? "09:30"),
                  from: null,
                  to: null,
                  line: String(anyS.line ?? "")
                };
              }
              return null;
            })
            .filter(Boolean) as TransitLeg[];
          return mapped.length
            ? mapped
            : [
                {
                  mode: "SUBWAY" as const,
                  start: startHhMm,
                  end: endHhMm || startHhMm,
                  from: null,
                  to: null,
                  line: ""
                }
              ];
        });
      } else {
        setTransitLegs([
          {
            mode: "SUBWAY",
            start: startHhMm,
            end: endHhMm || startHhMm,
            from: null,
            to: null,
            line: ""
          }
        ]);
      }
    } else {
      setTransitLegs([
        { mode: "SUBWAY", start: "09:00", end: "09:30", from: null, to: null, line: "" }
      ]);
    }
    if (parsed.category === "교통2") {
      const tr2 = linked.find((x) => normalizeCategory(x.category) === "교통2");
      if (tr2) {
        setExTransitMode(tr2.transitMode ?? "🚆");
        setExTransitFromText(tr2.transitFrom ?? "");
        setExTransitToText(tr2.transitTo ?? "");
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
        } else {
          setExTransitMode("🚆");
          setExTransitFromText("");
          setExTransitToText("");
        }
      }
    } else {
      setExTransitMode("🚆");
      setExTransitFromText("");
      setExTransitToText("");
    }
  }

  const scheduleDetailLinkedExpenses = useMemo(() => {
    if (!scheduleDetailOpen) return [];
    return expensesOccurringWithinSchedule(expensesData?.items ?? [], scheduleDetailOpen);
  }, [scheduleDetailOpen, expensesData?.items]);

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
      showDetailClose={todayExpenseDetailOpen || monthExpenseDetailOpen || calendarOpen}
      onDetailClose={() => navigate("/", { replace: false })}
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

    const spendByDay = spendByDayForCalendar(aggregateMode, expensesAll, monthKey);
    const calendarMonthTotal = sumExpensesForMonth(aggregateMode, expensesAll, monthKey);

    const schedulesByDay = new Map<string, ScheduleItem[]>();
    for (const s of monthSchedules) {
      const day = yyyyMmDdLocal(new Date(s.startAt));
      const arr = schedulesByDay.get(day) ?? [];
      arr.push(s);
      schedulesByDay.set(day, arr);
    }
    for (const [k, arr] of schedulesByDay.entries()) {
      arr.sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
      schedulesByDay.set(k, arr);
    }

    const first = new Date(`${monthKey}-01T00:00:00`);
    const firstDow = first.getDay(); // 0..6
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: firstDow + lastDay }, (_, i) => {
      if (i < firstDow) return null;
      return i - firstDow + 1;
    });

    const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
    const tempHolidaySet = (() => {
      // 임시 공휴일(또는 추가 공휴일)을 로컬에서 지정할 수 있게: localStorage["tempHolidays"] = ["YYYY-MM-DD", ...]
      try {
        const raw = window.localStorage.getItem("tempHolidays");
        if (!raw) return new Set<string>();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set<string>();
        const list = parsed.map((x) => String(x)).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
        return new Set(list);
      } catch {
        return new Set<string>();
      }
    })();

    const isFixedKrHoliday = (ymd: string) => {
      // 양력 고정 공휴일만(설/추석 등 음력은 제외)
      const mmdd = ymd.slice(5);
      const year = Number(ymd.slice(0, 4));
      return (
        mmdd === "01-01" || // 신정
        mmdd === "03-01" || // 삼일절
        (year >= 2026 && mmdd === "05-01") || // 근로자의날(요청: 올해부터 공휴일 취급)
        (year >= 2026 && mmdd === "07-17") || // (요청) 2026년부터 공휴일 취급
        (year >= 2026 && mmdd === "05-25") || // (요청) 대체 공휴일
        mmdd === "05-05" || // 어린이날
        mmdd === "06-06" || // 현충일
        mmdd === "08-15" || // 광복절
        mmdd === "10-03" || // 개천절
        mmdd === "10-09" || // 한글날
        mmdd === "12-25" // 성탄절
      );
    };

    return (
      <div className="min-h-dvh bg-white pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
        {headerEl}
        <main>
          <div className="mx-auto w-full max-w-md px-4 py-4">
            <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">달력</div>
                  <AggregateModeToggle mode={aggregateMode} onChange={setAggregateMode} />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-[11px] font-semibold text-slate-500">
                    {aggregateMode === "cashflow" ? "이번달 실출금" : "이번달 사용액"}
                  </div>
                  <div className="text-sm font-extrabold tabular-nums text-slate-900">
                    {Math.round(calendarMonthTotal).toLocaleString()}
                    <span className="ml-0.5 text-[11px] font-semibold text-slate-400">원</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-2 text-[11px] font-semibold text-slate-400">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="text-center">
                      {w}
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2">
                  {cells.map((dayNum, idx) => {
                    if (!dayNum) return <div key={`e-${idx}`} className="h-[92px]" />;
                    const dayKeyCell = `${monthKey}-${String(dayNum).padStart(2, "0")}`;
                    const dow = new Date(`${dayKeyCell}T00:00:00`).getDay(); // 0..6
                    const isHoliday = isFixedKrHoliday(dayKeyCell) || tempHolidaySet.has(dayKeyCell);
                    const isSun = dow === 0;
                    const isSat = dow === 6;
                    const dayTone = isSun || isHoliday ? "text-rose-600" : isSat ? "text-indigo-600" : "text-slate-900";
                    const spend = spendByDay.get(dayKeyCell) ?? 0;
                    const sched = schedulesByDay.get(dayKeyCell) ?? [];
                    const titles = sched.map((s) => {
                      const parsed = parseEmojiPrefixedTitle(s.title);
                      // 달력에는 "일정에 적힌 금액" 노출하지 않기 (예: "점심 12,000원" → "점심")
                      const raw = (parsed.content || s.title || "").trim();
                      return raw.replace(/\s*\(?\d{1,3}(?:,\d{3})*(?:원|₩)\)?\s*$/g, "").trim() || raw;
                    });
                    const maxShow = 3;
                    const shown = titles.slice(0, maxShow);
                    const rest = titles.length - shown.length;
                    return (
                      <button
                        key={dayKeyCell}
                        type="button"
                        className="relative h-[92px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-sm hover:brightness-[0.99]"
                        onClick={() => navigate(`/today/${dayKeyCell}`)}
                        title={dayKeyCell}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className={cn("text-xs font-extrabold tabular-nums", dayTone)}>{dayNum}</div>
                          {spend ? (
                            <div className="min-w-0 text-right text-[10px] font-semibold tabular-nums tracking-tight text-slate-600 whitespace-nowrap">
                              {formatCalendarWon(spend)}
                            </div>
                          ) : (
                            <div className="min-w-0" />
                          )}
                        </div>
                        <div className="mt-2 space-y-0.5">
                          {shown.map((t, i) => (
                            <div key={i} className="truncate text-[11px] font-semibold text-slate-500">
                              {t}
                            </div>
                          ))}
                          {rest > 0 ? (
                            <div className="text-[11px] font-semibold text-slate-400">+{rest}</div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </main>
        <BottomNav />
      </div>
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
          modeToggle={
            <AggregateModeToggle mode={aggregateMode} onChange={setAggregateMode} size="xs" />
          }
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

  type ComposeSubmitArgs = {
    category: string;
    title: string;
    startMin: number;
    convertFromExpenseId: string | null;
    convertFromScheduleId: string | null;
  };

  /** datetime-local 입력값을 ISO 문자열로 변환. 토글 OFF거나 빈 값이면 null. */
  function buildPlannedAtIso(): string | null {
    if (!plannedAtEnabled) return null;
    const trimmed = plannedAtLocal.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

    async function submitEditSchedule(args: ComposeSubmitArgs) {
    if (!composeEditScheduleId) return;
    const { category, title, startMin } = args;
    const eMin = entryEndText.trim() ? parseFlexibleTimeToMinutes(entryEndText) : null;
    if (eMin != null && !(startMin < eMin)) {
      window.alert("끝 시간은 시작보다 늦아야 해.");
      return;
    }
    const catNorm = normalizeCategory(category);
    const startAt = dateFromSlotMinutes(composeDayLocal00, startMin).toISOString();
    const endAt =
      eMin != null ? dateFromSlotMinutes(composeDayLocal00, eMin).toISOString() : null;
    const scheduleTitle = `${emojiForCategory(catNorm)} ${title}`.trim();
    const transitMemo =
      catNorm === "교통2"
        ? (() => {
            const from = exTransitFromText.trim();
            const to = exTransitToText.trim();
            if (!from && !to) return "";
            return `${exTransitMode} ${from || "?"} → ${to || "?"}`.trim();
          })()
        : "";
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
    const baseNote = stripTransit2Line(entryNote.trim() ? entryNote.trim() : "");
    const mergedNote = baseNote + (transitMemo ? (baseNote ? "\n" : "") + transitMemo : "");
    const note = encodeScheduleNote(schedulePeopleText, mergedNote);
    try {
      await updateSchedule.mutateAsync({
        id: composeEditScheduleId,
        input: {
          startAt,
          endAt,
          title: scheduleTitle,
          note,
          showOnCalendar: scheduleShowOnCalendar
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`저장에 실패했어요.\n${msg}`);
      return;
    }

    // 일정 수정에서도 "비용도 함께 기록"을 켜면 지출을 생성
    // (일정-지출 연결은 occurredAt 기준 자동 연결 로직을 사용)
    if (scheduleWithExpense) {
      const amount = parseAmountInput(exAmount);
      if (amount == null) {
        window.alert("금액은 숫자로 입력해줘. (예: 12000 또는 12,000)");
        return;
      }
      const payMinRaw = schedulePayTimeText.trim()
        ? parseFlexibleTimeToMinutes(schedulePayTimeText)
        : startMin;
      if (payMinRaw == null) {
        window.alert("결제 시각을 확인해줘.");
        return;
      }
      const occurredAt = dateFromSlotMinutes(composeDayLocal00, payMinRaw).toISOString();

      const transitPayload = buildTransitPayload(catNorm, {
        legs: transitLegs,
        transit2: {
          mode: exTransitMode,
          start: entryStartText.trim(),
          end: entryEndText.trim(),
          fromText: exTransitFromText,
          toText: exTransitToText
        }
      });
      const transit2SegmentsPayload =
        catNorm === "교통2"
          ? transit2SegmentsDraft.map((s) => ({
              kind: "TRANSIT2",
              dayKey: s.dayKey,
              start: s.start,
              end: s.end,
              from: s.fromText,
              to: s.toText,
              mode: s.mode,
              memo: s.memoText?.trim() ? s.memoText.trim() : null
            }))
          : null;

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

      const merchantTrim = exMerchant.trim();
      const merchantFinal = merchantTrim || title;

      try {
        await createExpense.mutateAsync({
          occurredAt,
          endAt,
          amount,
          category: catNorm,
          merchant: merchantFinal,
          detail: exDetail.trim() ? exDetail.trim() : null,
          memo: entryNote.trim() ? entryNote.trim() : null,
          paymentType: exPaymentType,
          paymentOwner: payerName,
          paymentMethodLabel:
            exPaymentType === "CASH" ? null : exPaymentLabel.trim() ? exPaymentLabel.trim() : null,
          ...installmentPayload(
            exPaymentType,
            exInstallment,
            exInstallmentMonths,
            exInstallmentNoInterest
          ),
          scope: expenseScope,
          participants: participantsAll,
          plannedAt: buildPlannedAtIso(),
          ...transitPayload,
          ...(catNorm === "교통2"
            ? {
                transitMode: transit2SegmentsDraft[0]?.mode ?? exTransitMode,
                transitFrom: transit2SegmentsDraft[0]?.fromText ?? exTransitFromText,
                transitTo: transit2SegmentsDraft[0]?.toText ?? exTransitToText,
                transitSegments: transit2SegmentsPayload
              }
            : {})
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        window.alert(`지출 저장에 실패했어요.\n${msg}`);
        return;
      }
    }

    handleComposeClose();
  }

  async function submitEditExpense(args: ComposeSubmitArgs) {
    if (!composeEditExpenseId) return;
    const { category, title, startMin } = args;
    const transit = isTransitCategory;
    if (exPaymentType === "ETC" && !exPaymentLabel.trim()) {
      window.alert("기타 결제수단 이름을 입력해줘.");
      return;
    }
    const merchantTrim = exMerchant.trim();
    if (!transit && !merchantTrim) {
      window.alert("결제처를 입력해줘.");
      return;
    }
    const parsedAmount = parseAmountInput(exAmount);
    if (parsedAmount == null) {
      window.alert("금액은 숫자로 입력해줘. (예: 12000 또는 12,000)");
      return;
    }
    const endMinParsed = entryEndText.trim()
      ? parseFlexibleTimeToMinutes(entryEndText)
      : null;
    if (endMinParsed != null && !(startMin < endMinParsed)) {
      window.alert("끝 시간은 시작보다 늦아야 해.");
      return;
    }
    const endMin = endMinParsed;
    const occurredAt = dateFromSlotMinutes(composeDayLocal00, startMin).toISOString();
    const endAt =
      endMin != null ? dateFromSlotMinutes(composeDayLocal00, endMin).toISOString() : null;
    const catNorm = normalizeCategory(category);
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
    const detailCombined =
      [title, exDetail.trim()].filter(Boolean).join(" · ") || null;
    const transitPayload = buildTransitPayload(catNorm, {
      legs: transitLegs,
      transit2: {
        mode: exTransitMode,
        start: entryStartText.trim(),
        end: entryEndText.trim(),
        fromText: exTransitFromText,
        toText: exTransitToText
      }
    });
    const transit2SegmentsPayload =
      catNorm === "교통2"
        ? transit2SegmentsDraft.map((s) => ({
            kind: "TRANSIT2",
            dayKey: s.dayKey,
            start: s.start,
            end: s.end,
            from: s.fromText,
            to: s.toText,
            mode: s.mode,
            memo: s.memoText?.trim() ? s.memoText.trim() : null
          }))
        : null;
    try {
      await updateExpense.mutateAsync({
        id: composeEditExpenseId,
        input: {
          occurredAt,
          endAt,
          amount: parsedAmount,
          category: catNorm,
          paymentType: exPaymentType,
          paymentMethodLabel:
            exPaymentType === "CASH"
              ? null
              : exPaymentLabel.trim()
                ? exPaymentLabel.trim()
                : null,
          paymentOwner: payerName,
          scope: expenseScope,
          participants: participantsAll,
          merchant: merchantTrim ? merchantTrim : null,
          detail: detailCombined,
          memo: entryNote.trim() ? entryNote.trim() : null,
          ...installmentPayload(
            exPaymentType,
            exInstallment,
            exInstallmentMonths,
            exInstallmentNoInterest
          ),
          plannedAt: buildPlannedAtIso(),
          ...transitPayload,
          ...(catNorm === "교통2"
            ? {
                transitMode: transit2SegmentsDraft[0]?.mode ?? exTransitMode,
                transitFrom: transit2SegmentsDraft[0]?.fromText ?? exTransitFromText,
                transitTo: transit2SegmentsDraft[0]?.toText ?? exTransitToText,
                transitSegments: transit2SegmentsPayload
              }
            : {})
        }
      });
      handleComposeClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`저장에 실패했어요.\n${msg}`);
    }
  }

  async function submitNewSchedule(args: ComposeSubmitArgs) {
    const { category, title, startMin, convertFromExpenseId } = args;
    const endRequired = false;
    const endMinParsed = entryEndText.trim()
      ? parseFlexibleTimeToMinutes(entryEndText)
      : null;
    let endMin: number | null = null;
    if (endRequired) {
      if (endMinParsed == null) {
        window.alert("끝 시간을 입력해줘.");
        return;
      }
      endMin = endMinParsed;
      if (!(startMin < endMin)) {
        window.alert("끝 시간은 시작보다 늦아야 해.");
        return;
      }
    } else if (endMinParsed != null) {
      if (!(startMin < endMinParsed)) {
        window.alert("끝 시간은 시작보다 늦아야 해.");
        return;
      }
      endMin = endMinParsed;
    }
    const startAt = dateFromSlotMinutes(composeDayLocal00, startMin).toISOString();
    const endAt =
      endMin != null ? dateFromSlotMinutes(composeDayLocal00, endMin).toISOString() : null;
    const catNorm = normalizeCategory(category);

    if (scheduleWithExpense && exPaymentType === "ETC" && !exPaymentLabel.trim()) {
      window.alert("기타 결제수단 이름을 입력해줘.");
      return;
    }

    const scheduleTitle = `${emojiForCategory(catNorm)} ${title}`.trim();
    const transitMemo =
      catNorm === "교통2"
        ? (() => {
            const from = exTransitFromText.trim();
            const to = exTransitToText.trim();
            if (!from && !to) return "";
            return `${exTransitMode} ${from || "?"} → ${to || "?"}`.trim();
          })()
        : "";
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
    const baseNote = stripTransit2Line(entryNote.trim() ? entryNote.trim() : "");
    const mergedNote = baseNote + (transitMemo ? (baseNote ? "\n" : "") + transitMemo : "");
    const scheduleNote = encodeScheduleNote(schedulePeopleText, mergedNote);

    try {
      await createSchedule.mutateAsync({
        startAt,
        endAt,
        title: scheduleTitle,
        note: scheduleNote,
        showOnCalendar: scheduleShowOnCalendar
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`일정 저장에 실패했어요.\n${msg}`);
      return;
    }

    if (scheduleWithExpense) {
      const amount = parseAmountInput(exAmount);
      if (amount == null) {
        window.alert("금액은 숫자로 입력해줘. (예: 12000 또는 12,000)");
        return;
      }
      const payMinRaw = schedulePayTimeText.trim()
        ? parseFlexibleTimeToMinutes(schedulePayTimeText)
        : startMin;
      if (payMinRaw == null) {
        window.alert("결제 시각을 확인해줘.");
        return;
      }
      const occurredAt = dateFromSlotMinutes(composeDayLocal00, payMinRaw).toISOString();

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
      const catNorm = normalizeCategory(category);
      const transit2SegmentsPayload =
        catNorm === "교통2"
          ? transit2SegmentsDraft.map((s) => ({
              kind: "TRANSIT2",
              dayKey: s.dayKey,
              start: s.start,
              end: s.end,
              from: s.fromText,
              to: s.toText,
              mode: s.mode,
              memo: s.memoText?.trim() ? s.memoText.trim() : null
            }))
          : null;

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

      const merchantTrim = exMerchant.trim();
      const merchantFinal = merchantTrim || title;

      try {
        await createExpense.mutateAsync({
          occurredAt,
          endAt,
          amount,
          category,
          merchant: merchantFinal,
          detail: exDetail.trim() ? exDetail.trim() : null,
          memo: entryNote.trim() ? entryNote.trim() : null,
          paymentType: exPaymentType,
          paymentOwner: payerName,
          paymentMethodLabel:
            exPaymentType === "CASH" ? null : exPaymentLabel.trim() ? exPaymentLabel.trim() : null,
          ...installmentPayload(
            exPaymentType,
            exInstallment,
            exInstallmentMonths,
            exInstallmentNoInterest
          ),
          scope: expenseScope,
          participants: participantsAll,
          plannedAt: buildPlannedAtIso(),
          ...transitPayload,
          ...(catNorm === "교통2"
            ? {
                transitMode: transit2SegmentsDraft[0]?.mode ?? exTransitMode,
                transitFrom: transit2SegmentsDraft[0]?.fromText ?? exTransitFromText,
                transitTo: transit2SegmentsDraft[0]?.toText ?? exTransitToText,
                transitSegments: transit2SegmentsPayload
              }
            : {})
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        window.alert(`지출 저장에 실패했어요.\n${msg}`);
        return;
      }
    }

    if (convertFromExpenseId) {
      await deleteExpense.mutateAsync(convertFromExpenseId);
      setComposeConvertFromExpenseId(null);
    }
    handleComposeClose();
  }

  async function submitNewExpense(args: ComposeSubmitArgs) {
    const { category, title, startMin, convertFromScheduleId } = args;
    const transit = isTransitCategory;
    const endRequired = false;
    const endMinParsed = entryEndText.trim()
      ? parseFlexibleTimeToMinutes(entryEndText)
      : null;
    let endMin: number | null = null;
    if (endRequired) {
      if (endMinParsed == null) {
        window.alert("끝 시간을 입력해줘.");
        return;
      }
      endMin = endMinParsed;
      if (!(startMin < endMin)) {
        window.alert("끝 시간은 시작보다 늦아야 해.");
        return;
      }
    } else if (endMinParsed != null) {
      if (!(startMin < endMinParsed)) {
        window.alert("끝 시간은 시작보다 늦아야 해.");
        return;
      }
      endMin = endMinParsed;
    }
    const startAt = dateFromSlotMinutes(composeDayLocal00, startMin).toISOString();
    const endAt =
      endMin != null ? dateFromSlotMinutes(composeDayLocal00, endMin).toISOString() : null;

    if (exPaymentType === "ETC" && !exPaymentLabel.trim()) {
      window.alert("기타 결제수단 이름을 입력해줘.");
      return;
    }

    const merchantTrim = exMerchant.trim();
    if (!transit && !merchantTrim) {
      window.alert("결제처를 입력해줘.");
      return;
    }

    const amount = parseAmountInput(exAmount);
    if (amount == null) {
      window.alert("금액은 숫자로 입력해줘. (예: 12000 또는 12,000)");
      return;
    }

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

    const detailCombined = [title, exDetail.trim()].filter(Boolean).join(" · ") || null;

    try {
      await createExpense.mutateAsync({
        occurredAt: startAt,
        endAt,
        amount,
        category,
        merchant: merchantTrim ? merchantTrim : null,
        detail: detailCombined,
        memo: entryNote.trim() ? entryNote.trim() : null,
        paymentType: exPaymentType,
        paymentOwner: payerName,
        paymentMethodLabel:
          exPaymentType === "CASH" ? null : exPaymentLabel.trim() ? exPaymentLabel.trim() : null,
        ...installmentPayload(
          exPaymentType,
          exInstallment,
          exInstallmentMonths,
          exInstallmentNoInterest
        ),
        scope: expenseScope,
        participants: participantsAll,
        plannedAt: buildPlannedAtIso(),
        ...transitPayload
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`저장에 실패했어요.\n${msg}`);
      return;
    }

    if (convertFromScheduleId) {
      await deleteSchedule.mutateAsync(convertFromScheduleId);
      setComposeConvertFromScheduleId(null);
    }
    handleComposeClose();
  }

  return (
    <div className="min-h-dvh">
      {headerEl}

      <main className="mx-auto w-full max-w-md px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-4">
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
                <div className="mt-1 text-xs text-slate-500">
                  예산 {formatWon(Math.round(budgetUi.dailyBudget))} · 남음{" "}
                  {formatWon(Math.round(budgetUi.dailyBudget - budgetUi.todayTotal))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-indigo-200/70 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-500">이번달 예산 현황</div>
                <AggregateModeToggle mode={aggregateMode} onChange={setAggregateMode} size="xs" />
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

          <ul className="mt-4 space-y-2">
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
                const schedNote = parseScheduleNote(it.note);
                const scheduleTransitIcon =
                  cat === "교통2"
                    ? (() => {
                        const memo = schedNote.memo ?? "";
                        const firstToken = memo.trimStart().split(/\s+/)[0] ?? "";
                        // e.g. "✈️ 서울 → 제주" → "✈️"
                        return firstToken ? firstToken : null;
                      })()
                    : null;
                return (
                  <li key={`s-${it.id}`}>
                    <button
                      className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:brightness-[0.99]"
                      onClick={() => {
                        const full = (scheduleData?.items ?? []).find((s) => s.id === it.id);
                        if (!full) return;
                        setScheduleDetailTab("schedule");
                        setScheduleDetailOpen(full);
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <div
                            className={cn(
                              "mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl",
                              tint.border,
                              tint.bg
                            )}
                          >
                            {scheduleTransitIcon ?? emojiForCategory(cat)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="break-words text-left text-base font-semibold leading-snug text-slate-900">
                              {parsedTitle.content || it.title}
                            </div>
                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-400">
                              <span className="inline-flex shrink-0 items-center gap-1">
                                <ClockIcon className="h-4 w-4 text-slate-300" />
                                <span className="tabular-nums">
                                  {timeRangeLabel(it.startAt, it.endAt)}
                                </span>
                              </span>
                              {schedNote.people.length ? (
                                <span
                                  className="inline-flex min-w-0 max-w-full items-start gap-1"
                                  aria-label={`함께한 사람 ${schedNote.people.join(", ")}`}
                                >
                                  <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                                  <span className="min-w-0 break-words normal-case">
                                    {schedNote.people.join(", ")}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-semibold text-slate-400">기록</div>
                        </div>
                      </div>
                      {schedNote.memo ? (
                        <div className="mt-2 ml-[3.75rem] w-[calc(100%-3.75rem)] min-w-0 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600">
                          <span className="break-words">“{schedNote.memo}”</span>
                        </div>
                      ) : null}
                    </button>
                  </li>
                );
              }

              if (it.kind === "usage-expense") {
                const e = it.expense;
                const tint = tintForCategory(e.category || "기타");
                const usageTimeLabel = it.endText?.trim()
                  ? `${it.startText?.trim() || ""}~${it.endText.trim()}`
                  : (it.startText?.trim() || "");
                const expenseTransitIcon =
                  normalizeCategory(e.category) === "교통2"
                    ? (() => {
                        const direct = (e.transitMode ?? "").trim();
                        if (direct) return direct;
                        const seg = e.transitSegments;
                        if (!Array.isArray(seg) || !seg.length) return null;
                        const first = seg[0] as any;
                        const m = typeof first?.mode === "string" ? String(first.mode).trim() : "";
                        return m || null;
                      })()
                    : null;
                return (
                  <li key={`u-${e.id}-${it.startMs}`}>
                    <ExpenseCard
                      onClick={() => setExpenseDetailOpen(e)}
                      leftIcon={
                        <div
                          className={cn(
                            "mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl opacity-70",
                            tint.border,
                            tint.bg
                          )}
                        >
                          {expenseTransitIcon ?? emojiForCategory(e.category || "기타")}
                        </div>
                      }
                      title={
                        <span className="inline-flex items-center gap-2">
                          <span>{it.label}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                            이용
                          </span>
                        </span>
                      }
                      meta={
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <ClockIcon className="h-4 w-4 text-slate-300" />
                          <span className="tabular-nums text-slate-400">{usageTimeLabel || "이용"}</span>
                        </span>
                      }
                      quote={
                        it.usageMemo ? (
                          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600">
                            <span className="text-slate-500">이용일 메모</span>
                            <span className="text-slate-400"> · </span>
                            <span className="break-words">“{it.usageMemo}”</span>
                          </div>
                        ) : null
                      }
                      amount={
                        e.amount > 0 ? (
                          <div className="flex items-baseline justify-end gap-1 tabular-nums text-slate-400">
                            <span className="text-lg font-extrabold tracking-tight">
                              {Math.round(e.amount).toLocaleString()}
                            </span>
                            <span className="text-xs font-semibold">원</span>
                          </div>
                        ) : (
                          <div className="text-right text-xs font-semibold tabular-nums text-slate-400">
                            금액 미입력
                          </div>
                        )
                      }
                    />
                  </li>
                );
              }

              const e = it.expense;
              const tint = tintForCategory(e.category || "기타");
              const isCashflowVirtual = String(e.id || "").includes("::cashflow::");
              const cashflowVirtualMonthKey = isCashflowVirtual
                ? (String(e.id || "").split("::cashflow::")[1] ?? "").trim()
                : "";
              const originalForCashflow = isCashflowVirtual ? resolveOriginalExpense(e) : e;
              const installmentNth =
                isCashflowVirtual &&
                originalForCashflow.paymentType === "CARD" &&
                !!originalForCashflow.installment &&
                !!originalForCashflow.installmentMonths &&
                originalForCashflow.installmentMonths >= 2 &&
                /^\d{4}-\d{2}$/.test(cashflowVirtualMonthKey)
                  ? monthIndexDiff(yyyyMmLocal(new Date(originalForCashflow.occurredAt)), cashflowVirtualMonthKey) + 1
                  : null;
              const settlementLine = isCashflowVirtual ? null : settlementLineForExpense(e, "나");
              const isSettled = isCashflowVirtual ? true : isExpenseNetSettledForDay(dayKey, e, "나");
              // 카드 하단 “메모”는 사용자가 입력한 memo를 우선 노출 (detail보다 우선)
              const rawMemoText = (e.memo ?? e.detail ?? "").trim();
              const memoText =
                normalizeCategory(e.category) === "교통2" && isUsageDayDifferent(e, dayKey)
                  ? stripTransitRoutePrefix(rawMemoText, e.transitFrom, e.transitTo).trim()
                  : rawMemoText;
              const expenseTransitIcon =
                normalizeCategory(e.category) === "교통2"
                  ? (() => {
                      const direct = (e.transitMode ?? "").trim();
                      if (direct) return direct;
                      const seg = e.transitSegments;
                      if (!Array.isArray(seg) || !seg.length) return null;
                      const first = seg[0] as any;
                      const m = typeof first?.mode === "string" ? String(first.mode).trim() : "";
                      return m || null;
                    })()
                  : null;
              const peopleLabel =
                e.scope === "SHARED" && Array.isArray(e.participants) && e.participants.length
                  ? participantsDisplayWithoutMe(e.participants, "나")
                  : (e.paymentOwner ?? "-");
              const installmentShort =
                e.paymentType === "CARD" && e.installment && e.installmentMonths
                  ? e.installmentNoInterest
                    ? `무${e.installmentMonths}`
                    : `${e.installmentMonths}`
                  : null;
              const methodLabel =
                e.paymentType === "CASH" ? "현금" : e.paymentMethodLabel || PAYMENT_TYPE_LABEL[e.paymentType];
              const methodLabelWithInstallment = installmentShort ? `${methodLabel} · ${installmentShort}` : methodLabel;
              return (
                <li key={`e-${e.id}`}>
                  <ExpenseCard
                    onClick={() => setExpenseDetailOpen(resolveOriginalExpense(e))}
                    leftIcon={
                      <div
                        className={cn(
                          "mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl",
                          tint.border,
                          tint.bg
                        )}
                      >
                        {expenseTransitIcon ?? emojiForCategory(e.category)}
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
                        {String(e.id || "").includes("::cashflow::") ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              chipClass("orange")
                            )}
                          >
                            할부(
                            {installmentNth ?? "?"}/{originalForCashflow.installmentMonths ?? "?"})
                          </span>
                        ) : null}
                      </>
                    }
                    meta={
                      <>
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <ClockIcon className="h-4 w-4 text-slate-300" />
                          <span className="tabular-nums">
                            {e.endAt
                              ? timeRangeLabel(e.occurredAt, e.endAt)
                              : expenseTimeLabel(e.occurredAt, dayLocal00)}
                          </span>
                        </span>
                        <span className="shrink-0">·</span>
                        <span className="inline-flex min-w-0 max-w-full items-start gap-1">
                          <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                          <span className="min-w-0 break-words">{peopleLabel}</span>
                        </span>
                        <span className="shrink-0">·</span>
                        <span className="inline-flex min-w-0 max-w-full items-start gap-1">
                          <MoneyIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                          <span className="min-w-0 break-words">{methodLabelWithInstallment}</span>
                        </span>
                      </>
                    }
                    amount={
                      e.amount > 0 ? (
                        <div className="text-right tabular-nums text-slate-900">
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-lg font-extrabold tracking-tight">
                              {e.amount.toLocaleString()}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">원</span>
                          </div>
                          {aggregateMode !== "cashflow" &&
                          e.paymentType === "CARD" &&
                          e.installment &&
                          e.installmentMonths ? (
                            <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                              월 {Math.round(e.amount / e.installmentMonths).toLocaleString()}원
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-right text-xs font-semibold tabular-nums text-slate-400">
                          금액 미입력
                        </div>
                      )
                    }
                    settlement={
                      memoText || settlementLine ? (
                        <>
                          <div className="min-w-0 flex-1">
                            {memoText ? (
                              <div className="ml-[calc(3rem+0.75rem)] truncate rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600">
                                “{memoText}”
                              </div>
                            ) : null}
                          </div>
                          {settlementLine ? (
                            <div className="flex shrink-0 items-center justify-end">
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
                            </div>
                          ) : null}
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

      {/* FAB — 하단 네비 위로 */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40">
        <div className="mx-auto flex w-full max-w-md justify-end px-6">
          <button
            className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.99]"
            onClick={() => {
              setComposeEditExpenseId(null);
              setComposeEditScheduleId(null);
              setComposeDayKey(dayKey);
              setComposeKind("expense");
              setScheduleWithExpense(false);
              setSchedulePayTimeText("");
              setSchedulePeopleText("");
              resetComposeForm();
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
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                      composeKind === "expense"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500",
                    )}
                    onClick={() => {
                      // 수정 중 일정 → 지출 전환: 지출로 저장 후 원본 일정 삭제
                      if (composeEditScheduleId) {
                        setComposeConvertFromScheduleId(composeEditScheduleId);
                        setComposeEditScheduleId(null);
                      } else if (composeConvertFromScheduleId) {
                        // 되돌리기
                        setComposeEditScheduleId(composeConvertFromScheduleId);
                        setComposeConvertFromScheduleId(null);
                      }
                      setComposeKind("expense");
                    }}
                  >
                    지출
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                      composeKind === "schedule"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500",
                    )}
                    onClick={() => {
                      // 수정 중 지출 → 일정 전환: 일정으로 저장 후 원본 지출 삭제
                      if (composeEditExpenseId) {
                        setComposeConvertFromExpenseId(composeEditExpenseId);
                        setComposeEditExpenseId(null);
                      } else if (composeConvertFromExpenseId) {
                        // 되돌리기
                        setComposeEditExpenseId(composeConvertFromExpenseId);
                        setComposeConvertFromExpenseId(null);
                      }
                      setComposeKind("schedule");
                    }}
                  >
                    일정
                  </button>
                </div>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">날짜</div>
                  <DateMonthInput
                    type="date"
                    value={composeDayKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      setComposeDayKey(v);
                    }}
                    className="text-sm"
                  />
                </label>
                {composeKind === "expense" && !isTransit2 ? (
                  <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={plannedAtEnabled}
                        onChange={(e) => setPlannedAtEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                      <span className="text-sm font-semibold text-slate-800">결제일과 다른 날 사용</span>
                    </label>
                    {plannedAtEnabled ? (
                      <label className="mt-3 block">
                        <div className="mb-1 text-xs text-slate-400">사용 예정/실제일</div>
                        <DateMonthInput
                          type="datetime-local"
                          value={plannedAtLocal}
                          onChange={(e) => setPlannedAtLocal(e.target.value)}
                          className="text-sm"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
                <label>
                  <div className="mb-1 text-xs text-slate-400">
                    {composeEditExpenseId ||
                    composeEditScheduleId ||
                    composeConvertFromExpenseId ||
                    composeConvertFromScheduleId
                      ? "시작 (필수)"
                      : isTransitCategory
                        ? "출발시간 (필수)"
                        : "시작 (필수)"}
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
                    {composeEditExpenseId ||
                    composeEditScheduleId ||
                    composeConvertFromExpenseId ||
                    composeConvertFromScheduleId
                      ? "끝 (선택)"
                      : isTransitCategory
                        ? "도착시간 (선택)"
                        : "끝 (선택)"}
                  </div>
                  <input
                    value={entryEndText}
                    onChange={(e) => setEntryEndText(e.target.value)}
                    placeholder={
                      isTransitCategory ? "예: 09:30 (05:00~28:30)" : "비워두면 끝 시간 없음 · 예: 09:30"
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">카테고리 (필수)</div>
                  <div className="flex items-center gap-3">
                    <CategoryCardPreview category={entryCategory} />
                    <select
                      value={entryCategory}
                      onChange={(e) => setEntryCategory(e.target.value)}
                      className={CATEGORY_SELECT_CLASS}
                      style={CATEGORY_SELECT_ARROW_STYLE}
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
                      {entryCategory.trim() && !ALL_CATEGORIES.includes(entryCategory.trim()) ? (
                        <option value={entryCategory.trim()}>
                          {entryCategory.trim()} (기존)
                        </option>
                      ) : null}
                    </select>
                  </div>
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
                    segments={transit2SegmentsDraft}
                    setSegments={(next) => {
                      setTransit2SegmentsDraft(next);
                      const first = next[0];
                      setExTransitMode(first?.mode ?? "🚆");
                      setExTransitFromText(first?.fromText ?? "");
                      setExTransitToText(first?.toText ?? "");
                    }}
                  />
                ) : null}

                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">내용 (필수)</div>
                  <input
                    value={entryTitle}
                    onChange={(e) => setEntryTitle(e.target.value)}
                    placeholder="예: 교통 이동시간 / 영화 / 헬스 / 오늘 뭐했는지"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>

                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">메모 (선택)</div>
                  <input
                    value={entryNote}
                    onChange={(e) => setEntryNote(e.target.value)}
                    placeholder="선택"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>

                {composeKind === "schedule" ? (
                  <>
                    <label className="col-span-2">
                      <div className="mb-1 text-xs text-slate-400">함께한 사람(선택)</div>
                      <input
                        value={schedulePeopleText}
                        onChange={(e) => setSchedulePeopleText(e.target.value)}
                        placeholder="쉼표로 구분 예: 나,철수"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                      />
                    </label>
                    <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={scheduleShowOnCalendar}
                          onChange={(e) => setScheduleShowOnCalendar(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        <span className="text-sm font-semibold text-slate-800">달력에 표기</span>
                      </label>
                      <div className="mt-1 text-[11px] font-semibold text-slate-500">
                        체크된 일정만 달력 페이지에 표시돼요.
                      </div>
                    </div>
                    <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={scheduleWithExpense}
                          onChange={(e) => setScheduleWithExpense(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        <span className="text-sm font-semibold text-slate-800">비용도 함께 기록</span>
                      </label>
                      {scheduleWithExpense ? (
                        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                          <label className="block">
                            <div className="mb-1 text-xs text-slate-400">결제 시각(선택)</div>
                            <input
                              value={schedulePayTimeText}
                              onChange={(e) => setSchedulePayTimeText(e.target.value)}
                              placeholder="비우면 일정 시작과 동일"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 text-xs text-slate-400">금액 (필수)</div>
                            <input
                              inputMode="numeric"
                              value={exAmount}
                              onChange={(e) => setExAmount(formatAmountInputWithCommas(e.target.value))}
                              placeholder={isTransitCategory ? "예: 교통비" : "예: 12000"}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-slate-400"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="min-w-0 space-y-2">
                              <div className="mb-1 text-xs text-slate-400">결제자</div>
                              <div className="flex gap-2">
                                {(["나", "기타"] as const).map((p) => (
                                  <button
                                    key={p}
                                    type="button"
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
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 space-y-2">
                              <div className="mb-1 text-xs text-slate-400">지출 유형</div>
                              <div className="flex gap-2">
                                {[
                                  { key: "PERSONAL" as const, label: "개인" },
                                  { key: "SHARED" as const, label: "공동" }
                                ].map((t) => (
                                  <button
                                    key={t.key}
                                    type="button"
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
                                  placeholder="함께한 사람 (쉼표로 구분)"
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                                />
                              ) : null}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="mb-1 text-xs text-slate-400">결제수단 (필수)</div>
                            <div className="flex flex-wrap gap-2">
                              {PAYMENT_TYPE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  className={cn(
                                    "flex-1 min-w-[4.5rem] rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                                    exPaymentType === opt.key
                                      ? "border-indigo-600 bg-indigo-600 text-white"
                                      : "border-slate-200 bg-white text-slate-800"
                                  )}
                                  onClick={() => {
                                    setExPaymentType(opt.key);
                                    if (opt.key === "CASH") setExPaymentLabel("");
                                    if (opt.key !== "CARD") {
                                      setExInstallment(false);
                                      setExInstallmentNoInterest(false);
                                    }
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
                                      ? "이체 메모(선택)"
                                      : "기타 결제수단 이름(필수)"
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                              />
                            ) : null}
                            {exPaymentType === "CARD" ? (
                              <CardInstallmentFields
                                installment={exInstallment}
                                setInstallment={setExInstallment}
                                months={exInstallmentMonths}
                                setMonths={setExInstallmentMonths}
                                noInterest={exInstallmentNoInterest}
                                setNoInterest={setExInstallmentNoInterest}
                              />
                            ) : null}
                          </div>
                          <label className="block">
                            <div className="mb-1 text-xs text-slate-400">결제처(선택)</div>
                            <input
                              value={exMerchant}
                              onChange={(e) => setExMerchant(e.target.value)}
                              placeholder="예: CGV / 편의점"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 text-xs text-slate-400">세부내용(선택)</div>
                            <input
                              value={exDetail}
                              onChange={(e) => setExDetail(e.target.value)}
                              placeholder="예: 팝콘, 콜라"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {composeKind === "expense" ? (
                  <>
                    <label className="col-span-2">
                      <div className="mb-1 text-xs text-slate-400">금액 (필수)</div>
                      <input
                        inputMode="numeric"
                        value={exAmount}
                        onChange={(e) => setExAmount(formatAmountInputWithCommas(e.target.value))}
                        placeholder={isTransitCategory ? "예: 교통비" : "예: 12000"}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-slate-400"
                      />
                    </label>

                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <div className="min-w-0 space-y-2">
                        <div className="mb-1 text-xs text-slate-400">결제자</div>
                        <div className="flex gap-2">
                          {(["나", "기타"] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
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
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 space-y-2">
                        <div className="mb-1 text-xs text-slate-400">지출 유형</div>
                        <div className="flex gap-2">
                          {[
                            { key: "PERSONAL" as const, label: "개인" },
                            { key: "SHARED" as const, label: "공동" }
                          ].map((t) => (
                            <button
                              key={t.key}
                              type="button"
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
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="col-span-2 space-y-2">
                      <div className="mb-1 text-xs text-slate-400">결제수단 (필수)</div>
                      <div className="flex flex-wrap gap-2">
                        {PAYMENT_TYPE_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            className={cn(
                              "flex-1 min-w-[4.5rem] rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                              exPaymentType === opt.key
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-800"
                            )}
                            onClick={() => {
                              setExPaymentType(opt.key);
                              if (opt.key === "CASH") setExPaymentLabel("");
                              if (opt.key !== "CARD") {
                                setExInstallment(false);
                                setExInstallmentNoInterest(false);
                              }
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
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                        />
                      ) : null}
                      {exPaymentType === "CARD" ? (
                        <CardInstallmentFields
                          installment={exInstallment}
                          setInstallment={setExInstallment}
                          months={exInstallmentMonths}
                          setMonths={setExInstallmentMonths}
                          noInterest={exInstallmentNoInterest}
                          setNoInterest={setExInstallmentNoInterest}
                        />
                      ) : null}
                    </div>

                    <label className="col-span-2">
                      <div className="mb-1 text-xs text-slate-400">결제처(교통1 제외 시 필수)</div>
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
                  </>
                ) : null}
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
        <ComposeSheet
          open
          title={
            <>
              <span className="mr-2 text-base">{emojiForCategory(expenseDetailOpen.category)}</span>
              {expenseDetailOpen.merchant ?? normalizeCategory(expenseDetailOpen.category)}
            </>
          }
          subtitle={
            (expenseDetailOpen.endAt
              ? timeRangeLabel(expenseDetailOpen.occurredAt, expenseDetailOpen.endAt)
              : expenseTimeLabel(expenseDetailOpen.occurredAt, dayLocal00)) +
            " · " +
            PAYMENT_TYPE_LABEL[expenseDetailOpen.paymentType] +
            (expenseDetailOpen.installment && expenseDetailOpen.installmentMonths
              ? ` · ${
                  expenseDetailOpen.installmentNoInterest
                    ? `무${expenseDetailOpen.installmentMonths}`
                    : `${expenseDetailOpen.installmentMonths}`
                }`
              : "")
          }
          onClose={() => setExpenseDetailOpen(null)}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
                onClick={() => {
                  fillComposeFromExpense(expenseDetailOpen);
                  setExpenseDetailOpen(null);
                  setComposeOpen(true);
                }}
              >
                수정
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm"
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
          }
        >
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
                <div className="text-xs text-slate-400">결제수단</div>
                <div className="mt-1 font-semibold text-slate-900">{PAYMENT_TYPE_LABEL[expenseDetailOpen.paymentType]}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">결제자</div>
                <div className="mt-1 font-semibold text-slate-900">{expenseDetailOpen.paymentOwner ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">카드/수단명</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {expenseDetailOpen.paymentMethodLabel ?? "-"}
                </div>
              </div>
              {expenseDetailOpen.paymentType === "CARD" && expenseDetailOpen.installment && expenseDetailOpen.installmentMonths ? (
                <div>
                  <div className="text-xs text-slate-400">할부</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {expenseDetailOpen.installmentNoInterest
                      ? `무${expenseDetailOpen.installmentMonths}`
                      : `${expenseDetailOpen.installmentMonths}`}
                  </div>
                </div>
              ) : null}
              <div className="col-span-2">
                <div className="text-xs text-slate-400">결제처</div>
                <div className="mt-1 font-semibold text-slate-900">{expenseDetailOpen.merchant ?? "-"}</div>
              </div>
            </div>
            {(() => {
              const hideTransitBecauseUsageDay =
                normalizeCategory(expenseDetailOpen.category) === "교통2" &&
                expenseDetailOpen.plannedAt &&
                yyyyMmDdLocal(new Date(expenseDetailOpen.plannedAt)) !== yyyyMmDdLocal(new Date(expenseDetailOpen.occurredAt));
              return !hideTransitBecauseUsageDay && (expenseDetailOpen.transitFrom || expenseDetailOpen.transitTo);
            })() ? (
              <div className="mt-3">
                <div className="text-xs text-slate-400">이동</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {(expenseDetailOpen.transitMode ?? "") + " "}
                  {(expenseDetailOpen.transitFrom ?? "?") +
                    (expenseDetailOpen.transitVia ? ` → ${expenseDetailOpen.transitVia.split("|").join(" → ")}` : "") +
                    " → " +
                    (expenseDetailOpen.transitTo ?? "?")}
                  {expenseDetailOpen.transitLine ? ` · ${expenseDetailOpen.transitLine}` : ""}
                  {expenseDetailOpen.transitBusNumber ? ` · ${expenseDetailOpen.transitBusNumber}` : ""}
                </div>
              </div>
            ) : null}
            {expenseDetailOpen.detail ? (
              <div className="mt-3">
                <div className="text-xs text-slate-400">세부내용</div>
                <div className="mt-1 text-sm text-slate-800">
                  {(() => {
                    const raw = expenseDetailOpen.detail ?? "";
                    const d = raw.trim();
                    if (!d) return raw;
                    // 교통2는 보통 title=출발→도착 이고 detail에 "출발→도착 · ..."로 저장되어 중복 노출될 수 있음
                    return stripTransitRoutePrefix(raw, expenseDetailOpen.transitFrom, expenseDetailOpen.transitTo);
                  })()}
                </div>
              </div>
            ) : null}
            {expenseDetailOpen.memo ? (
              <div className="mt-3">
                <div className="text-xs text-slate-400">메모</div>
                <div className="mt-1 text-sm text-slate-800">{expenseDetailOpen.memo}</div>
              </div>
            ) : null}
            {expenseDetailOpen.participants ? (
              <div className="mt-3">
                <div className="text-xs text-slate-400">함께한 사람</div>
                <div className="mt-1 text-sm text-slate-800">
                  {Array.isArray(expenseDetailOpen.participants)
                    ? participantsDisplayWithoutMe(expenseDetailOpen.participants, "나")
                    : JSON.stringify(expenseDetailOpen.participants)}
                </div>
              </div>
            ) : null}
          </div>

          {settlementTransfersForMe(expenseDetailOpen, "나").length ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-sm font-semibold text-slate-900">정산</div>
              <div className="mt-2 space-y-2">
                {settlementTransfersForMe(expenseDetailOpen, "나").map((t) => {
                  const counterparty = t.from === "나" ? t.to : t.from;
                  const key = `${t.from}→${t.to}:${t.amount}`;
                  const expenseDay = yyyyMmDdLocal(new Date(expenseDetailOpen.occurredAt));
                  const done = isNetSettledForDay(expenseDay, counterparty);
                  const signedAmount = t.from === "나" ? -t.amount : t.amount;
                  return (
                    <SettlementRow
                      key={key}
                      from={t.from}
                      to={t.to}
                      me="나"
                      amount={signedAmount}
                      settled={done}
                      onToggle={() => requestToggleNetSettledForDay(expenseDay, counterparty)}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </ComposeSheet>
      ) : null}

      {/* Schedule detail — 기록 작성 시트와 동일 패턴(max-w-md · 상단 핸들) */}
      {scheduleDetailOpen ? (
        <ComposeSheet
          open
          title={
            parseEmojiPrefixedTitle(scheduleDetailOpen.title).content || scheduleDetailOpen.title
          }
          subtitle={timeRangeLabel(scheduleDetailOpen.startAt, scheduleDetailOpen.endAt)}
          onClose={() => {
            setScheduleDetailOpen(null);
            setScheduleDetailTab("schedule");
          }}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
                onClick={() => {
                  const full = scheduleDetailOpen;
                  const linked = expensesOccurringWithinSchedule(expensesData?.items ?? [], full);
                  fillComposeFromSchedule(full, linked);
                  setScheduleDetailOpen(null);
                  setScheduleDetailTab("schedule");
                  setComposeOpen(true);
                }}
              >
                수정
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm"
                onClick={async () => {
                  const id = scheduleDetailOpen.id;
                  requestConfirm("기록이 사라집니다. 삭제하시겠습니까?", async () => {
                    await deleteSchedule.mutateAsync(id);
                    setScheduleDetailOpen(null);
                    setScheduleDetailTab("schedule");
                  });
                }}
              >
                삭제
              </button>
            </div>
          }
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ClockIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="tabular-nums">
                {timeRangeLabel(scheduleDetailOpen.startAt, scheduleDetailOpen.endAt)}
              </span>
            </div>
          </div>

          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                scheduleDetailTab === "schedule"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500"
              )}
              onClick={() => setScheduleDetailTab("schedule")}
            >
              일정
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                scheduleDetailTab === "expense"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500"
              )}
              onClick={() => setScheduleDetailTab("expense")}
            >
              지출
            </button>
          </div>

          <div className="mt-3">
            {scheduleDetailTab === "schedule" ? (
              <ScheduleDetailNoteBlock scheduleId={scheduleDetailOpen.id} note={scheduleDetailOpen.note} />
            ) : (
              <div className="space-y-2">
                {scheduleDetailLinkedExpenses.map((e) => {
                  const et = tintForCategory(e.category || "기타");
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:brightness-[0.99]"
                      onClick={() => {
                        setScheduleDetailOpen(null);
                        setScheduleDetailTab("schedule");
                        setExpenseDetailOpen(e);
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg",
                            et.border,
                            et.bg
                          )}
                        >
                          {emojiForCategory(e.category || "기타")}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {e.merchant ?? normalizeCategory(e.category)}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {expenseTimeLabel(e.occurredAt, dayLocal00)} · {PAYMENT_TYPE_LABEL[e.paymentType]}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                        {formatWon(e.amount)}
                      </div>
                    </button>
                  );
                })}
                {scheduleDetailLinkedExpenses.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                    이 일정 시간 안에 결제 시각이 있는 지출이 없어요. 기록 작성에서 일정과 비용을 함께 넣으면 이 탭에 표시돼요.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </ComposeSheet>
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

