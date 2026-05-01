import { useState } from "react";
import type { Expense } from "../features/expenses/api";

const DEFAULT_START = "09:00";
const DEFAULT_END = "09:30";
const DEFAULT_CATEGORY = "식비";

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

  /** 작성 완료/취소 후 폼 리셋 */
  function reset() {
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

    reset
  };
}
