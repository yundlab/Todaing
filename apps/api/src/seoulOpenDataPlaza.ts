/**
 * 서울 열린데이터광장 OpenAPI — `openapi.seoul.go.kr:8088`
 * @see https://data.seoul.go.kr/dataList/OA-1095/A/1/datasetView.do (서울시 버스 노선 정보 조회)
 *
 * - `busRoute`(열린데이터광장 [OA-15262](https://data.seoul.go.kr/dataList/OA-15262/S/1/datasetView.do) 등과 동일 시트):
 *   `RTE_NM`·`RTE_ID` 위주 — 공개 샘플에도 기·종점 컬럼이 없어, 기종점은 정류장 시트에서 집계합니다.
 * - `busRteInfo`(우선): 노선별 정류소 시트 — `busRouteInfo`와 동종인데 샘플·키 조합에 따라 한쪽만 500이 나올 수 있음.
 * - `busRouteInfo`: 위와 동일 데이터 폴백.
 */

export type SeoulBusRouteRow = {
  busRouteId: string;
  busRouteNm: string;
  routeTypeRaw: string;
  routeTypeLabel: string;
  stStationNm: string;
  edStationNm: string;
};

const PAGE_SIZE = 1000;
const OPEN_BASE = "http://openapi.seoul.go.kr:8088";

function seoulOpenKeyInPath(key: string): string {
  const k = key.trim().replace(/^["']|["']$/g, "");
  /** 경로 세그먼트 — 이미 인코딩된 키(% 포함)는 그대로, 아니면 인코딩 */
  return /%[0-9A-Fa-f]{2}/.test(k) ? k : encodeURIComponent(k);
}

function readField(row: Record<string, unknown>, ...candidates: string[]): string {
  for (const c of candidates) {
    const v = row[c] ?? row[c.toUpperCase()] ?? row[c.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function asRowArray(raw: unknown): Record<string, unknown>[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  if (typeof raw === "object") return [raw as Record<string, unknown>];
  return [];
}

type BusRouteInfoPayload = {
  listTotal: number;
  rows: Record<string, unknown>[];
  resultCode: string;
  resultMessage: string;
};

/** 인증키마다 정류장 시트가 `busRteInfo`/`busRouteInfo` 중 어느 쪽이 되는지 한 번만 탐색 */
const seoulStopsSheetByKey = new Map<string, "busRteInfo" | "busRouteInfo">();

type SeoulBusStopRow = {
  seq: number;
  stationNo: string;
  stationNm: string;
  stationId: string;
};

/** 승차·하차에서 같은 노선을 반복 조회할 때 시트 전체 스캔을 줄이기 위한 캐시 */
const SEOUL_ROUTE_STOPS_TTL_MS = 25 * 60 * 1000;
const SEOUL_ROUTE_STOPS_CACHE_MAX = 48;
const seoulRouteStopsCache = new Map<string, { exp: number; stops: SeoulBusStopRow[] }>();
const seoulRouteStopsInflight = new Map<string, Promise<SeoulBusStopRow[]>>();

function evictSeoulRouteStopsCacheIfFull(): void {
  while (seoulRouteStopsCache.size >= SEOUL_ROUTE_STOPS_CACHE_MAX) {
    const k = seoulRouteStopsCache.keys().next().value;
    if (k === undefined) break;
    seoulRouteStopsCache.delete(k);
  }
}

/** `busRteInfo` / `busRouteInfo` 공통 — 루트 키만 다름 */
function parseBusStopsSheetJson(json: unknown, wrapKey: "busRteInfo" | "busRouteInfo"): BusRouteInfoPayload {
  const root = json as Record<string, unknown>;
  const topResult = root.RESULT as Record<string, unknown> | undefined;
  if (topResult) {
    const code = String(topResult.CODE ?? topResult.code ?? "");
    const msg = String(topResult.MESSAGE ?? topResult.message ?? "");
    if (code && code !== "INFO-000") {
      return { listTotal: 0, rows: [], resultCode: code, resultMessage: msg || code };
    }
  }

  const wrap = root[wrapKey] as Record<string, unknown> | undefined;
  if (!wrap || typeof wrap !== "object") {
    return { listTotal: 0, rows: [], resultCode: "PARSE", resultMessage: `${wrapKey} 본문 없음` };
  }

  const innerResult = wrap.RESULT as Record<string, unknown> | undefined;
  if (innerResult) {
    const code = String(innerResult.CODE ?? innerResult.code ?? "");
    const msg = String(innerResult.MESSAGE ?? innerResult.message ?? "");
    if (code && code !== "INFO-000") {
      return { listTotal: 0, rows: [], resultCode: code, resultMessage: msg || code };
    }
  }

  const totalRaw =
    wrap.list_total_count ?? wrap.LIST_TOTAL_COUNT ?? wrap.listTotalCount ?? wrap.total_count ?? 0;
  const listTotal =
    typeof totalRaw === "number" && Number.isFinite(totalRaw)
      ? Math.trunc(totalRaw)
      : Number.parseInt(String(totalRaw), 10) || 0;

  const rows = asRowArray(wrap.row ?? wrap.ROW);
  return { listTotal, rows, resultCode: "INFO-000", resultMessage: "ok" };
}

export async function fetchSeoulOpenBusRouteInfoPage(
  apiKey: string,
  start: number,
  end: number
): Promise<BusRouteInfoPayload> {
  const keySeg = seoulOpenKeyInPath(apiKey);
  const keyNorm = apiKey.trim();

  const tryOne = async (wrapKey: "busRteInfo" | "busRouteInfo"): Promise<BusRouteInfoPayload> => {
    const url = `${OPEN_BASE}/${keySeg}/json/${wrapKey}/${start}/${end}/`;
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return { listTotal: 0, rows: [], resultCode: "NON_JSON", resultMessage: text.slice(0, 200) };
    }
    return parseBusStopsSheetJson(json, wrapKey);
  };

  const cached = keyNorm ? seoulStopsSheetByKey.get(keyNorm) : undefined;
  if (cached) {
    const p = await tryOne(cached);
    if (p.resultCode === "INFO-000") return p;
    seoulStopsSheetByKey.delete(keyNorm);
  }

  const rte = await tryOne("busRteInfo");
  if (rte.resultCode === "INFO-000") {
    if (keyNorm) seoulStopsSheetByKey.set(keyNorm, "busRteInfo");
    return rte;
  }
  const legacy = await tryOne("busRouteInfo");
  if (legacy.resultCode === "INFO-000") {
    if (keyNorm) seoulStopsSheetByKey.set(keyNorm, "busRouteInfo");
    return legacy;
  }
  return rte.rows.length >= legacy.rows.length ? rte : legacy;
}

function parseBusRouteListJson(json: unknown): BusRouteInfoPayload {
  const root = json as Record<string, unknown>;
  const topResult = root.RESULT as Record<string, unknown> | undefined;
  if (topResult) {
    const code = String(topResult.CODE ?? topResult.code ?? "");
    const msg = String(topResult.MESSAGE ?? topResult.message ?? "");
    if (code && code !== "INFO-000") {
      return { listTotal: 0, rows: [], resultCode: code, resultMessage: msg || code };
    }
  }

  const wrap = root.busRoute as Record<string, unknown> | undefined;
  if (!wrap || typeof wrap !== "object") {
    return { listTotal: 0, rows: [], resultCode: "PARSE", resultMessage: "busRoute 본문 없음" };
  }

  const innerResult = wrap.RESULT as Record<string, unknown> | undefined;
  if (innerResult) {
    const code = String(innerResult.CODE ?? innerResult.code ?? "");
    const msg = String(innerResult.MESSAGE ?? innerResult.message ?? "");
    if (code && code !== "INFO-000") {
      return { listTotal: 0, rows: [], resultCode: code, resultMessage: msg || code };
    }
  }

  const totalRaw =
    wrap.list_total_count ?? wrap.LIST_TOTAL_COUNT ?? wrap.listTotalCount ?? wrap.total_count ?? 0;
  const listTotal =
    typeof totalRaw === "number" && Number.isFinite(totalRaw)
      ? Math.trunc(totalRaw)
      : Number.parseInt(String(totalRaw), 10) || 0;

  const rows = asRowArray(wrap.row ?? wrap.ROW);
  return { listTotal, rows, resultCode: "INFO-000", resultMessage: "ok" };
}

async function fetchSeoulOpenBusRouteListPage(
  apiKey: string,
  start: number,
  end: number
): Promise<BusRouteInfoPayload> {
  const keySeg = seoulOpenKeyInPath(apiKey);
  const url = `${OPEN_BASE}/${keySeg}/json/busRoute/${start}/${end}/`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    return { listTotal: 0, rows: [], resultCode: "NON_JSON", resultMessage: text.slice(0, 200) };
  }
  return parseBusRouteListJson(json);
}

type RouteAgg = {
  routeId: string;
  routeNm: string;
  seqStation: Map<number, string>;
};

function needleMatchesRouteName(routeNm: string, needle: string): boolean {
  const rawA = routeNm.trim();
  const rawB = needle.trim();
  const a = rawA.toLowerCase();
  const b = rawB.toLowerCase();
  if (!b) return false;
  if (a === b) return true;

  const allDigitNeedle = /^\d+$/.test(rawB);
  const allDigitRoute = /^\d+$/.test(rawA);

  /** 순수 숫자끼리는 `9401`에 `401`이 `includes`로 걸리지 않게 앞부분 번호로만 비교 */
  if (allDigitNeedle && allDigitRoute) {
    return Number.parseInt(rawA, 10) === Number.parseInt(rawB, 10);
  }

  if (allDigitNeedle) {
    const m = rawA.match(/^0*(\d+)/);
    if (!m) return false;
    const an = Number.parseInt(m[1], 10);
    const bn = Number.parseInt(rawB, 10);
    if (an !== bn) return false;
    const rest = rawA.slice(m[0].length);
    if (rest === "") return true;
    if (/^[^\d]/.test(rest)) return true;
    if (/^[-_\s(]/.test(rest)) return true;
    return false;
  }

  return a.includes(b) || b.includes(a);
}

async function searchSeoulOpenBusRouteListMaster(
  apiKey: string,
  needle: string,
  opts: { maxPages: number; maxRoutes: number }
): Promise<SeoulBusRouteRow[]> {
  const { maxPages, maxRoutes } = opts;
  const out: SeoulBusRouteRow[] = [];
  const seen = new Set<string>();

  for (let p = 1; p <= maxPages; p++) {
    const start = (p - 1) * PAGE_SIZE + 1;
    const end = p * PAGE_SIZE;
    const pack = await fetchSeoulOpenBusRouteListPage(apiKey, start, end);
    if (pack.resultCode !== "INFO-000") {
      const err = new Error(pack.resultMessage || `Seoul open data ${pack.resultCode}`);
      (err as Error & { status: number }).status = 502;
      throw err;
    }
    if (!pack.rows.length) break;

    for (const row of pack.rows) {
      if (out.length >= maxRoutes) break;
      const routeId = readField(row, "RTE_ID", "rteId", "ROUTE_ID", "routeId");
      const routeNm = readField(row, "RTE_NM", "rteNm", "ROUTE_NM");
      if (!routeId || seen.has(routeId) || !needleMatchesRouteName(routeNm, needle)) continue;
      seen.add(routeId);
      const st = readField(
        row,
        "ST_STA_NM",
        "stStaNm",
        "STATION_NM_ST",
        "F_STTN",
        "FIRST_STATION",
        "ORIGIN",
        "B_STTN_NM",
        "TERM1"
      );
      const ed = readField(
        row,
        "ED_STA_NM",
        "edStaNm",
        "STATION_NM_ED",
        "L_STTN",
        "LAST_STATION",
        "DEST",
        "DESTINATION",
        "E_STTN_NM",
        "TERM2"
      );
      const routeTypeRaw = readField(row, "RTE_TYP", "rteTyp", "ROUTE_TYP", "routeTyp");
      const routeTypeLabel = readField(row, "RTE_TYP_NM", "rteTypNm", "ROUTE_TYP_NM");
      out.push({
        busRouteId: routeId,
        busRouteNm: routeNm || needle,
        routeTypeRaw,
        routeTypeLabel,
        stStationNm: st,
        edStationNm: ed
      });
    }

    if (out.length >= maxRoutes) break;
    if (pack.listTotal > 0 && end >= pack.listTotal) break;
  }

  out.sort((a, b) => a.busRouteNm.localeCompare(b.busRouteNm, "ko"));
  return out;
}

/**
 * `busRoute` 마스터에는 기·종점이 없는 경우가 많아, `fetchSeoulOpenBusStationsByRouteId`로
 * `busRouteInfo` 시트를 충분히 훑어 첫·마지막 정류장명을 채웁니다.
 */
async function enrichSeoulRoutesTerminiFromBusRouteInfo(
  apiKey: string,
  routes: SeoulBusRouteRow[],
  opts?: { deepRoutes?: number; maxPagesPerRoute?: number }
): Promise<void> {
  const targets = routes.filter(
    (r) => r.busRouteId.trim() && (!r.stStationNm?.trim() || !r.edStationNm?.trim())
  );
  if (!targets.length) return;

  const n = Math.min(10, Math.max(1, opts?.deepRoutes ?? 8));
  const deepMaxPages = Math.min(100, Math.max(36, opts?.maxPagesPerRoute ?? 72));

  const runWave = async (slice: SeoulBusRouteRow[]) => {
    await Promise.all(
      slice.map(async (r) => {
        try {
          const stops = await fetchSeoulOpenBusStationsByRouteId(apiKey, r.busRouteId.trim(), {
            maxPages: deepMaxPages
          });
          if (!stops.length) return;
          if (!r.stStationNm?.trim()) r.stStationNm = stops[0]?.stationNm ?? "";
          if (!r.edStationNm?.trim()) r.edStationNm = stops[stops.length - 1]?.stationNm ?? "";
        } catch {
          /* 무시 */
        }
      })
    );
  };

  const list = targets.slice(0, n);
  for (let i = 0; i < list.length; i += 5) {
    await runWave(list.slice(i, i + 5));
  }
}

/** 노선번호(부분 문자열)에 맞는 서울 노선 목록 — `busRoute` 마스터 우선, 없으면 `busRouteInfo` 일부 순회. */
export async function searchSeoulOpenDataBusRoutesByRouteNo(
  apiKey: string,
  strSrch: string,
  opts?: { maxPages?: number; maxRoutes?: number }
): Promise<SeoulBusRouteRow[]> {
  const needle = strSrch.trim();
  if (!needle) return [];

  const maxPages = Math.min(60, Math.max(1, opts?.maxPages ?? 25));
  const maxRoutes = Math.min(120, Math.max(1, opts?.maxRoutes ?? 80));
  /** `busRoute` 마스터는 수백 건 수준이라 소량 페이지면 충분합니다. */
  const masterPages = 5;

  try {
    const fromMaster = await searchSeoulOpenBusRouteListMaster(apiKey, needle, {
      maxPages: masterPages,
      maxRoutes
    });
    if (fromMaster.length) {
      try {
        await enrichSeoulRoutesTerminiFromBusRouteInfo(apiKey, fromMaster, {
          deepRoutes: 8,
          maxPagesPerRoute: 72
        });
      } catch {
        /* 기종점 없이 목록만 */
      }
      return fromMaster;
    }
  } catch {
    /* 마스터 실패 시 아래 busRouteInfo 순회로 폴백 */
  }

  const byRoute = new Map<string, RouteAgg>();

  for (let p = 1; p <= maxPages; p++) {
    const start = (p - 1) * PAGE_SIZE + 1;
    const end = p * PAGE_SIZE;
    const pack = await fetchSeoulOpenBusRouteInfoPage(apiKey, start, end);
    if (pack.resultCode !== "INFO-000") {
      const err = new Error(pack.resultMessage || `Seoul open data ${pack.resultCode}`);
      (err as Error & { status: number }).status = 502;
      throw err;
    }
    if (!pack.rows.length) break;

    for (const row of pack.rows) {
      const routeId = readField(row, "ROUTE_ID", "routeId", "RTE_ID", "rteId");
      const routeNm = readField(row, "RTE_NM", "rteNm", "ROUTE_NM");
      if (!routeId || !needleMatchesRouteName(routeNm, needle)) continue;

      let agg = byRoute.get(routeId);
      if (!agg) {
        agg = { routeId, routeNm, seqStation: new Map() };
        byRoute.set(routeId, agg);
      }
      const snRaw = readField(row, "SN", "sn", "SEQ");
      const sn = Number.parseInt(snRaw, 10);
      const stNm = readField(row, "STATION_NM", "stationNm", "NODE_NM");
      if (Number.isFinite(sn) && sn > 0 && stNm) agg.seqStation.set(sn, stNm);
    }

    if (byRoute.size >= maxRoutes) break;
    if (pack.listTotal > 0 && end >= pack.listTotal) break;
  }

  const out: SeoulBusRouteRow[] = [];
  for (const agg of byRoute.values()) {
    const sns = [...agg.seqStation.keys()].sort((a, b) => a - b);
    const st = sns.length ? agg.seqStation.get(sns[0]!) ?? "" : "";
    const ed = sns.length ? agg.seqStation.get(sns[sns.length - 1]!) ?? "" : "";
    out.push({
      busRouteId: agg.routeId,
      busRouteNm: agg.routeNm || needle,
      routeTypeRaw: "",
      routeTypeLabel: "",
      stStationNm: st,
      edStationNm: ed
    });
    if (out.length >= maxRoutes) break;
  }

  out.sort((a, b) => a.busRouteNm.localeCompare(b.busRouteNm, "ko"));
  return out;
}

/** 특정 `ROUTE_ID` 의 정류장 목록 — 시트를 앞에서부터 훑어 일치 행만 모읍니다(상한 있음). */
async function fetchSeoulOpenBusStationsByRouteIdUncached(
  apiKey: string,
  routeId: string,
  opts?: { maxPages?: number }
): Promise<SeoulBusStopRow[]> {
  const rid = routeId.trim();
  if (!rid) return [];

  const maxPages = Math.min(160, Math.max(1, opts?.maxPages ?? 55));
  const rows: SeoulBusStopRow[] = [];

  for (let p = 1; p <= maxPages; p++) {
    const start = (p - 1) * PAGE_SIZE + 1;
    const end = p * PAGE_SIZE;
    let pack: BusRouteInfoPayload;
    try {
      pack = await fetchSeoulOpenBusRouteInfoPage(apiKey, start, end);
    } catch {
      break;
    }
    if (pack.resultCode !== "INFO-000") break;
    if (!pack.rows.length) break;

    for (const row of pack.rows) {
      const routeIdRow = readField(row, "ROUTE_ID", "routeId", "RTE_ID", "rteId").trim();
      if (routeIdRow !== rid) continue;
      const snRaw = readField(row, "SN", "sn", "SEQ");
      const sn = Number.parseInt(snRaw, 10);
      const stationNm = readField(row, "STATION_NM", "stationNm");
      const stationId = readField(row, "NODE_ID", "nodeId", "STATION_ID");
      const stationNo = readField(row, "ARS_ID", "arsId", "STATION_NO");
      if (!stationNm && !stationNo) continue;
      rows.push({
        seq: Number.isFinite(sn) && sn > 0 ? sn : rows.length + 1,
        stationNo,
        stationNm,
        stationId: stationId || stationNo
      });
    }

    if (pack.listTotal > 0 && end >= pack.listTotal) break;
  }

  rows.sort((a, b) => a.seq - b.seq);
  return rows;
}

export async function fetchSeoulOpenBusStationsByRouteId(
  apiKey: string,
  routeId: string,
  opts?: { maxPages?: number }
): Promise<SeoulBusStopRow[]> {
  const rid = routeId.trim();
  if (!rid) return [];

  const maxPages = Math.min(160, Math.max(1, opts?.maxPages ?? 55));
  const cacheKey = `${apiKey.trim()}|${rid}|p${maxPages}`;
  const now = Date.now();
  const hit = seoulRouteStopsCache.get(cacheKey);
  if (hit && hit.exp > now) {
    return hit.stops.map((s) => ({ ...s }));
  }

  let inflight = seoulRouteStopsInflight.get(cacheKey);
  if (!inflight) {
    inflight = (async () => {
      try {
        const stops = await fetchSeoulOpenBusStationsByRouteIdUncached(apiKey, rid, { maxPages });
        if (stops.length) {
          evictSeoulRouteStopsCacheIfFull();
          seoulRouteStopsCache.set(cacheKey, { exp: Date.now() + SEOUL_ROUTE_STOPS_TTL_MS, stops });
        }
        return stops;
      } finally {
        seoulRouteStopsInflight.delete(cacheKey);
      }
    })();
    seoulRouteStopsInflight.set(cacheKey, inflight);
  }

  return inflight.then((stops) => stops.map((s) => ({ ...s })));
}
