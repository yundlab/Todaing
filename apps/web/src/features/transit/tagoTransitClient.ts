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
  /** 서울 ws.bus.go.kr 노선이면 `seoul` — 정류장 조회 시 `provider=seoul` */
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
  const data = await http<{ routes: TagoRouteSummary[] }>(`/api/transit/tago/routes-broad?${q.toString()}`);
  return data.routes ?? [];
}

export async function fetchTagoRouteStops(
  cityCode: string,
  routeId: string,
  opts?: { transitProvider?: "tago" | "seoul" }
): Promise<TagoBusStop[]> {
  const q = new URLSearchParams({ cityCode, routeId });
  if (opts?.transitProvider === "seoul") q.set("provider", "seoul");
  const data = await http<{ stops: TagoBusStop[] }>(`/api/transit/tago/route-stops?${q.toString()}`);
  return data.stops ?? [];
}
