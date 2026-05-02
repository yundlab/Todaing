export function parseFlexibleTimeToMinutes(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;

  // Accept patterns:
  // - "9", "09" => hour only
  // - "930", "0930" => hhmm
  // - "9:30", "09:30"
  // - "24:10" ... "28:30" (next-day range)
  const cleaned = raw.replace(/\s+/g, "");
  const m1 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (m1) {
    const hh = Number(m1[1]);
    const mm = Number(m1[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (mm < 0 || mm >= 60) return null;
    const total = hh * 60 + mm;
    if (total < 0 || total > 28 * 60 + 30) return null;
    return total;
  }

  const digits = cleaned.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.length <= 2) {
    const hh = Number(digits);
    if (!Number.isFinite(hh)) return null;
    const total = hh * 60;
    if (total < 0 || total > 28 * 60 + 30) return null;
    return total;
  }
  if (digits.length === 3 || digits.length === 4) {
    const hh = Number(digits.slice(0, digits.length - 2));
    const mm = Number(digits.slice(-2));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (mm < 0 || mm >= 60) return null;
    const total = hh * 60 + mm;
    if (total < 0 || total > 28 * 60 + 30) return null;
    return total;
  }
  return null;
}

/** 콜론 없이 숫자 네 자리만 입력했을 때 `HH:mm`으로 바꿈(유효한 시각일 때만). */
export function normalizeFourDigitTimeInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes(":")) return input;
  if (!/^\d{4}$/.test(trimmed)) return input;
  const withColon = `${trimmed.slice(0, 2)}:${trimmed.slice(2)}`;
  if (parseFlexibleTimeToMinutes(withColon) === null) return input;
  return withColon;
}

