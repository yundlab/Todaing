/** 금액 입력창용: 콤마·단위 제거 후 양의 정수만 허용 */
export function parseAmountInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const cleaned = trimmed.replaceAll(",", "").replaceAll(" ", "");
  const digitsOnly = cleaned.replace(/[^\d]/g, "");
  if (!digitsOnly) return null;
  const n = Number(digitsOnly);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0) return null;
  return i;
}
