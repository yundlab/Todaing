export function formatCalendarWon(n: number) {
  const v = Math.round(Number(n) || 0);
  if (!Number.isFinite(v) || v === 0) return "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const x = Math.round((v / 10_000) * 10) / 10;
    return `${x}만`;
  }
  if (abs >= 100_000) {
    const x = Math.round((v / 10_000) * 10) / 10;
    return `${x}만`;
  }
  return v.toLocaleString();
}
