/**
 * 서울 열린데이터광장 OpenAPI — `openapi.seoul.go.kr:8088`
 * @see https://data.seoul.go.kr/dataList/OA-1095/A/1/datasetView.do (서울시 버스 노선 정보 조회)
 *
 * - `busRoute`(열린데이터광장 [OA-15262](https://data.seoul.go.kr/dataList/OA-15262/S/1/datasetView.do) 등과 동일 시트):
 *   `RTE_NM`·`RTE_ID` 위주 — 공개 샘플에도 기·종점 컬럼이 없어, 기종점은 정류장 시트에서 집계합니다.
 * - `busRteInfo`(우선): 노선별 정류소 시트 — `busRouteInfo`와 동종인데 샘플·키 조합에 따라 한쪽만 500이 나올 수 있음.
 * - `busRouteInfo`: 위와 동일 데이터 폴백.
 * - **정류장 목록**: `ws.bus.go.kr` `getStaionByRoute`(노선 ID만) 우선 → 실패 시 위 시트 스캔.
 * - **서울 노선번호 검색**: `ws.bus.go.kr` `getBusRouteList?strSrch=` 우선(한 번의 XML) → 비면 열린데이터·TAGO 폴백.
 *   (열린데이터 `busRouteInfo` 문서의 `busRouteId`·`routeList` 는 **노선 ID 상세**용이며, 번호 검색과는 다른 API입니다.)
 */

import { env } from "./env.js";

export type SeoulBusRouteRow = {
  busRouteId: string;
  busRouteNm: string;
  routeTypeRaw: string;
  routeTypeLabel: string;
  stStationNm: string;
  edStationNm: string;
};

type SeoulBusStopRow = {
  seq: number;
  stationNo: string;
  stationNm: string;
  stationId: string;
  /** 서울 API `transYn` — `Y` 이면 회차지(종점 대신 표시에 사용) */
  transYn?: string;
};

function isSeoulTurnaroundStop(transYn: string | undefined): boolean {
  if (transYn == null || transYn === "") return false;
  const v = transYn.trim().toUpperCase();
  return v === "Y" || v === "1";
}

/**
 * 기점 = 최소 seq 정류장, **우측(종점 자리)** = 순서상 첫 `회차지(transYn=Y)` 가 있으면 그 명칭, 없으면 최대 seq(막차 방향 종점).
 */
function terminiStationNamesFromStops(stops: SeoulBusStopRow[]): { first: string; last: string } {
  if (!stops.length) return { first: "", last: "" };
  const sorted = [...stops].sort((a, b) => a.seq - b.seq || a.stationId.localeCompare(b.stationId));
  const seqs = sorted.map((s) => s.seq).filter((n) => Number.isFinite(n) && n > 0);
  if (!seqs.length) {
    const a = sorted[0]!;
    const b = sorted[sorted.length - 1]!;
    return { first: a.stationNm, last: b.stationNm };
  }
  const minSeq = Math.min(...seqs);
  const maxSeq = Math.max(...seqs);
  const firstRow = sorted.find((s) => s.seq === minSeq) ?? sorted[0]!;
  const turnaround = sorted.find((s) => isSeoulTurnaroundStop(s.transYn));
  if (turnaround?.stationNm?.trim()) {
    return { first: firstRow.stationNm, last: turnaround.stationNm.trim() };
  }
  let lastRow = sorted[0]!;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i]!.seq === maxSeq) {
      lastRow = sorted[i]!;
      break;
    }
  }
  return { first: firstRow.stationNm, last: lastRow.stationNm };
}

const PAGE_SIZE = 1000;
const OPEN_BASE = "http://openapi.seoul.go.kr:8088";

/** @see http://api.bus.go.kr/contents/sub02/getStaionByRoute.html */
const WS_BUS_GET_STATION = "https://ws.bus.go.kr/api/rest/busRouteInfo/getStaionByRoute";
/** @see http://api.bus.go.kr/contents/sub02/getBusRouteList.html */
const WS_BUS_GET_ROUTE_LIST = "https://ws.bus.go.kr/api/rest/busRouteInfo/getBusRouteList";

function seoulWsRouteTypeLabel(code: string): string {
  const c = code.trim();
  const m: Record<string, string> = {
    "1": "공항",
    "2": "마을",
    "3": "간선",
    "4": "지선",
    "5": "순환",
    "6": "광역",
    "7": "인천",
    "8": "경기",
    "9": "폐지",
    "10": "관광",
    "13": "동행",
    "14": "한강",
    "15": "심야",
    "0": "공용"
  };
  return m[c] ?? (c ? `노선유형(${c})` : "");
}

function wsBusServiceKeyQuery(key: string): string {
  const k = key.trim().replace(/^["']|["']$/g, "");
  return /%[0-9A-Fa-f]{2}/.test(k) ? k : encodeURIComponent(k);
}

function seoulWsBusDisabled(): boolean {
  const v = (env.SEOUL_WS_BUS_DISABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function wsBusGetText(url: string, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/xml, text/xml, */*" },
      signal: ctrl.signal
    });
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

/** WS가 `<![CDATA[ ... ]]>` 안에 실제 XML을 넣는 경우가 있어 태그 매칭 전에 펼침 */
function expandWsCdataSections(xml: string): string {
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, (_, inner: string) => String(inner));
}

/** 응답에 `<item>` / `<busRoute>` 등 노선·정류 레코드 블록이 섞여 올 수 있음 */
function extractWsRecordBlocks(xml: string, tags: readonly string[]): string[] {
  const blocks: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const body = m[1]!.trim();
      if (!body || seen.has(body)) continue;
      seen.add(body);
      blocks.push(body);
    }
  }
  return blocks;
}

const WS_BUS_ROUTE_RECORD_TAGS = ["item", "busRoute"] as const;
/** 공식 샘플은 `itemList` > `busRoute` 조합이 많고, 일부 응답은 `msgBody`·`routeList` 래퍼만 다름 */
function extractWsBusRouteRecordBlocks(xml: string): string[] {
  const flat = extractWsRecordBlocks(xml, WS_BUS_ROUTE_RECORD_TAGS);
  if (flat.length) return flat;

  const wrappers = ["itemList", "busRouteList", "routeList", "msgBody"] as const;
  for (const w of wrappers) {
    for (const chunk of extractWsRecordBlocks(xml, [w])) {
      const inner = extractWsRecordBlocks(chunk, WS_BUS_ROUTE_RECORD_TAGS);
      if (inner.length) return inner;
    }
  }
  return [];
}

/** `getStaionByRoute` — 레코드는 `<item>` 위주, `itemList`·`msgBody` 안에만 있을 수 있음 */
function extractWsStationItemBlocks(xml: string): string[] {
  let items = extractWsRecordBlocks(xml, ["item"]);
  if (items.length) return items;
  const wrappers = ["itemList", "msgBody", "stationList"] as const;
  for (const w of wrappers) {
    for (const chunk of extractWsRecordBlocks(xml, [w])) {
      items = extractWsRecordBlocks(chunk, ["item"]);
      if (items.length) return items;
    }
  }
  return [];
}

function xmlTagContent(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** `busRouteId` 한 개로 경유 정류장 — 열린데이터 시트 전체 스캔보다 훨씬 적은 왕복 */
async function fetchSeoulBusStationsByRouteWs(
  serviceKey: string,
  busRouteId: string
): Promise<SeoulBusStopRow[]> {
  const rid = busRouteId.trim();
  if (!rid || !serviceKey.trim() || seoulWsBusDisabled()) return [];

  const url = `${WS_BUS_GET_STATION}?serviceKey=${wsBusServiceKeyQuery(serviceKey)}&busRouteId=${encodeURIComponent(rid)}`;
  const textRaw = await wsBusGetText(url, env.SEOUL_WS_FETCH_TIMEOUT_MS);
  if (textRaw == null) return [];
  const text = expandWsCdataSections(textRaw);

  const headerCd = text.match(/<headerCd>([^<]+)<\/headerCd>/i)?.[1]?.trim();
  if (headerCd !== undefined && headerCd !== "" && headerCd !== "0") {
    return [];
  }

  const items = extractWsStationItemBlocks(text);
  if (!items.length) return [];

  const rows: SeoulBusStopRow[] = [];
  for (const block of items) {
    const seqRaw = xmlTagContent(block, "seq");
    const sn = Number.parseInt(seqRaw, 10);
    const stationNm = xmlTagContent(block, "stationNm");
    const stationNo = xmlTagContent(block, "stationNo") || xmlTagContent(block, "arsId");
    const stationId = xmlTagContent(block, "station") || stationNo;
    const transYn = xmlTagContent(block, "transYn");
    if (!stationNm && !stationNo) continue;
    rows.push({
      seq: Number.isFinite(sn) && sn > 0 ? sn : rows.length + 1,
      stationNo,
      stationNm,
      stationId: stationId || stationNo,
      ...(transYn ? { transYn } : {})
    });
  }

  rows.sort((a, b) => a.seq - b.seq);
  return rows;
}

export type SeoulWsBusRouteListReason =
  | "ok"
  | "ws_disabled"
  | "missing_key_or_query"
  | "timeout_or_network"
  | "ws_api_error"
  | "zero_items";

export type SeoulWsBusRouteListDiag = {
  rows: SeoulBusRouteRow[];
  reason: SeoulWsBusRouteListReason;
  headerCd: string | null;
  headerMsg: string | null;
};

/** 노선번호 `strSrch` 로 서울 노선 목록 — 진단 필드는 WS-only·디버깅용 */
export async function fetchSeoulBusRouteListWsDetailed(
  serviceKey: string,
  strSrch: string
): Promise<SeoulWsBusRouteListDiag> {
  const q = strSrch.trim();
  const key = serviceKey.trim();
  if (seoulWsBusDisabled()) {
    return { rows: [], reason: "ws_disabled", headerCd: null, headerMsg: null };
  }
  if (!q || !key) {
    return { rows: [], reason: "missing_key_or_query", headerCd: null, headerMsg: null };
  }

  const url = `${WS_BUS_GET_ROUTE_LIST}?serviceKey=${wsBusServiceKeyQuery(key)}&strSrch=${encodeURIComponent(q)}`;
  const textRaw = await wsBusGetText(url, env.SEOUL_WS_FETCH_TIMEOUT_MS);
  if (textRaw == null) {
    return { rows: [], reason: "timeout_or_network", headerCd: null, headerMsg: null };
  }
  const text = expandWsCdataSections(textRaw);

  const headerCd = text.match(/<headerCd>([^<]+)<\/headerCd>/i)?.[1]?.trim() ?? null;
  const headerMsg = text.match(/<headerMsg>([^<]+)<\/headerMsg>/i)?.[1]?.trim() ?? null;
  if (headerCd !== null && headerCd !== "" && headerCd !== "0") {
    return { rows: [], reason: "ws_api_error", headerCd, headerMsg };
  }

  const items = extractWsBusRouteRecordBlocks(text);

  const out: SeoulBusRouteRow[] = [];
  for (const block of items) {
    const busRouteId = xmlTagContent(block, "busRouteId");
    const busRouteNm = xmlTagContent(block, "busRouteNm") || xmlTagContent(block, "busRouteAbrv");
    if (!busRouteId) continue;
    const routeTypeRaw = xmlTagContent(block, "routeType");
    out.push({
      busRouteId,
      busRouteNm: busRouteNm || q,
      routeTypeRaw,
      routeTypeLabel: seoulWsRouteTypeLabel(routeTypeRaw),
      stStationNm: xmlTagContent(block, "stStationNm"),
      edStationNm: xmlTagContent(block, "edStationNm")
    });
  }

  if (!out.length) {
    return { rows: [], reason: "zero_items", headerCd: headerCd ?? null, headerMsg };
  }
  return { rows: out, reason: "ok", headerCd: headerCd ?? null, headerMsg };
}

/** 노선번호 `strSrch` 로 서울 노선 목록 — 열린데이터 시트·TAGO 다건 호출보다 한 번에 가져옴 */
export async function fetchSeoulBusRouteListWs(serviceKey: string, strSrch: string): Promise<SeoulBusRouteRow[]> {
  return (await fetchSeoulBusRouteListWsDetailed(serviceKey, strSrch)).rows;
}

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

async function fetchSeoulOpenBusRouteInfoPage(
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
  seqTransYn: Map<number, string>;
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

  const pagePromises = Array.from({ length: maxPages }, (_, i) => {
    const p = i + 1;
    const start = (p - 1) * PAGE_SIZE + 1;
    const end = p * PAGE_SIZE;
    return fetchSeoulOpenBusRouteListPage(apiKey, start, end);
  });
  const packs = await Promise.all(pagePromises);

  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i]!;
    const p = i + 1;
    const end = p * PAGE_SIZE;
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
  opts?: {
    deepRoutes?: number;
    maxPagesPerRoute?: number;
    waveSize?: number;
    /** 기·종점 보강할 노선 상한. 미지정 시 `deepRoutes` 또는 24 */
    enrichMaxRoutes?: number;
  }
): Promise<void> {
  const targets = routes.filter(
    (r) => r.busRouteId.trim() && (!r.stStationNm?.trim() || !r.edStationNm?.trim())
  );
  if (!targets.length) return;

  const n = Math.min(120, Math.max(1, opts?.enrichMaxRoutes ?? opts?.deepRoutes ?? 24));
  const deepMaxPages = Math.min(120, Math.max(8, opts?.maxPagesPerRoute ?? 48));
  const wave = Math.min(10, Math.max(2, opts?.waveSize ?? 8));

  const runWave = async (slice: SeoulBusRouteRow[]) => {
    await Promise.all(
      slice.map(async (r) => {
        try {
          const stops = await fetchSeoulOpenBusStationsByRouteId(apiKey, r.busRouteId.trim(), {
            maxPages: deepMaxPages
          });
          if (!stops.length) return;
          const { first, last } = terminiStationNamesFromStops(stops);
          if (!r.stStationNm?.trim()) r.stStationNm = first;
          if (!r.edStationNm?.trim()) r.edStationNm = last;
        } catch {
          /* 무시 */
        }
      })
    );
  };

  const list = targets.slice(0, n);
  for (let i = 0; i < list.length; i += wave) {
    await runWave(list.slice(i, i + wave));
  }
}

/** TAGO로 기종점을 채운 뒤에도 비어 있으면 시트 스캔으로 보강할 때 사용 */
export async function enrichSeoulBusRouteTermini(
  apiKey: string,
  routes: SeoulBusRouteRow[],
  opts?: {
    deepRoutes?: number;
    maxPagesPerRoute?: number;
    waveSize?: number;
    enrichMaxRoutes?: number;
  }
): Promise<void> {
  await enrichSeoulRoutesTerminiFromBusRouteInfo(apiKey, routes, opts);
}

/** 노선번호(부분 문자열)에 맞는 서울 노선 목록 — `busRoute` 마스터 우선, 없으면 `busRouteInfo` 일부 순회. */
export async function searchSeoulOpenDataBusRoutesByRouteNo(
  apiKey: string,
  strSrch: string,
  opts?: { maxPages?: number; maxRoutes?: number; enrichTermini?: boolean }
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
      if (opts?.enrichTermini !== false) {
        try {
          await enrichSeoulRoutesTerminiFromBusRouteInfo(apiKey, fromMaster, {
            deepRoutes: 6,
            maxPagesPerRoute: 72
          });
        } catch {
          /* 기종점 없이 목록만 */
        }
      }
      return fromMaster;
    }
  } catch {
    /* 마스터 실패 시 아래 busRouteInfo 순회로 폴백 */
  }

  const byRoute = new Map<string, RouteAgg>();
  const PAGE_BATCH = 6;

  for (let startPage = 1; startPage <= maxPages; startPage += PAGE_BATCH) {
    const endPage = Math.min(maxPages, startPage + PAGE_BATCH - 1);
    const batch = await Promise.all(
      Array.from({ length: endPage - startPage + 1 }, (_, j) => {
        const p = startPage + j;
        const start = (p - 1) * PAGE_SIZE + 1;
        const end = p * PAGE_SIZE;
        return fetchSeoulOpenBusRouteInfoPage(apiKey, start, end);
      })
    );

    let stop = false;
    for (let j = 0; j < batch.length; j++) {
      const pack = batch[j]!;
      const p = startPage + j;
      const end = p * PAGE_SIZE;
      if (pack.resultCode !== "INFO-000") {
        const err = new Error(pack.resultMessage || `Seoul open data ${pack.resultCode}`);
        (err as Error & { status: number }).status = 502;
        throw err;
      }
      if (!pack.rows.length) {
        stop = true;
        break;
      }

      for (const row of pack.rows) {
        const routeId = readField(row, "ROUTE_ID", "routeId", "RTE_ID", "rteId");
        const routeNm = readField(row, "RTE_NM", "rteNm", "ROUTE_NM");
        if (!routeId || !needleMatchesRouteName(routeNm, needle)) continue;

        let agg = byRoute.get(routeId);
        if (!agg) {
          agg = { routeId, routeNm, seqStation: new Map(), seqTransYn: new Map() };
          byRoute.set(routeId, agg);
        }
        const snRaw = readField(row, "SN", "sn", "SEQ");
        const sn = Number.parseInt(snRaw, 10);
        const stNm = readField(row, "STATION_NM", "stationNm", "NODE_NM");
        const transYnRow = readField(row, "TRANS_YN", "transYn", "TRNSTN_YN", "TRNSTNYN");
        if (Number.isFinite(sn) && sn > 0 && stNm) {
          agg.seqStation.set(sn, stNm);
          if (transYnRow.trim()) agg.seqTransYn.set(sn, transYnRow);
        }
      }

      if (byRoute.size >= maxRoutes) {
        stop = true;
        break;
      }
      if (pack.listTotal > 0 && end >= pack.listTotal) {
        stop = true;
        break;
      }
    }
    if (stop) break;
  }

  const out: SeoulBusRouteRow[] = [];
  for (const agg of byRoute.values()) {
    const sns = [...agg.seqStation.keys()].sort((a, b) => a - b);
    const st = sns.length ? agg.seqStation.get(sns[0]!) ?? "" : "";
    let ed = "";
    for (const snk of sns) {
      if (isSeoulTurnaroundStop(agg.seqTransYn.get(snk))) {
        ed = agg.seqStation.get(snk) ?? "";
        break;
      }
    }
    if (!ed && sns.length) ed = agg.seqStation.get(sns[sns.length - 1]!) ?? "";
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
const SEOUL_STOP_PAGE_PARALLEL = 6;

async function fetchSeoulOpenBusStationsByRouteIdUncached(
  apiKey: string,
  routeId: string,
  opts?: { maxPages?: number }
): Promise<SeoulBusStopRow[]> {
  const rid = routeId.trim();
  if (!rid) return [];

  // WS는 전용키가 있을 때만 시도 (열린데이터광장 키를 ws.bus.go.kr에 재사용하지 않음)
  const wsKey = (env.SEOUL_BUS_WS_SERVICE_KEY ?? "").trim();
  if (wsKey) {
    try {
      const wsRows = await fetchSeoulBusStationsByRouteWs(wsKey, rid);
      if (wsRows.length > 0) return wsRows;
    } catch {
      void 0;
    }
  }

  const maxPages = Math.min(160, Math.max(1, opts?.maxPages ?? 55));
  const rows: SeoulBusStopRow[] = [];

  for (let startPage = 1; startPage <= maxPages; startPage += SEOUL_STOP_PAGE_PARALLEL) {
    const endPage = Math.min(maxPages, startPage + SEOUL_STOP_PAGE_PARALLEL - 1);
    let batch: BusRouteInfoPayload[];
    try {
      batch = await Promise.all(
        Array.from({ length: endPage - startPage + 1 }, (_, j) => {
          const p = startPage + j;
          const start = (p - 1) * PAGE_SIZE + 1;
          const end = p * PAGE_SIZE;
          return fetchSeoulOpenBusRouteInfoPage(apiKey, start, end);
        })
      );
    } catch {
      break;
    }

    let stop = false;
    for (let j = 0; j < batch.length; j++) {
      const pack = batch[j]!;
      const p = startPage + j;
      const end = p * PAGE_SIZE;
      if (pack.resultCode !== "INFO-000") {
        stop = true;
        break;
      }
      if (!pack.rows.length) {
        stop = true;
        break;
      }

      for (const row of pack.rows) {
        const routeIdRow = readField(row, "ROUTE_ID", "routeId", "RTE_ID", "rteId").trim();
        if (routeIdRow !== rid) continue;
        const snRaw = readField(row, "SN", "sn", "SEQ");
        const sn = Number.parseInt(snRaw, 10);
        const stationNm = readField(row, "STATION_NM", "stationNm");
        const stationId = readField(row, "NODE_ID", "nodeId", "STATION_ID");
        const stationNo = readField(row, "ARS_ID", "arsId", "STATION_NO");
        const transYn = readField(row, "TRANS_YN", "transYn", "TRNSTN_YN", "TRNSTNYN");
        if (!stationNm && !stationNo) continue;
        rows.push({
          seq: Number.isFinite(sn) && sn > 0 ? sn : rows.length + 1,
          stationNo,
          stationNm,
          stationId: stationId || stationNo,
          ...(transYn ? { transYn } : {})
        });
      }

      if (pack.listTotal > 0 && end >= pack.listTotal) {
        stop = true;
        break;
      }
    }
    if (stop) break;
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
