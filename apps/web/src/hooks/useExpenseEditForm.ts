import { useState } from "react";
import type { Expense } from "../features/expenses/api";

const DEFAULT_START = "09:00";
const DEFAULT_END = "09:30";
const DEFAULT_CATEGORY = "기타";

/**
 * 지출 수정 시트(expense edit)에서 쓰는 폼 상태 묶음.
 * - 12개의 useState를 한 훅으로 캡슐화.
 * - 시트를 열 때는 fillFromExpense(e)로 한 번에 초기값 셋팅.
 */
export function useExpenseEditForm() {
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState(DEFAULT_CATEGORY);
  const [editMerchant, setEditMerchant] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editTimeText, setEditTimeText] = useState(DEFAULT_START);
  const [editEndTimeText, setEditEndTimeText] = useState(DEFAULT_END);
  const [editPaymentType, setEditPaymentType] = useState<Expense["paymentType"]>("CARD");
  const [editPaymentLabel, setEditPaymentLabel] = useState("");
  const [editPayerPreset, setEditPayerPreset] = useState<"나" | "기타">("나");
  const [editPayerOther, setEditPayerOther] = useState("");
  const [editExpenseScope, setEditExpenseScope] = useState<"PERSONAL" | "SHARED">("PERSONAL");
  const [editSharedNamesText, setEditSharedNamesText] = useState("");

  return {
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
  };
}
