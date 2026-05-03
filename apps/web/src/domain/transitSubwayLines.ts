import type { Station } from "@/features/transit/stations";

function sortKo(list: string[]) {
  return [...list].sort((a, b) => a.localeCompare(b, "ko"));
}

/** 출발·도착 역이 가질 수 있는 호선 후보(교집합 우선, 없으면 합집합). */
export function subwayLinePool(from: Station | null, to: Station | null): string[] {
  const a = from?.lines ?? [];
  const b = to?.lines ?? [];
  if (!a.length && !b.length) return [];
  if (!a.length) return sortKo(b);
  if (!b.length) return sortKo(a);
  const inter = a.filter((l) => b.includes(l));
  const raw = inter.length > 0 ? inter : [...new Set([...a, ...b])];
  return sortKo(raw);
}

export type SubwayLinePickContext = {
  /** 직전 지하철 구간에서 선택된 호선(환승 시 다른 노선을 우선하도록 사용) */
  prevLine?: string | null;
  /** 이 구간 출발역이 직전 구간 도착역과 같은 역(환승)인지 */
  transferFromPrev?: boolean;
};

/**
 * 환승 직후 구간에서 직전 구간과 같은 호선이 후보에 있으면 목록 뒤로 보냅니다.
 * (예: 분당으로 선릉 도착 후 선릉→삼성은 2호선이 앞에 오도록)
 * 같은 호선만 이어지는 경우에는 후보가 비지 않도록 원 순서를 유지합니다.
 */
export function orderSubwayLineChoices(pool: string[], ctx: SubwayLinePickContext): string[] {
  const sorted = sortKo(pool);
  const prev = ctx.prevLine?.trim() ?? "";
  if (!ctx.transferFromPrev || !prev || sorted.length <= 1 || !sorted.includes(prev)) {
    return sorted;
  }
  const rest = sorted.filter((l) => l !== prev);
  if (!rest.length) return sorted;
  return [...rest, prev];
}

/** 자동 선택: 단일 후보 또는 기존 값 유지, 그 외에는 정렬된 목록의 첫 값 */
export function pickSubwayLineForPool(
  pool: string[],
  ctx: SubwayLinePickContext,
  currentLine: string
): string {
  const ordered = orderSubwayLineChoices(pool, ctx);
  if (ordered.length === 0) return "";
  if (ordered.length === 1) return ordered[0]!;
  const cur = currentLine.trim();
  if (cur && ordered.includes(cur)) return cur;
  return ordered[0]!;
}
