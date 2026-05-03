import type { Dispatch, SetStateAction } from "react";
import { UsersIcon } from "@/components/icons/index";
import DateMonthInput from "@/components/DateMonthInput";
import Transit1Fields from "@/components/transit/Transit1Fields";
import Transit2Fields from "@/components/transit/Transit2Fields";
import CardInstallmentFields from "@/components/CardInstallmentFields";
import CategoryCardPreview from "@/components/CategoryCardPreview";
import { cn } from "@/components/cn";
import {
  NATIVE_SELECT_CHEVRON_CLASS_REQUIRED,
  NATIVE_SELECT_CHEVRON_STYLE
} from "@/components/nativeSelectChevron";
import { fieldBorderClass } from "@/components/inputFieldClasses";
import { pad2 } from "@/domain/date";
import { normalizeFourDigitTimeInput } from "@/domain/time";
import { formatAmountInputWithCommas } from "@/domain/parseAmountInput";
import { ALL_CATEGORIES, CATEGORY_GROUPS } from "@/domain/categoryUi";
import { PAYMENT_TYPE_OPTIONS } from "@/domain/expensePaymentUi";
import { emptyTransit1Leg, type TransitLeg, type Transit2SegmentDraft } from "@/domain/transitPayload";

const CATEGORY_SELECT_CLASS = cn("flex-1", NATIVE_SELECT_CHEVRON_CLASS_REQUIRED);
const CATEGORY_SELECT_ARROW_STYLE = NATIVE_SELECT_CHEVRON_STYLE;

export type ComposeFormProps = {
  composeKind: "expense" | "schedule";
  setComposeKind: Dispatch<SetStateAction<"expense" | "schedule">>;
  composeEditExpenseId: string | null;
  setComposeEditExpenseId: Dispatch<SetStateAction<string | null>>;
  composeEditScheduleId: string | null;
  setComposeEditScheduleId: Dispatch<SetStateAction<string | null>>;
  composeConvertFromExpenseId: string | null;
  setComposeConvertFromExpenseId: Dispatch<SetStateAction<string | null>>;
  composeConvertFromScheduleId: string | null;
  setComposeConvertFromScheduleId: Dispatch<SetStateAction<string | null>>;
  composeDayKey: string;
  setComposeDayKey: Dispatch<SetStateAction<string>>;
  isTransit1: boolean;
  isTransit2: boolean;
  isTransitCategory: boolean;
  entryStartText: string;
  setEntryStartText: Dispatch<SetStateAction<string>>;
  entryEndText: string;
  setEntryEndText: Dispatch<SetStateAction<string>>;
  entryCategory: string;
  setEntryCategory: Dispatch<SetStateAction<string>>;
  entryTitle: string;
  setEntryTitle: Dispatch<SetStateAction<string>>;
  entryNote: string;
  setEntryNote: Dispatch<SetStateAction<string>>;
  exMerchant: string;
  setExMerchant: Dispatch<SetStateAction<string>>;
  exDetail: string;
  setExDetail: Dispatch<SetStateAction<string>>;
  exAmount: string;
  setExAmount: Dispatch<SetStateAction<string>>;
  exPaymentType: import("@/features/expenses/api").Expense["paymentType"];
  setExPaymentType: Dispatch<SetStateAction<import("@/features/expenses/api").Expense["paymentType"]>>;
  exPaymentLabel: string;
  setExPaymentLabel: Dispatch<SetStateAction<string>>;
  payerPreset: "나" | "기타";
  setPayerPreset: Dispatch<SetStateAction<"나" | "기타">>;
  payerOther: string;
  setPayerOther: Dispatch<SetStateAction<string>>;
  expenseScope: "PERSONAL" | "SHARED";
  setExpenseScope: Dispatch<SetStateAction<"PERSONAL" | "SHARED">>;
  sharedNamesText: string;
  setSharedNamesText: Dispatch<SetStateAction<string>>;
  expenseCompanionsText: string;
  setExpenseCompanionsText: Dispatch<SetStateAction<string>>;
  exInstallment: boolean;
  setExInstallment: Dispatch<SetStateAction<boolean>>;
  exInstallmentMonths: number;
  setExInstallmentMonths: Dispatch<SetStateAction<number>>;
  exInstallmentNoInterest: boolean;
  setExInstallmentNoInterest: Dispatch<SetStateAction<boolean>>;
  plannedAtEnabled: boolean;
  setPlannedAtEnabled: Dispatch<SetStateAction<boolean>>;
  plannedAtLocal: string;
  setPlannedAtLocal: Dispatch<SetStateAction<string>>;
  scheduleWithExpense: boolean;
  setScheduleWithExpense: Dispatch<SetStateAction<boolean>>;
  schedulePayTimeText: string;
  setSchedulePayTimeText: Dispatch<SetStateAction<string>>;
  schedulePeopleText: string;
  setSchedulePeopleText: Dispatch<SetStateAction<string>>;
  scheduleShowOnCalendar: boolean;
  setScheduleShowOnCalendar: Dispatch<SetStateAction<boolean>>;
  scheduleExpenseTitle: string;
  setScheduleExpenseTitle: Dispatch<SetStateAction<string>>;
  transitLegs: TransitLeg[];
  setTransitLegs: Dispatch<SetStateAction<TransitLeg[]>>;
  transit2SegmentsDraft: Transit2SegmentDraft[];
  setTransit2SegmentsDraft: Dispatch<SetStateAction<Transit2SegmentDraft[]>>;
  setExTransitMode: Dispatch<SetStateAction<string>>;
  setExTransitFromText: Dispatch<SetStateAction<string>>;
  setExTransitToText: Dispatch<SetStateAction<string>>;
  requestConfirm: (_message: string, _action: () => void | Promise<void>) => void;
  onOpenStationSearch: (_legIndex: number, _field: "from" | "to") => void;
  onOpenBusStopSearch: (_legIndex: number, _field: "from" | "to") => void;
};

export function ComposeForm(props: ComposeFormProps) {
  const {
    composeKind,
    setComposeKind,
    composeEditExpenseId,
    setComposeEditExpenseId,
    composeEditScheduleId,
    setComposeEditScheduleId,
    composeConvertFromExpenseId,
    setComposeConvertFromExpenseId,
    composeConvertFromScheduleId,
    setComposeConvertFromScheduleId,
    composeDayKey,
    setComposeDayKey,
    isTransit1,
    isTransit2,
    isTransitCategory,
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
    scheduleWithExpense,
    setScheduleWithExpense,
    schedulePayTimeText,
    setSchedulePayTimeText,
    schedulePeopleText,
    setSchedulePeopleText,
    scheduleShowOnCalendar,
    setScheduleShowOnCalendar,
    scheduleExpenseTitle,
    setScheduleExpenseTitle,
    transitLegs,
    setTransitLegs,
    transit2SegmentsDraft,
    setTransit2SegmentsDraft,
    setExTransitMode,
    setExTransitFromText,
    setExTransitToText,
    requestConfirm,
    onOpenStationSearch,
    onOpenBusStopSearch
  } = props;

  return (
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
            <div className="col-span-2 grid min-w-0 grid-cols-2 gap-3">
              <label
                className={cn(
                  "flex min-w-0 w-full max-w-full flex-col",
                  isTransit1 && "col-span-2"
                )}
              >
                <div className="mb-1 text-xs text-slate-400">날짜(필수)</div>
                <DateMonthInput
                  type="date"
                  required
                  value={composeDayKey}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    setComposeDayKey(v);
                  }}
                  className="h-12 w-full min-w-0 text-sm"
                />
              </label>
              {!isTransit1 ? (
                isTransit2 ? (
                  <label className="flex min-w-0 w-full max-w-full flex-col">
                    <div className="mb-1 text-xs text-slate-400">시간(필수)</div>
                    <input
                      value={entryStartText}
                      onChange={(e) => {
                        setEntryStartText(normalizeFourDigitTimeInput(e.target.value));
                      }}
                      placeholder="예: 09:00"
                      className={cn(
                        "h-12 w-full rounded-xl bg-white px-3 text-sm tabular-nums",
                        fieldBorderClass({ required: true })
                      )}
                    />
                  </label>
                ) : composeKind === "schedule" ? (
                  <div className="min-w-0 w-full max-w-full">
                    <div className="mb-1 text-xs text-slate-400">&nbsp;</div>
                    <button
                      type="button"
                      className={cn(
                        "flex h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 text-left",
                        scheduleShowOnCalendar ? "border-indigo-200" : "border-slate-200"
                      )}
                      onClick={() => setScheduleShowOnCalendar((v) => !v)}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded border",
                            scheduleShowOnCalendar
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          )}
                          aria-hidden
                        >
                          ✓
                        </span>
                        <span className="text-sm font-semibold text-slate-900">달력</span>
                      </div>
                    </button>
                  </div>
                ) : composeKind === "expense" ? (
                <div className="min-w-0 w-full max-w-full">
                  <div className="mb-1 text-xs text-slate-400 opacity-0 select-none">&nbsp;</div>
                  <button
                    type="button"
                    className={cn(
                      "flex h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 text-left",
                      plannedAtEnabled ? "border-indigo-200" : "border-slate-200"
                    )}
                    onClick={() => {
                      if (!plannedAtEnabled && !plannedAtLocal) {
                        const now = new Date();
                        const yyyy = now.getFullYear();
                        const mm = pad2(now.getMonth() + 1);
                        const dd = pad2(now.getDate());
                        const hh = pad2(now.getHours());
                        const mi = pad2(now.getMinutes());
                        setPlannedAtLocal(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
                      }
                      setPlannedAtEnabled((v) => !v);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded border",
                          plannedAtEnabled
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 bg-white text-transparent"
                        )}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="text-sm font-semibold text-slate-900">다른 날</span>
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      className={cn(
                        "h-5 w-5 shrink-0 text-slate-400 transition-transform",
                        plannedAtEnabled ? "rotate-180" : "rotate-0"
                      )}
                      aria-hidden="true"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {plannedAtEnabled ? (
                    <div className="mt-2 grid grid-cols-[1fr_7rem] gap-2">
                      <DateMonthInput
                        type="date"
                        value={plannedAtLocal.split("T")[0] ?? ""}
                        onChange={(e) => {
                          const d = e.target.value;
                          const t = plannedAtLocal.split("T")[1] ?? "";
                          setPlannedAtLocal(d ? `${d}T${t}` : "");
                        }}
                        iconAlign="center"
                        className="h-12 text-sm text-transparent caret-transparent"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="14:30"
                        maxLength={5}
                        value={plannedAtLocal.split("T")[1] ?? ""}
                        onChange={(e) => {
                          const t = normalizeFourDigitTimeInput(e.target.value);
                          const d = plannedAtLocal.split("T")[0] ?? "";
                          setPlannedAtLocal(`${d}T${t}`);
                        }}
                        className={cn(
                          "h-12 w-full rounded-xl bg-white px-3 text-center text-sm tabular-nums",
                          fieldBorderClass()
                        )}
                      />
                    </div>
                  ) : null}
                </div>
                ) : (
                  <div />
                )
              ) : null}
              {composeKind === "schedule" && isTransit1 ? (
                <div className="col-span-2 min-w-0">
                  <button
                    type="button"
                    className={cn(
                      "flex h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 text-left",
                      scheduleShowOnCalendar ? "border-indigo-200" : "border-slate-200"
                    )}
                    onClick={() => setScheduleShowOnCalendar((v) => !v)}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded border",
                          scheduleShowOnCalendar
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 bg-white text-transparent"
                        )}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="text-sm font-semibold text-slate-900">달력</span>
                    </div>
                  </button>
                </div>
              ) : null}
              {composeKind === "schedule" && isTransit2 ? (
                <div className="col-span-2 min-w-0">
                  <button
                    type="button"
                    className={cn(
                      "flex h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 text-left",
                      scheduleShowOnCalendar ? "border-indigo-200" : "border-slate-200"
                    )}
                    onClick={() => setScheduleShowOnCalendar((v) => !v)}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded border",
                          scheduleShowOnCalendar
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 bg-white text-transparent"
                        )}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="text-sm font-semibold text-slate-900">달력</span>
                    </div>
                  </button>
                </div>
              ) : null}
            </div>
            {!isTransit1 && !isTransit2 ? (
              <>
                <label>
                  <div className="mb-1 text-xs text-slate-400">시작(필수)</div>
                  <input
                    value={entryStartText}
                    onChange={(e) => {
                      setEntryStartText(normalizeFourDigitTimeInput(e.target.value));
                    }}
                    placeholder="예: 09:00 (05:00~28:30)"
                    className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-slate-400">끝</div>
                  <input
                    value={entryEndText}
                    onChange={(e) => setEntryEndText(normalizeFourDigitTimeInput(e.target.value))}
                    placeholder={
                      isTransitCategory ? "예: 09:30 (05:00~28:30)" : "비워두면 끝 시간 없음 · 예: 09:30"
                    }
                    className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
                  />
                </label>
              </>
            ) : null}
            <label className="col-span-2">
              <div className="mb-1 text-xs text-slate-400">카테고리(필수)</div>
              <div className="flex items-center gap-3">
                <CategoryCardPreview category={entryCategory} />
                <select
                  value={entryCategory}
                  onChange={(e) => {
                    const v = e.target.value;
                    const prev = entryCategory.trim();
                    const nextCat = v.trim();
                    if (nextCat === "교통1" && prev !== "교통1") {
                      setTransitLegs([emptyTransit1Leg()]);
                    }
                    if (nextCat === "교통2" && prev !== "교통2") {
                      setEntryStartText("");
                      setEntryEndText("");
                      setTransit2SegmentsDraft((segs) =>
                        segs.length
                          ? segs.map((s) => ({ ...s, start: "", end: "" }))
                          : [{ dayKey: composeDayKey, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }]
                      );
                    }
                    setEntryCategory(v);
                  }}
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
                legs={transitLegs as any}
                setLegs={setTransitLegs as any}
                requestConfirm={requestConfirm}
                openStationSearch={(legIndex, field) => {
                  onOpenStationSearch(legIndex, field);
                }}
                openBusStopSearch={(legIndex, field) => {
                  onOpenBusStopSearch(legIndex, field);
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

            {composeKind === "expense" ? (
              <>
                {!isTransit1 ? (
                  <label className="col-span-2">
                    <div className="mb-1 text-xs text-slate-400">결제처(필수)</div>
                    <input
                      value={exMerchant}
                      onChange={(e) => setExMerchant(e.target.value)}
                      placeholder="예: CGV / 편의점 / 택시"
                      className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                    />
                  </label>
                ) : null}
                {!isTransit1 ? (
                  <label className="col-span-2">
                    <div className="mb-1 text-xs text-slate-400">내용(필수)</div>
                    <input
                      value={entryTitle}
                      onChange={(e) => setEntryTitle(e.target.value)}
                      placeholder="예: 교통 이동시간 / 영화 / 헬스 / 오늘 뭐했는지"
                      className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                    />
                  </label>
                ) : null}
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="min-w-0 space-y-2">
                    <div className="mb-1 text-xs text-slate-400">결제자(필수)</div>
                    <div className="flex gap-2">
                      {(["나", "기타"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-3 text-sm font-semibold shadow-sm",
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
                        className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="mb-1 text-xs text-slate-400">지출 유형(필수)</div>
                    <div className="flex gap-2">
                      {[
                        { key: "PERSONAL" as const, label: "개인" },
                        { key: "SHARED" as const, label: "공동" }
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-3 text-sm font-semibold shadow-sm",
                            expenseScope === t.key
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 bg-white text-slate-800"
                          )}
                          onClick={() => {
                            setExpenseScope(t.key);
                            if (t.key === "SHARED") setExpenseCompanionsText("");
                            else setSharedNamesText("");
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {expenseScope === "SHARED" ? (
                      <input
                        value={sharedNamesText}
                        onChange={(e) => setSharedNamesText(e.target.value)}
                        placeholder="나눔 인원 (필수) · 예: 나,철수,영희"
                        className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                      />
                    ) : null}
                  </div>
                </div>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">세부 내용</div>
                  <input
                    value={exDetail}
                    onChange={(e) => setExDetail(e.target.value)}
                    placeholder="예: 팝콘, 콜라 / 영등포→서울역"
                    className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
                  />
                </label>
                {expenseScope === "PERSONAL" ? (
                  <label className="col-span-2">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
                      <UsersIcon className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
                      함께한 사람
                    </div>
                    <input
                      value={expenseCompanionsText}
                      onChange={(e) => setExpenseCompanionsText(e.target.value)}
                      placeholder="쉼표로 구분 예: 철수, 영희"
                      className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
                    />
                  </label>
                ) : null}
                {!isTransit1 ? (
                  <label className="col-span-2">
                    <div className="mb-1 text-xs text-slate-400">금액(필수)</div>
                    <input
                      inputMode="numeric"
                      value={exAmount}
                      onChange={(e) => setExAmount(formatAmountInputWithCommas(e.target.value))}
                      placeholder={isTransitCategory ? "예: 교통비" : "예: 12000"}
                      className={cn("w-full rounded-xl bg-white px-3 py-3 text-base", fieldBorderClass({ required: true }))}
                    />
                  </label>
                ) : null}
              </>
            ) : (
              <>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">제목(필수)</div>
                  <input
                    value={entryTitle}
                    onChange={(e) => setEntryTitle(e.target.value)}
                    placeholder="예: 강남역 최가네"
                    className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                  />
                </label>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">내용(필수)</div>
                  <input
                    value={entryNote}
                    onChange={(e) => setEntryNote(e.target.value)}
                    placeholder="예: 최가네, 할리스"
                    className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                  />
                </label>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">세부 내용</div>
                  <input
                    value={exDetail}
                    onChange={(e) => setExDetail(e.target.value)}
                    placeholder="예: 좌석 G14 / 예매번호"
                    className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
                  />
                </label>
                <label className="col-span-2">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
                    <UsersIcon className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
                    함께한 사람
                  </div>
                  <input
                    value={schedulePeopleText}
                    onChange={(e) => setSchedulePeopleText(e.target.value)}
                    placeholder="쉼표로 구분 예: 나,철수"
                    className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
                  />
                </label>
              </>
            )}

            {composeKind === "schedule" ? (
              <>
                <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-3"
                    onClick={() => setScheduleWithExpense((v) => !v)}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded border",
                          scheduleWithExpense
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 bg-white text-transparent"
                        )}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="text-sm font-semibold text-slate-900">비용도 함께 기록</span>
                    </div>
                  </button>
                  {scheduleWithExpense ? (
                    <div className="mt-3 space-y-3">
                      <label className="block">
                        <div className="mb-1 text-xs text-slate-400">결제 시각</div>
                        <input
                          value={schedulePayTimeText}
                          onChange={(e) => setSchedulePayTimeText(normalizeFourDigitTimeInput(e.target.value))}
                          placeholder="비우면 일정 시작과 동일"
                          className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
                        />
                      </label>
                      {!isTransit1 ? (
                        <label className="block">
                          <div className="mb-1 text-xs text-slate-400">결제처(필수)</div>
                          <input
                            value={exMerchant}
                            onChange={(e) => setExMerchant(e.target.value)}
                            placeholder="예: CGV / 편의점 / 택시"
                            className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                          />
                        </label>
                      ) : null}
                      <label className="block">
                        <div className="mb-1 text-xs text-slate-400">내용(필수)</div>
                        <input
                          value={scheduleExpenseTitle}
                          onChange={(e) => setScheduleExpenseTitle(e.target.value)}
                          placeholder="예: 점심 / 택시 / 항공권 수수료"
                          className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0 space-y-2">
                          <div className="mb-1 text-xs text-slate-400">결제자(필수)</div>
                          <div className="flex gap-2">
                            {(["나", "기타"] as const).map((p) => (
                              <button
                                key={p}
                                type="button"
                                className={cn(
                                  "flex-1 rounded-xl border px-3 py-3 text-sm font-semibold shadow-sm",
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
                              className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="mb-1 text-xs text-slate-400">지출 유형(필수)</div>
                          <div className="flex gap-2">
                            {[
                              { key: "PERSONAL" as const, label: "개인" },
                              { key: "SHARED" as const, label: "공동" }
                            ].map((t) => (
                              <button
                                key={t.key}
                                type="button"
                                className={cn(
                                  "flex-1 rounded-xl border px-3 py-3 text-sm font-semibold shadow-sm",
                                  expenseScope === t.key
                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                    : "border-slate-200 bg-white text-slate-800"
                                )}
                                onClick={() => {
                                  setExpenseScope(t.key);
                                  if (t.key === "SHARED") setExpenseCompanionsText("");
                                  else setSharedNamesText("");
                                }}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                          {expenseScope === "SHARED" ? (
                            <input
                              value={sharedNamesText}
                              onChange={(e) => setSharedNamesText(e.target.value)}
                              placeholder="나눔 인원 (필수) · 예: 나,철수,영희"
                              className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }))}
                            />
                          ) : null}
                        </div>
                      </div>
                      <label className="block">
                        <div className="mb-1 text-xs text-slate-400">세부 내용</div>
                        <input
                          value={exDetail}
                          onChange={(e) => setExDetail(e.target.value)}
                          placeholder="예: 팝콘, 콜라 / 영등포→서울역"
                          className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
                        />
                      </label>
                      {expenseScope === "PERSONAL" ? (
                        <label className="block">
                          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
                            <UsersIcon className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
                            함께한 사람
                          </div>
                          <input
                            value={expenseCompanionsText}
                            onChange={(e) => setExpenseCompanionsText(e.target.value)}
                            placeholder="쉼표로 구분 예: 철수, 영희"
                            className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
                          />
                        </label>
                      ) : null}
                      {!isTransit1 ? (
                        <label className="block">
                          <div className="mb-1 text-xs text-slate-400">금액(필수)</div>
                          <input
                            inputMode="numeric"
                            value={exAmount}
                            onChange={(e) => setExAmount(formatAmountInputWithCommas(e.target.value))}
                            placeholder={isTransitCategory ? "예: 교통비" : "예: 12000"}
                            className={cn("w-full rounded-xl bg-white px-3 py-3 text-base", fieldBorderClass({ required: true }))}
                          />
                        </label>
                      ) : null}
                      <div className="space-y-2">
                        <div className="mb-1 text-xs text-slate-400">결제 수단(필수)</div>
                        <div className="flex flex-wrap gap-2">
                          {PAYMENT_TYPE_OPTIONS.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              className={cn(
                                "flex-1 min-w-[4.5rem] rounded-xl border px-3 py-3 text-sm font-semibold shadow-sm",
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
                                ? "카드 이름"
                                : exPaymentType === "ACCOUNT"
                                  ? "이체 메모"
                                  : "기타 결제수단 이름(필수)"
                            }
                            className={cn(
                              "w-full rounded-xl bg-white px-3 py-3 text-sm",
                              fieldBorderClass({ required: exPaymentType === "ETC" })
                            )}
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
                      {/* 결제처는 카테고리 아래(필수) 입력으로 통일 */}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {composeKind === "expense" ? (
              <>
                <div className="col-span-2 space-y-2">
                  <div className="mb-1 text-xs text-slate-400">결제 수단(필수)</div>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={cn(
                          "flex-1 min-w-[4.5rem] rounded-xl border px-3 py-3 text-sm font-semibold shadow-sm",
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
                          ? "카드 이름"
                          : exPaymentType === "ACCOUNT"
                            ? "이체 메모 예: 토스/계좌"
                            : "기타 결제수단 이름(필수)"
                      }
                      className={cn(
                              "w-full rounded-xl bg-white px-3 py-3 text-sm",
                              fieldBorderClass({ required: exPaymentType === "ETC" })
                            )}
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

                {/* 결제처는 카테고리 아래 입력으로 이동 */}
              </>
            ) : null}
          </div>
    </div>
  );
}
