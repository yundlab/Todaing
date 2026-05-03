/** 금액 입력창용: 콤마·단위 제거 후 양의 정수만 허용 */
export function parseAmountInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replaceAll(",", "").replaceAll(" ", "");
  const digitsOnly = cleaned.replace(/[^\d]/g, "");
  if (!digitsOnly) return null;
  const n = Number(digitsOnly);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0) return null;
  return i;
}

/** 금액 입력창용: 숫자만 남기고 콤마 포맷으로 되돌려준다. */
export function formatAmountInputWithCommas(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const digits = trimmed.replaceAll(",", "").replaceAll(" ", "").replace(/[^\d]/g, "");
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return Math.trunc(n).toLocaleString();
}
