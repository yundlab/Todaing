import { CAPITAL_AREA_STATIONS, type CapitalMetroStation } from "./stations.generated";

export type Station = CapitalMetroStation;

/** 수도권 전철 역(검색용). `stations.generated.ts`는 `node scripts/build-capital-metro-stations.mjs`로 갱신. */
export const STATIONS: Station[] = CAPITAL_AREA_STATIONS;

/** 검색어가 비어 있으면 `STATIONS` 전체. 있으면 이름 부분 일치 전부(스크롤). */
export function searchStations(query: string): Station[] {
  const q = query.trim();
  if (!q) return [...STATIONS];
  const lower = q.toLowerCase();
  return STATIONS.filter((s) => s.name.toLowerCase().includes(lower));
}
