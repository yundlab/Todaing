import { useState } from "react";
import type { Expense } from "@/features/expenses/api";

const DEFAULT_START = "";
const DEFAULT_END = "";
const DEFAULT_CATEGORY = "교통1";

/**
 * 지출/일정 작성 시트(compose)에서 쓰는 폼 상태 묶음.
 * - 14개의 useState를 한 훅으로 캡슐화하고, reset()으로 일괄 초기화.
 * - 기존 변수명/세터명을 그대로 노출해 호출부 변경을 최소화.
 */
export function useExpenseComposeForm() {
  const [entryStartText, setEntryStartText] = useState(DEFAULT_START);
  const [entryEndText, setEntryEndText] = useState(DEFAULT_END);
  const [entryCategory, setEntryCategory] = useState(DEFAULT_CATEGORY);
  const [entryTitle, setEntryTitle] = useState("");
  const [entryNote, setEntryNote] = useState("");

  const [exMerchant, setExMerchant] = useState("");
  const [exDetail, setExDetail] = useState("");
  const [exAmount, setExAmount] = useState("");
  const [exPaymentType, setExPaymentType] = useState<Expense["paymentType"]>("CARD");
  const [exPaymentLabel, setExPaymentLabel] = useState("");

  const [payerPreset, setPayerPreset] = useState<"나" | "기타">("나");
  const [payerOther, setPayerOther] = useState("");
  const [expenseScope, setExpenseScope] = useState<"PERSONAL" | "SHARED">("PERSONAL");
  const [sharedNamesText, setSharedNamesText] = useState("");
  /** 개인 지출: 동행·함께 쓴 사람 (선택, 결제자와 별도 저장) */
  const [expenseCompanionsText, setExpenseCompanionsText] = useState("");
  const [exInstallment, setExInstallment] = useState(false);
  const [exInstallmentMonths, setExInstallmentMonths] = useState(2);
  const [exInstallmentNoInterest, setExInstallmentNoInterest] = useState(false);

  /** 「+ 다른 날 사용」블록 표시 */
  const [plannedAtEnabled, setPlannedAtEnabled] = useState(false);
  const [plannedUsageDayKey, setPlannedUsageDayKey] = useState("");
  const [plannedUsageStartText, setPlannedUsageStartText] = useState("");
  const [plannedUsageEndText, setPlannedUsageEndText] = useState("");
  const [plannedUsageTitle, setPlannedUsageTitle] = useState("");
  const [plannedUsageContent, setPlannedUsageContent] = useState("");
  const [plannedUsageDetail, setPlannedUsageDetail] = useState("");
  const [plannedUsageCompanionsText, setPlannedUsageCompanionsText] = useState("");

  /** 작성 완료/취소 후 폼 리셋 */
  function reset() {
    setEntryStartText(DEFAULT_START);
    setEntryEndText(DEFAULT_END);
    setEntryCategory(DEFAULT_CATEGORY);
    setEntryTitle("");
    setEntryNote("");
    setExAmount("");
    setExMerchant("");
    setExDetail("");
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
    setPlannedAtEnabled(false);
    setPlannedUsageDayKey("");
    setPlannedUsageStartText("");
    setPlannedUsageEndText("");
    setPlannedUsageTitle("");
    setPlannedUsageContent("");
    setPlannedUsageDetail("");
    setPlannedUsageCompanionsText("");
  }

  return {
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

    reset
  };
}
