/** YYYY-MM 두 달 사이의 월 차이 (같으면 0). */
export function monthIndexDiff(fromMonthKey: string, toMonthKey: string) {
  const fy = Number(fromMonthKey.slice(0, 4));
  const fm = Number(fromMonthKey.slice(5, 7));
  const ty = Number(toMonthKey.slice(0, 4));
  const tm = Number(toMonthKey.slice(5, 7));
  if (!Number.isFinite(fy) || !Number.isFinite(fm) || !Number.isFinite(ty) || !Number.isFinite(tm)) return 0;
  return (ty - fy) * 12 + (tm - fm);
}
