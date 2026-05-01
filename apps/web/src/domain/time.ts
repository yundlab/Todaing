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

