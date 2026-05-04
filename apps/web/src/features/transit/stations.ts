import type { CapitalMetroStation } from "@/features/transit/stations.generated";

export type Station = CapitalMetroStation;

let stationsCache: Station[] | null = null;
let loadPromise: Promise<Station[]> | null = null;

const SEARCH_CACHE_MAX = 64;
const searchCache = new Map<string, Station[]>();
const searchCacheOrder: string[] = [];

function touchSearchCacheKey(key: string) {
  const i = searchCacheOrder.indexOf(key);
  if (i >= 0) searchCacheOrder.splice(i, 1);
  searchCacheOrder.push(key);
  while (searchCacheOrder.length > SEARCH_CACHE_MAX) {
    const oldest = searchCacheOrder.shift();
    if (oldest) searchCache.delete(oldest);
  }
}

function clearSearchCaches() {
  searchCache.clear();
  searchCacheOrder.length = 0;
}

/**
 * 수도권 역 목록을 별도 청크로 한 번만 로드하고 메모리에 캐시합니다.
 * 앱 셸 마운트 시 미리 호출하면 역 검색·교통1 복원 시 레이스가 줄어듭니다.
 */
export function loadCapitalMetroStations(): Promise<Station[]> {
  if (stationsCache) return Promise.resolve(stationsCache);
  if (loadPromise) return loadPromise;
  loadPromise = import("@/features/transit/stations.generated").then((m) => {
    stationsCache = m.CAPITAL_AREA_STATIONS;
    clearSearchCaches();
    return stationsCache;
  });
  return loadPromise;
}

/** 로드 완료 후에만 배열 반환. 미로드 시 `null`. */
export function getCapitalMetroStationsSync(): Station[] | null {
  return stationsCache;
}

/**
 * 이미 로드된 `stations` 배열 기준으로 역 이름 검색.
 * 검색어(소문자·trim) 단위로 결과를 LRU 캐시합니다.
 */
export function searchStationsCached(query: string, stations: Station[]): Station[] {
  const key = query.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit) {
    touchSearchCacheKey(key);
    return hit;
  }

  const q = query.trim();
  let res: Station[];
  if (!q) {
    res = [...stations];
  } else {
    const lower = key;
    res = stations.filter((s) => s.name.toLowerCase().includes(lower));
  }

  searchCache.set(key, res);
  touchSearchCacheKey(key);
  return res;
}
