import { http } from "@/lib/http";

export type TagoCity = { cityCode: string; cityName: string };

export type TagoRouteSummary = {
  routeId: string;
  routeNo: string;
  routeType: string;
  startNode: string;
  endNode: string;
  /** `routes-broad`에서만 채워짐 — 정류장 조회 시 해당 cityCode 사용 */
  cityCode?: string;
  cityName?: string;
  /** 서울 열린데이터광장 노선이면 `seoul` — 정류장 조회 시 `provider=seoul` */
  transitProvider?: "tago" | "seoul";
};

export type TagoBusStop = {
  seq: number;
  nodeNo: string;
  nodeNm: string;
  nodeId: string;
};

export async function fetchTagoCityCodes(): Promise<TagoCity[]> {
  const data = await http<{ cities: TagoCity[] }>("/api/transit/tago/city-codes");
  return data.cities ?? [];
}

export async function searchTagoRoutes(cityCode: string, routeNo: string): Promise<TagoRouteSummary[]> {
  const q = new URLSearchParams({ cityCode, routeNo });
  const data = await http<{ routes: TagoRouteSummary[] }>(`/api/transit/tago/routes?${q.toString()}`);
  return data.routes ?? [];
}

/** 도시 미지정 시: 시·군·구 일부를 병렬로 훑어 노선을 모읍니다(응답에 cityCode·cityName 포함). */
export async function searchTagoRoutesBroad(routeNo: string): Promise<TagoRouteSummary[]> {
  const q = new URLSearchParams({ routeNo, maxCities: "200" });
  const data = await http<{ routes: TagoRouteSummary[] }>(`/api/transit/tago/routes-broad?${q.toString()}`, {
    timeoutMs: 120_000
  });
  return data.routes ?? [];
}

/** 승차 후 하차 등 같은 노선 정류장을 짧은 시간에 다시 부를 때 네트워크 반복을 줄입니다. */
const ROUTE_STOPS_CLIENT_TTL_MS = 12 * 60 * 1000;
const ROUTE_STOPS_CLIENT_MAX = 32;
const routeStopsClientMem = new Map<string, { at: number; stops: TagoBusStop[] }>();

function routeStopsClientKey(cityCode: string, routeId: string, provider: "tago" | "seoul" | undefined): string {
  return `${provider ?? "tago"}|${cityCode.trim()}|${routeId.trim()}`;
}

export async function fetchTagoRouteStops(
  cityCode: string,
  routeId: string,
  opts?: { transitProvider?: "tago" | "seoul" }
): Promise<TagoBusStop[]> {
  const p = opts?.transitProvider ?? "tago";
  const key = routeStopsClientKey(cityCode, routeId, p);
  const now = Date.now();
  const hit = routeStopsClientMem.get(key);
  if (hit && now - hit.at < ROUTE_STOPS_CLIENT_TTL_MS) {
    return hit.stops.map((s) => ({ ...s }));
  }

  const q = new URLSearchParams({ cityCode, routeId });
  if (p === "seoul") q.set("provider", "seoul");
  const data = await http<{ stops: TagoBusStop[] }>(`/api/transit/tago/route-stops?${q.toString()}`);
  const stops = data.stops ?? [];
  if (routeStopsClientMem.size >= ROUTE_STOPS_CLIENT_MAX) {
    const first = routeStopsClientMem.keys().next().value;
    if (first !== undefined) routeStopsClientMem.delete(first);
  }
  routeStopsClientMem.set(key, { at: now, stops });
  return stops.map((s) => ({ ...s }));
}
