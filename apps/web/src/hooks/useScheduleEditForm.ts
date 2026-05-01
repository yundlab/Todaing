import { useState } from "react";
import type { Expense } from "../features/expenses/api";

const DEFAULT_START = "09:00";
const DEFAULT_END = "09:30";
const DEFAULT_CATEGORY = "기타";

/**
 * 일정 수정 시트(schedule edit)에서 쓰는 폼 상태 묶음.
 * - 12개의 useState를 한 훅으로 캡슐화.
 */
export function useScheduleEditForm() {
  const [editSchedStart, setEditSchedStart] = useState(DEFAULT_START);
  const [editSchedEnd, setEditSchedEnd] = useState(DEFAULT_END);
  const [editSchedCategory, setEditSchedCategory] = useState(DEFAULT_CATEGORY);
  const [editSchedTitle, setEditSchedTitle] = useState("");
  const [editSchedNote, setEditSchedNote] = useState("");
  const [editSchedAmount, setEditSchedAmount] = useState("");
  const [editSchedPaymentType, setEditSchedPaymentType] = useState<Expense["paymentType"]>("CARD");
  const [editSchedPaymentLabel, setEditSchedPaymentLabel] = useState("");
  const [editSchedPayerPreset, setEditSchedPayerPreset] = useState<"나" | "기타">("나");
  const [editSchedPayerOther, setEditSchedPayerOther] = useState("");
  const [editSchedExpenseScope, setEditSchedExpenseScope] = useState<"PERSONAL" | "SHARED">(
    "PERSONAL"
  );
  const [editSchedSharedNamesText, setEditSchedSharedNamesText] = useState("");

  return {
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
  };
}
