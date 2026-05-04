import type { Expense } from "@/features/expenses/api";
import { yyyyMmDdLocal, yyyyMmLocal } from "@/domain/date";
import { normalizeCategory } from "@/domain/categoryUi";

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 결제일(occurredAt)과 다른 dayKey를 가진 교통2 구간만 순회.
 * 메인 타임라인·오늘 상세·월 상세에서 동일 규칙을 재사용한다.
 */
export function eachTransit2OffPaymentSegment(
  all: Expense[],
  scope: { kind: "day"; dayKey: string } | { kind: "month"; monthKey: string },
  fn: (ctx: { expense: Expense; segment: Record<string, unknown>; segmentDayKey: string }) => void
): void {
  for (const expense of all) {
    if (normalizeCategory(expense.category) !== "교통2") continue;
    const segs = expense.transitSegments;
    if (!Array.isArray(segs) || !segs.length) continue;
    const occurredDay = yyyyMmDdLocal(new Date(expense.occurredAt));
    for (const raw of segs) {
      const segment = raw as Record<string, unknown>;
      const dk = typeof segment.dayKey === "string" ? segment.dayKey.trim() : "";
      if (!dk || !DAY_KEY_RE.test(dk)) continue;
      if (occurredDay === dk) continue;
      if (scope.kind === "day") {
        if (dk !== scope.dayKey) continue;
      } else {
        if (yyyyMmLocal(new Date(`${dk}T00:00:00`)) !== scope.monthKey) continue;
      }
      fn({ expense, segment, segmentDayKey: dk });
    }
  }
}
