import type { Expense } from "@/features/expenses/api";
import { dateFromSlotMinutes, pad2 } from "@/domain/date";
import { plannedUsageDayKeyWhenDiffers } from "@/domain/expenseDayUsage";
import { prettifyTransitPlaceName, transit2UsageMemoForCard } from "@/domain/expenseTransitText";
import { normalizeCategory } from "@/domain/categoryUi";

/** 해당 날짜에 교통2 구간 카드가 이미 있으면 true (plannedAt 보조 행과 중복 방지) */
export function transit2HasUsageSegmentOnDay(e: Expense, dayKey: string): boolean {
  if (normalizeCategory(e.category || "") !== "교통2") return false;
  const seg = e.transitSegments;
  if (!Array.isArray(seg)) return false;
  for (const raw of seg) {
    if (!raw || typeof raw !== "object") continue;
    const dk = String((raw as { dayKey?: unknown }).dayKey ?? "").trim();
    if (dk === dayKey) return true;
  }
  return false;
}

/**
 * 결제일과 다른 실제 사용일(plannedAt)인 지출을 해당 이용일에 표시할 때 공통 슬라이스.
 * - 일반 카테고리: 기존 타임라인과 동일
 * - 교통2: 구간 `dayKey`가 이용일과 맞는 행이 없을 때만(구간만 잘못 저장된 경우) 보조 행
 */
export type PlannedUsageDaySlice = {
  startMs: number;
  expense: Expense;
  label: string;
  startText: string;
  endText: string;
  /** 교통2 이용 카드 하단 메모 */
  usageMemo: string;
  /** 오늘 일정 패널 등 한 줄 요약 */
  scheduleMemo: string;
  usageTransitMode?: string;
};

export function plannedUsageDaySlices(dayKey: string, all: Expense[], dayLocal00: Date): PlannedUsageDaySlice[] {
  const out: PlannedUsageDaySlice[] = [];
  for (const e of all) {
    const usageDay = plannedUsageDayKeyWhenDiffers(e);
    if (!usageDay || usageDay !== dayKey) continue;
    const cat = normalizeCategory(e.category || "");
    if (cat === "교통2" && transit2HasUsageSegmentOnDay(e, dayKey)) continue;

    const pd = new Date(e.plannedAt!);
    const m = pd.getHours() * 60 + pd.getMinutes();
    const startMs = dateFromSlotMinutes(dayLocal00, m).getTime();
    const startText = `${pad2(pd.getHours())}:${pad2(pd.getMinutes())}`;
    let endText = "";
    if (e.plannedEndAt) {
      const pe = new Date(e.plannedEndAt);
      endText = `${pad2(pe.getHours())}:${pad2(pe.getMinutes())}`;
    }

    const pm = (e.plannedMemo ?? "").trim();
    const pc = (e.plannedContent ?? "").trim();

    let label = "";
    if (cat === "교통2") {
      const from = (e.transitFrom ?? "").trim();
      const to = (e.transitTo ?? "").trim();
      label =
        from || to
          ? `${prettifyTransitPlaceName(from) || "?"} → ${prettifyTransitPlaceName(to) || "?"}`
          : (e.subject ?? "").trim() || (e.merchant ?? "").trim() || "이동";
    } else {
      const subject = (e.subject ?? "").trim();
      const merchant = (e.merchant ?? "").trim();
      const memo = (e.memo ?? "").trim();
      label = subject || pm || pc || merchant || memo || cat || "기타";
    }

    let usageMemo = "";
    let usageTransitMode: string | undefined;
    if (cat === "교통2") {
      const seg = e.transitSegments;
      const first =
        Array.isArray(seg) && seg[0] && typeof seg[0] === "object"
          ? (seg[0] as Record<string, unknown>)
          : {};
      usageMemo = transit2UsageMemoForCard(e, first);
      const mode =
        (e.transitMode ?? "").trim() ||
        (typeof first.mode === "string" ? String(first.mode).trim() : "");
      if (mode) usageTransitMode = mode;
    } else {
      usageMemo = "";
    }

    const scheduleMemo = pc || pm || (e.memo ?? "").trim();

    out.push({
      startMs,
      expense: e,
      label,
      startText,
      endText,
      usageMemo,
      scheduleMemo,
      ...(usageTransitMode ? { usageTransitMode } : {})
    });
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

/** `HH:mm` + dayKey → 정렬용 ms (당일 00:00 기준 로컬) */
export function localDayTimeToMs(dayKey: string, hhmm: string): number {
  const t = hhmm.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return 0;
  const d = new Date(`${dayKey}T00:00:00`);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}
