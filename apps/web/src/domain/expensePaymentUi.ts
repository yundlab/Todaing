import type { Expense } from "../features/expenses/api";

export const PAYMENT_TYPE_LABEL: Record<Expense["paymentType"], string> = {
  CARD: "카드",
  CASH: "현금",
  ACCOUNT: "계좌",
  ETC: "기타"
};

export const PAYMENT_TYPE_OPTIONS: Array<{ key: Expense["paymentType"]; label: string }> = [
  { key: "CARD", label: "카드" },
  { key: "CASH", label: "현금" },
  { key: "ACCOUNT", label: "이체" },
  { key: "ETC", label: "기타" }
];

export function chipClass(variant: "gray" | "orange" | "teal") {
  if (variant === "orange") return "bg-orange-50 text-orange-700 border-orange-100";
  if (variant === "teal") return "bg-indigo-50 text-indigo-700 border-indigo-100";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
