import { yyyyMmDdLocal } from "@/domain/date";
import { normalizeCategory } from "@/domain/categoryUi";
import type { Expense } from "@/features/expenses/api";

/** 정류장명이 한글에 붙은 경우 읽기 쉬운 공백 삽입 (예: 서울역버스환승센) */
export function prettifyTransitPlaceName(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  if (s.includes("서울역버스환승센")) s = s.replace(/서울역버스환승센/g, "서울역 버스 환승센");
  s = s.replace(/([가-힣])버스환/g, "$1 버스 환");
  return s;
}

/** 결제일과 다른 날의 교통2 구간(segment) — `viewerDayKey`가 그 구간의 dayKey일 때 */
/** 결제일(`occurredAt` 날짜)과 `dayKey`가 다른 교통2 구간만(실이용 구간). 정렬: 날짜 → 출발시각 */
export function transit2OffPaymentUsageSegments(
  expense: Pick<Expense, "category" | "occurredAt" | "transitSegments">
): Record<string, unknown>[] {
  if (normalizeCategory(expense.category) !== "교통2") return [];
  const occurredDay = yyyyMmDdLocal(new Date(expense.occurredAt));
  const seg = expense.transitSegments;
  if (!Array.isArray(seg)) return [];
  const out: Record<string, unknown>[] = [];
  for (const raw of seg) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const dk = typeof o.dayKey === "string" ? o.dayKey.trim() : "";
    if (!dk || dk === occurredDay) continue;
    out.push(o);
  }
  const startMinutes = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    if (!m) return 0;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  out.sort((a, b) => {
    const da = String(a.dayKey ?? "");
    const db = String(b.dayKey ?? "");
    if (da !== db) return da < db ? -1 : da > db ? 1 : 0;
    return startMinutes(String(a.start ?? "")) - startMinutes(String(b.start ?? ""));
  });
  return out;
}

export function findTransit2SegmentForViewerDay(
  expense: Pick<Expense, "category" | "occurredAt" | "transitSegments">,
  viewerDayKey: string
): Record<string, unknown> | null {
  if (normalizeCategory(expense.category) !== "교통2") return null;
  const occurredDay = yyyyMmDdLocal(new Date(expense.occurredAt));
  if (!viewerDayKey || viewerDayKey === occurredDay) return null;
  const seg = expense.transitSegments;
  if (!Array.isArray(seg)) return null;
  for (const raw of seg) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const dk = typeof o.dayKey === "string" ? o.dayKey : null;
    if (dk === viewerDayKey && dk !== occurredDay) return o;
  }
  return null;
}

export function transit2SegmentRouteLabel(o: Record<string, unknown>): string {
  const from = prettifyTransitPlaceName(String(o.from ?? "").trim());
  const to = prettifyTransitPlaceName(String(o.to ?? "").trim());
  if (from || to) return `${from || "?"} → ${to || "?"}`;
  return "이동";
}

export function transit2SegmentTimeRangeLine(o: Record<string, unknown>): string {
  const start = String(o.start ?? "").trim();
  const end = String(o.end ?? "").trim();
  if (start && end) return `${start}~${end}`;
  return start || end || "—";
}

export function transit2SegmentMemoLine(o: Record<string, unknown>): string {
  return String(o.memo ?? "").trim();
}

/**
 * 타임라인·오늘 상세 등 카드 하단 메모: 구간 `memo` 우선, 없으면 지출 `memo`에서
 * 해당 구간(또는 상위) 경로 접두(`A → B ·`)를 제거한 뒤만 표시(예: NH868).
 */
export function transit2UsageMemoForCard(
  expense: Pick<Expense, "memo" | "transitFrom" | "transitTo">,
  seg: Record<string, unknown>
): string {
  const memoRaw = String(seg.memo ?? "").trim();
  const memoTextLegacy = String((seg as { memoText?: unknown }).memoText ?? "").trim();
  const fromSeg = memoRaw || memoTextLegacy;
  if (fromSeg) return fromSeg;

  const top = (expense.memo ?? "").trim();
  if (!top) return "";

  const sf = String(seg.from ?? "").trim();
  const st = String(seg.to ?? "").trim();
  let rest = "";
  if (sf && st) {
    rest = stripTransitRoutePrefix(top, sf, st).trim();
  }
  if (!rest || rest === top) {
    rest = stripTransitRoutePrefix(top, expense.transitFrom ?? null, expense.transitTo ?? null).trim();
  }
  return (rest || top).trim();
}

/** 세부 내용에서 노출용으로 경로 접두어를 뗀다. */
export function stripTransitRoutePrefix(detail: string, transitFrom: string | null, transitTo: string | null) {
  const d = (detail ?? "").trim();
  if (!d) return detail;
  const from = (transitFrom ?? "").trim();
  const to = (transitTo ?? "").trim();
  const route = from && to ? `${from} → ${to}` : "";
  if (!route) return detail;
  const prefix1 = `${route} · `;
  const prefix2 = `${route}·`;
  if (d.startsWith(prefix1)) return d.slice(prefix1.length);
  if (d.startsWith(prefix2)) return d.slice(prefix2.length);
  return detail;
}
