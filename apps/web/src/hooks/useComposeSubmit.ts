import type { Expense, ExpenseCreateInput } from "../features/expenses/api";
import type { ScheduleItem, ScheduleCreateInput } from "../features/schedules/api";
import { parseFlexibleTimeToMinutes } from "../domain/time";
import { dateFromSlotMinutes } from "../domain/date";
import { normalizeCategory, emojiForCategory } from "../domain/categoryUi";
import { buildTransitPayload, type TransitLeg, type Transit2SegmentDraft } from "../domain/transitPayload";
import { encodeScheduleNote } from "../domain/scheduleNote";
import { parseAmountInput } from "../domain/parseAmountInput";
import { sharedParticipantsAll } from "../domain/settlement";

export type ComposeSubmitArgs = {
  category: string;
  title: string;
  startMin: number;
  convertFromExpenseId: string | null;
  convertFromScheduleId: string | null;
};

/** 카드 할부 정보를 mutation 입력에 합칠 수 있도록 정규화. */
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
  return { installment: true, installmentMonths: m, installmentNoInterest: noInterest };
}

/** Compose 시트의 폼 state·변환자·뮤테이션을 받아 4가지 저장 흐름을 노출한다. */
type Mutate<TVars, TData> = (_vars: TVars) => Promise<TData>;

export type UseComposeSubmitDeps = {
  // mutateAsync 메서드들
  createExpense: Mutate<ExpenseCreateInput, Expense>;
  updateExpense: Mutate<{ id: string; input: Partial<ExpenseCreateInput> }, Expense>;
  createSchedule: Mutate<ScheduleCreateInput, ScheduleItem>;
  updateSchedule: Mutate<{ id: string; input: Partial<ScheduleCreateInput> }, ScheduleItem>;
  deleteExpense: Mutate<string, void>;
  deleteSchedule: Mutate<string, void>;

  // 작성 폼 상태
  entryStartText: string;
  entryEndText: string;
  entryCategory: string;
  entryNote: string;
  exMerchant: string;
  exDetail: string;
  exAmount: string;
  exPaymentType: Expense["paymentType"];
  exPaymentLabel: string;
  exTransitMode: string;
  exTransitFromText: string;
  exTransitToText: string;
  transitLegs: TransitLeg[];
  payerPreset: "나" | "기타";
  payerOther: string;
  expenseScope: "PERSONAL" | "SHARED";
  sharedNamesText: string;
  exInstallment: boolean;
  exInstallmentMonths: number;
  exInstallmentNoInterest: boolean;
  plannedAtEnabled: boolean;
  plannedAtLocal: string;
  schedulePeopleText: string;
  schedulePayTimeText: string;
  scheduleExpenseTitle: string;
  scheduleWithExpense: boolean;
  scheduleShowOnCalendar: boolean;
  transit2SegmentsDraft: Transit2SegmentDraft[];
  composeDayLocal00: Date;
  composeEditExpenseId: string | null;
  composeEditScheduleId: string | null;

  // 액션
  handleComposeClose: () => void;
  // eslint-disable-next-line no-unused-vars
  setComposeConvertFromExpenseId: (id: string | null) => void;
  // eslint-disable-next-line no-unused-vars
  setComposeConvertFromScheduleId: (id: string | null) => void;
};

export function useComposeSubmit(deps: UseComposeSubmitDeps) {
  const {
    createExpense,
    updateExpense,
    createSchedule,
    updateSchedule,
    deleteExpense,
    deleteSchedule,
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
    transit2SegmentsDraft,
    composeDayLocal00,
    composeEditExpenseId,
    composeEditScheduleId,
    handleComposeClose,
    setComposeConvertFromExpenseId,
    setComposeConvertFromScheduleId
  } = deps;

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
    const note = encodeScheduleNote(schedulePeopleText, mergedNote, exDetail);
    try {
      await updateSchedule({
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
      const merchantTrim = exMerchant.trim();
      if (catNorm !== "교통1" && !merchantTrim) {
        window.alert("결제처를 입력해줘.");
        return;
      }
      const expenseTitleTrim = scheduleExpenseTitle.trim();
      if (!expenseTitleTrim) {
        window.alert("내용을 입력해줘.");
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

      const merchantFinal = merchantTrim ? merchantTrim : null;

      try {
        await createExpense({
          occurredAt,
          endAt,
          amount,
          category: catNorm,
          merchant: merchantFinal,
          detail: exDetail.trim() ? exDetail.trim() : null,
          memo: expenseTitleTrim,
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
    const catNorm = normalizeCategory(category);
    if (exPaymentType === "ETC" && !exPaymentLabel.trim()) {
      window.alert("기타 결제수단 이름을 입력해줘.");
      return;
    }
    const merchantTrim = exMerchant.trim();
    if (catNorm !== "교통1" && !merchantTrim) {
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
    const memoText = title.trim();
    const detailOnly = exDetail.trim();
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
      await updateExpense({
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
          detail: detailOnly ? detailOnly : null,
          memo: memoText ? memoText : null,
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
    const scheduleNote = encodeScheduleNote(schedulePeopleText, mergedNote, exDetail);

    try {
      await createSchedule({
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
      const merchantTrim = exMerchant.trim();
      if (catNorm !== "교통1" && !merchantTrim) {
        window.alert("결제처를 입력해줘.");
        return;
      }
      const expenseTitleTrim = scheduleExpenseTitle.trim();
      if (!expenseTitleTrim) {
        window.alert("내용을 입력해줘.");
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

      const merchantFinal = merchantTrim ? merchantTrim : null;

      try {
        await createExpense({
          occurredAt,
          endAt,
          amount,
          category,
          merchant: merchantFinal,
          detail: exDetail.trim() ? exDetail.trim() : null,
          memo: expenseTitleTrim,
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
      await deleteExpense(convertFromExpenseId);
      setComposeConvertFromExpenseId(null);
    }
    handleComposeClose();
  }

  async function submitNewExpense(args: ComposeSubmitArgs) {
    const { category, title, startMin, convertFromScheduleId } = args;
    const catNorm = normalizeCategory(category);
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
    if (catNorm !== "교통1" && !merchantTrim) {
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

    const memoText = title.trim();
    const detailOnly = exDetail.trim();

    try {
      await createExpense({
        occurredAt: startAt,
        endAt,
        amount,
        category: catNorm,
        merchant: merchantTrim ? merchantTrim : null,
        detail: detailOnly ? detailOnly : null,
        memo: memoText ? memoText : null,
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
      await deleteSchedule(convertFromScheduleId);
      setComposeConvertFromScheduleId(null);
    }
    handleComposeClose();
  }

  return {
    submitEditSchedule,
    submitEditExpense,
    submitNewSchedule,
    submitNewExpense
  };
}
