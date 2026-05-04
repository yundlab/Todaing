export type SettlementRecord = {
  paidAtLocal: string;
  method: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export function settlementRecordKey(day: string, other: string): string {
  return `day:${day}::${other}`;
}

export function normalizeLegacySettlementMethod(m: unknown): string {
  const v = typeof m === "string" ? m.trim() : "";
  if (!v) return "카뱅";
  if (v === "TRANSFER") return "계좌이체";
  if (v === "CASH") return "현금";
  if (v === "CARD") return "카드";
  if (v === "ETC") return "기타";
  return v;
}
