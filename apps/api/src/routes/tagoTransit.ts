import { Router } from "express";
import { mergeTagoMetroFallback, tagoBusCityDisplayName } from "../tagoBusCityDisplay.js";
import { env } from "../env.js";
import {
  fetchSeoulOpenBusStationsByRouteId,
  searchSeoulOpenDataBusRoutesByRouteNo,
  type SeoulBusRouteRow
} from "../seoulOpenDataPlaza.js";

const TAGO_BASE = "https://apis.data.go.kr/1613000/BusRouteInfoInqireService";

function missingTagoServiceKeyHint(): string {
  if (process.env.NODE_ENV === "production") {
    return "버스 정류장 검색을 쓰려면 API 서버 호스트의 환경 변수 TAGO_SERVICE_KEY에 공공데이터포털(data.go.kr) 일반 인증키를 설정하세요.";
  }
  return "버스 공공 API를 쓰려면 apps/api/.env에 TAGO_SERVICE_KEY(공공데이터포털 인증키)를 설정하세요.";
}

function missingSeoulOpenDataPlazaKeyHint(): string {
  if (process.env.NODE_ENV === "production") {
    return "서울 시내버스(ws·provider=seoul) 정류장 목록을 쓰려면 API 서버에 SEOUL_OPEN_DATA_PLAZA_KEY(서울 열린데이터광장)를 설정하세요.";
  }
  return "서울 시내버스 정류장 목록은 apps/api/.env의 SEOUL_OPEN_DATA_PLAZA_KEY(열린데이터광장 openapi.seoul.go.kr)가 필요합니다.";
}

function tagoHeader(json: unknown): { code: string; msg: string } {
  const r = json as Record<string, unknown>;
  const header = (r?.response as Record<string, unknown>)?.header as Record<string, unknown> | undefined;
  return {
    code: header?.resultCode != null ? String(header.resultCode) : "",
    msg: header?.resultMsg != null ? String(header.resultMsg) : ""
  };
}

function tagoBody(json: unknown): unknown {
  const r = json as Record<string, unknown>;
  return (r?.response as Record<string, unknown>)?.body;
}

function asItemArray(item: unknown): Record<string, unknown>[] {
  if (item == null) return [];
  if (Array.isArray(item)) return item.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  if (typeof item === "object") return [item as Record<string, unknown>];
  return [];
}

function itemsFromBody(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== "object") return [];
  const items = (body as Record<string, unknown>).items;
  if (items == null || items === "") return [];
  if (typeof items !== "object") return [];
  return asItemArray((items as Record<string, unknown>).item);
}

/** TAGO `body` 의 숫자 필드(대소문자·표기 차이 허용) */
function readBodyInt(body: unknown, ...aliases: string[]): number {
  if (!body || typeof body !== "object") return 0;
  const o = body as Record<string, unknown>;
  const map = new Map(Object.keys(o).map((k) => [k.toLowerCase(), o[k]]));
  for (const a of aliases) {
    const v = map.get(a.toLowerCase());
    if (v == null) continue;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (Number.isFinite(n) && n >= 0) return Math.trunc(n);
  }
  return 0;
}

function coalesceCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  return String(v).trim();
}

/** JSON/XML 변환마다 달라질 수 있는 `citycode` 계열 키를 흡수 */
function extractCityCodeFromRow(row: Record<string, unknown>): string {
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase(), row[k]]));
  for (const k of ["citycode", "citycd", "ctycd", "ctycode", "areacd", "areacode"]) {
    const s = coalesceCell(lower.get(k));
    if (s) return s;
  }
  for (const [k, v] of Object.entries(row)) {
    const kl = k.toLowerCase().replace(/[_\s-]/g, "");
    if ((kl.includes("city") && kl.includes("code")) || kl.endsWith("ctycd")) {
      const s = coalesceCell(v);
      if (s) return s;
    }
  }
  return "";
}

function extractCityNameFromRow(row: Record<string, unknown>): string {
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase(), row[k]]));
  for (const k of ["cityname", "citynm", "ctynm", "ctyname"]) {
    const s = coalesceCell(lower.get(k));
    if (s) return s;
  }
  for (const [k, v] of Object.entries(row)) {
    const kl = k.toLowerCase().replace(/[_\s-]/g, "");
    if ((kl.includes("city") && (kl.includes("name") || kl.includes("nm"))) || kl.endsWith("ctynm")) {
      const s = coalesceCell(v);
      if (s) return s;
    }
  }
  return "";
}

/**
 * 공공데이터포털 **일반 인증키(Encoding)** 는 이미 URL-safe 인코딩된 문자열입니다.
 * `URLSearchParams.set("serviceKey", key)` 로 넣으면 `%` 등이 이중 인코딩되어 TAGO가 401을 반환하는 경우가 많습니다.
 * **Decoding** 키만 쓸 때는 전체를 encodeURIComponent 한 뒤 붙이는 방식이 맞습니다.
 */
function buildTagoRequestUrl(operation: string, serviceKey: string, params: Record<string, string>): string {
  const q = new URLSearchParams();
  q.set("_type", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, v);
  }
  const rest = q.toString();
  const looksEncoded = /%[0-9A-Fa-f]{2}/.test(serviceKey);
  const keyInQuery = looksEncoded ? serviceKey : encodeURIComponent(serviceKey);
  return `${TAGO_BASE}/${operation}?serviceKey=${keyInQuery}${rest ? `&${rest}` : ""}`;
}

type TagoCityRow = { cityCode: string; cityName: string };

type TagoRouteRow = {
  routeId: string;
  routeNo: string;
  routeType: string;
  startNode: string;
  endNode: string;
};

/**
 * TAGO `getRouteNoList`는 통합 광역 코드 `11`(서울특별시)로는 노선이 비는 경우가 많고,
 * 시·군·구 5자리(행정표준코드 앞 5자리)로 등록된 경우가 많습니다.
 * @see https://www.code.go.kr
 */
const SEOUL_DISTRICT_CITY_CODES: readonly string[] = [
  "11110",
  "11140",
  "11170",
  "11200",
  "11215",
  "11230",
  "11245",
  "11260",
  "11290",
  "11305",
  "11320",
  "11350",
  "11380",
  "11410",
  "11440",
  "11470",
  "11500",
  "11530",
  "11545",
  "11560",
  "11590",
  "11620",
  "11650",
  "11680",
  "11710"
];

/** `getRouteNoList`에 넘길 cityCode 후보(서울 통합 11이면 구 단위까지 확장) */
function routeSearchCityCodes(cityCode: string): string[] {
  const cc = cityCode.trim();
  if (cc === "11") return ["11", ...SEOUL_DISTRICT_CITY_CODES];
  return [cc];
}

type TransitProvider = "tago" | "seoul";

type TagoRouteWithSearchCity = TagoRouteRow & { cityCode: string; transitProvider: TransitProvider };

function seoulOpenDataPlazaKey(): string {
  return (env.SEOUL_OPEN_DATA_PLAZA_KEY ?? "").trim().replace(/^["']|["']$/g, "");
}

/** TAGO `11` 또는 서울 행정구역 5자리(11xxxx) — 열린데이터광장 키가 있으면 서울 시내버스를 여기서 우선 처리 */
function shouldUseSeoulOpenDataRoutes(cityCode: string): boolean {
  const c = cityCode.trim();
  if (c === "11") return true;
  return /^11\d{3}$/.test(c);
}

/** 여러 cityCode로 조회해 첫 매칭을 모으며, 정류장 조회용 `cityCode`를 노선마다 붙입니다. */
async function fetchRouteNoListAcrossCityCodes(
  cityCodes: string[],
  routeNo: string,
  opts: { parallel: number; maxRoutes: number }
): Promise<TagoRouteWithSearchCity[]> {
  const { parallel, maxRoutes } = opts;
  const seen = new Set<string>();
  const out: TagoRouteWithSearchCity[] = [];

  for (let i = 0; i < cityCodes.length && out.length < maxRoutes; i += parallel) {
    const chunk = cityCodes.slice(i, i + parallel);
    const chunkResults = await Promise.all(
      chunk.map(async (trialCc) => {
        try {
          const { items } = await tagoGet("getRouteNoList", {
            cityCode: trialCc,
            routeNo,
            numOfRows: "100",
            pageNo: "1"
          });
          return { trialCc, rows: mapRouteRows(items) };
        } catch {
          return { trialCc, rows: [] as TagoRouteRow[] };
        }
      })
    );
    for (const { trialCc, rows } of chunkResults) {
      for (const r of rows) {
        if (!r.routeId || seen.has(r.routeId)) continue;
        seen.add(r.routeId);
        out.push({
          routeId: r.routeId,
          routeNo: r.routeNo,
          routeType: r.routeType,
          startNode: r.startNode,
          endNode: r.endNode,
          cityCode: trialCc,
          transitProvider: "tago"
        });
        if (out.length >= maxRoutes) break;
      }
    }
  }
  return out;
}

/** 서울 열린데이터광장 노선을 먼저 두고, TAGO는 같은 `routeId`는 제외해 뒤에 붙입니다. */
function mergeSeoulOpenRoutesFirst(
  seoulRows: SeoulBusRouteRow[],
  tagoRows: TagoRouteWithSearchCity[],
  maxRoutes: number
): TagoRouteWithSearchCity[] {
  const seen = new Set<string>();
  const out: TagoRouteWithSearchCity[] = [];
  for (const s of seoulRows) {
    if (out.length >= maxRoutes) break;
    if (!s.busRouteId || seen.has(s.busRouteId)) continue;
    seen.add(s.busRouteId);
    out.push({
      routeId: s.busRouteId,
      routeNo: s.busRouteNm,
      routeType: s.routeTypeLabel || s.routeTypeRaw || "",
      startNode: s.stStationNm,
      endNode: s.edStationNm,
      cityCode: "11",
      transitProvider: "seoul"
    });
  }
  for (const t of tagoRows) {
    if (out.length >= maxRoutes) break;
    if (seen.has(t.routeId)) continue;
    seen.add(t.routeId);
    out.push(t);
  }
  return out;
}

function parseCitiesFromTagoItems(items: Record<string, unknown>[]): TagoCityRow[] {
  const byCode = new Map<string, TagoCityRow>();
  for (const row of items) {
    const cityCode = extractCityCodeFromRow(row);
    const rawName = extractCityNameFromRow(row);
    if (!cityCode) continue;
    const cityName = tagoBusCityDisplayName(cityCode, rawName);
    if (!cityName.trim()) continue;
    byCode.set(cityCode, { cityCode, cityName });
  }
  return mergeTagoMetroFallback([...byCode.values()]);
}

/** TAGO 시·군·구 목록은 자주 바뀌지 않아 짧게 캐시해 `/city-codes`·넓게 찾기 부하를 줄입니다. */
const CITY_CODE_LIST_TTL_MS = 30 * 60 * 1000;
let cityCodeListCache: { expiresAt: number; rows: Record<string, unknown>[] } | null = null;

/** `getCtyCodeList` 는 `totalCount` 초과분이 잘리므로 페이지를 이어 받습니다. */
async function fetchAllCtyCodeListRows(): Promise<Record<string, unknown>[]> {
  const now = Date.now();
  if (cityCodeListCache && cityCodeListCache.expiresAt > now) {
    return cityCodeListCache.rows;
  }

  const PAGE = 500;
  const acc: Record<string, unknown>[] = [];
  let pageNo = 1;
  for (;;) {
    const { body, items } = await tagoGet("getCtyCodeList", {
      numOfRows: String(PAGE),
      pageNo: String(pageNo)
    });
    acc.push(...items);
    const totalCount = readBodyInt(body, "totalcount", "totalCount");
    if (!items.length) break;
    if (totalCount > 0 && acc.length >= totalCount) break;
    if (items.length < PAGE) break;
    pageNo += 1;
    if (pageNo > 250) break;
  }

  cityCodeListCache = { expiresAt: now + CITY_CODE_LIST_TTL_MS, rows: acc };
  return acc;
}

function mapRouteRows(items: Record<string, unknown>[]): TagoRouteRow[] {
  return items
    .map((row) => ({
      routeId: String(row.routeid ?? row.routeId ?? ""),
      routeNo: String(row.routeno ?? row.routeNo ?? ""),
      routeType: String(row.routetp ?? row.routeTp ?? ""),
      startNode: String(row.startnodenm ?? row.startNodeNm ?? ""),
      endNode: String(row.endnodenm ?? row.endNodeNm ?? "")
    }))
    .filter((r) => r.routeId);
}

async function tagoGet(operation: string, params: Record<string, string>): Promise<{ body: unknown; items: Record<string, unknown>[] }> {
  const key = (env.TAGO_SERVICE_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (!key) {
    const err = new Error("TAGO_SERVICE_KEY_MISSING");
    (err as Error & { status: number }).status = 503;
    throw err;
  }

  const res = await fetch(buildTagoRequestUrl(operation, key, params), { method: "GET" });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    const err = new Error(`TAGO non-JSON (${res.status}): ${text.slice(0, 200)}`);
    (err as Error & { status: number }).status = 502;
    throw err;
  }

  const { code, msg } = tagoHeader(json);
  if (code !== "00") {
    const err = new Error(msg || `TAGO resultCode=${code}`);
    (err as Error & { status: number }).status = 502;
    throw err;
  }

  const body = tagoBody(json);
  return { body, items: itemsFromBody(body) };
}

export const tagoTransitRouter = Router();

tagoTransitRouter.get("/city-codes", async (_req, res) => {
  try {
    const rows = await fetchAllCtyCodeListRows();
    const cities = parseCitiesFromTagoItems(rows);
    return res.json({ cities });
  } catch (e: unknown) {
    const status = (e as Error & { status?: number }).status ?? 500;
    const message = e instanceof Error ? e.message : String(e);
    if (message === "TAGO_SERVICE_KEY_MISSING") {
      return res.status(503).json({ error: missingTagoServiceKeyHint() });
    }
    return res.status(status).json({ error: message });
  }
});

tagoTransitRouter.get("/routes", async (req, res) => {
  const cityCode = typeof req.query.cityCode === "string" ? req.query.cityCode.trim() : "";
  const routeNo = typeof req.query.routeNo === "string" ? req.query.routeNo.trim() : "";
  if (!cityCode || !routeNo) {
    return res.status(400).json({ error: "cityCode와 routeNo가 필요합니다." });
  }
  try {
    const trials = routeSearchCityCodes(cityCode);
    const openPlaza = seoulOpenDataPlazaKey();
    const useSeoulOpen = shouldUseSeoulOpenDataRoutes(cityCode) && !!openPlaza;
    const tagoKey = (env.TAGO_SERVICE_KEY ?? "").trim().replace(/^["']|["']$/g, "");

    if (!useSeoulOpen && !tagoKey) {
      return res.status(503).json({ error: missingTagoServiceKeyHint() });
    }

    let tagoRoutes: TagoRouteWithSearchCity[] = [];
    if (tagoKey) {
      try {
        tagoRoutes = await fetchRouteNoListAcrossCityCodes(trials, routeNo, { parallel: 8, maxRoutes: 100 });
      } catch {
        tagoRoutes = [];
      }
    }

    if (useSeoulOpen) {
      let seoulRows: SeoulBusRouteRow[] = [];
      try {
        seoulRows = await searchSeoulOpenDataBusRoutesByRouteNo(openPlaza, routeNo, {
          maxPages: 40,
          maxRoutes: 100
        });
      } catch {
        seoulRows = [];
      }
      return res.json({ routes: mergeSeoulOpenRoutesFirst(seoulRows, tagoRoutes, 100) });
    }

    return res.json({ routes: tagoRoutes });
  } catch (e: unknown) {
    const status = (e as Error & { status?: number }).status ?? 500;
    const message = e instanceof Error ? e.message : String(e);
    if (message === "TAGO_SERVICE_KEY_MISSING") {
      return res.status(503).json({ error: missingTagoServiceKeyHint() });
    }
    return res.status(status).json({ error: message });
  }
});

/**
 * TAGO는 `cityCode` 없이 노선만 조회할 수 없어, 정렬된 시·군·구 목록 앞쪽부터
 * 일정 개수를 병렬로 훑어 같은 번호 노선을 모읍니다. (카카오버스식 UX에 가깝게)
 */
tagoTransitRouter.get("/routes-broad", async (req, res) => {
  const routeNo = typeof req.query.routeNo === "string" ? req.query.routeNo.trim() : "";
  if (!routeNo) {
    return res.status(400).json({ error: "routeNo가 필요합니다." });
  }
  const maxCitiesRaw = typeof req.query.maxCities === "string" ? Number.parseInt(req.query.maxCities, 10) : 140;
  const maxCities = Number.isFinite(maxCitiesRaw) ? Math.min(260, Math.max(20, maxCitiesRaw)) : 140;
  const CONCURRENCY = 10;
  const MAX_ROUTES = 80;

  try {
    const rows = await fetchAllCtyCodeListRows();
    const allCities = parseCitiesFromTagoItems(rows);
    const cities = allCities.slice(0, maxCities);
    const cityCodeToName = new Map(allCities.map((c) => [c.cityCode.trim(), c.cityName]));

    const displayCityNameForRoute = (routeCityCode: string | undefined, anchorName: string): string => {
      const cc = (routeCityCode ?? "").trim();
      if (!cc) return anchorName;
      const fromList = cityCodeToName.get(cc);
      if (fromList) return fromList;
      const fromMetro = tagoBusCityDisplayName(cc, "").trim();
      if (fromMetro) return fromMetro;
      return anchorName;
    };

    const openPlazaBroad = seoulOpenDataPlazaKey();
    let seoulOpenSpine: SeoulBusRouteRow[] = [];
    if (openPlazaBroad) {
      try {
        seoulOpenSpine = await searchSeoulOpenDataBusRoutesByRouteNo(openPlazaBroad, routeNo, {
          maxPages: 45,
          maxRoutes: MAX_ROUTES
        });
      } catch {
        seoulOpenSpine = [];
      }
    }
    const openRouteIds = new Set(seoulOpenSpine.map((s) => s.busRouteId).filter(Boolean));
    const seoulMetroLabel = displayCityNameForRoute("11", "서울특별시");

    const routesBroad: Array<
      TagoRouteRow & { cityCode: string; cityName: string; transitProvider: TransitProvider }
    > = [];

    for (const s of seoulOpenSpine) {
      if (!s.busRouteId || routesBroad.length >= MAX_ROUTES) break;
      routesBroad.push({
        routeId: s.busRouteId,
        routeNo: s.busRouteNm,
        routeType: s.routeTypeLabel || s.routeTypeRaw || "",
        startNode: s.stStationNm,
        endNode: s.edStationNm,
        cityCode: "11",
        cityName: seoulMetroLabel,
        transitProvider: "seoul"
      });
    }

    outer: for (let i = 0; i < cities.length; i += CONCURRENCY) {
      if (routesBroad.length >= MAX_ROUTES) break;
      const chunk = cities.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (city) => {
          try {
            const trials = routeSearchCityCodes(city.cityCode);
            let rows = await fetchRouteNoListAcrossCityCodes(trials, routeNo, { parallel: 6, maxRoutes: 40 });
            if (shouldUseSeoulOpenDataRoutes(city.cityCode) && openRouteIds.size) {
              rows = rows.filter((r) => !openRouteIds.has(r.routeId));
            }
            return rows.map((r) => ({
              routeId: r.routeId,
              routeNo: r.routeNo,
              routeType: r.routeType,
              startNode: r.startNode,
              endNode: r.endNode,
              cityCode: r.cityCode,
              cityName: displayCityNameForRoute(r.cityCode, city.cityName),
              transitProvider: r.transitProvider
            }));
          } catch {
            return [];
          }
        })
      );
      for (const arr of chunkResults) {
        routesBroad.push(...arr);
        if (routesBroad.length >= MAX_ROUTES) break outer;
      }
    }

    return res.json({ routes: routesBroad.slice(0, MAX_ROUTES) });
  } catch (e: unknown) {
    const status = (e as Error & { status?: number }).status ?? 500;
    const message = e instanceof Error ? e.message : String(e);
    if (message === "TAGO_SERVICE_KEY_MISSING") {
      return res.status(503).json({ error: missingTagoServiceKeyHint() });
    }
    return res.status(status).json({ error: message });
  }
});

tagoTransitRouter.get("/route-stops", async (req, res) => {
  const cityCode = typeof req.query.cityCode === "string" ? req.query.cityCode.trim() : "";
  const routeId = typeof req.query.routeId === "string" ? req.query.routeId.trim() : "";
  const providerRaw = typeof req.query.provider === "string" ? req.query.provider.trim().toLowerCase() : "tago";

  if (providerRaw === "seoul") {
    if (!routeId) {
      return res.status(400).json({ error: "routeId가 필요합니다." });
    }
    const openPlaza = seoulOpenDataPlazaKey();
    if (!openPlaza) {
      return res.status(503).json({ error: missingSeoulOpenDataPlazaKeyHint() });
    }
    try {
      const rows = await fetchSeoulOpenBusStationsByRouteId(openPlaza, routeId, { maxPages: 72 });
      if (!rows.length) {
        return res.status(404).json({ error: "이 노선의 정류장 목록을 찾지 못했어요." });
      }
      const stops = rows.map((row) => ({
        seq: row.seq,
        nodeNo: row.stationNo,
        nodeNm: row.stationNm,
        nodeId: row.stationId
      }));
      return res.json({ stops });
    } catch (e: unknown) {
      const status = (e as Error & { status?: number }).status ?? 500;
      const message = e instanceof Error ? e.message : String(e);
      return res.status(status).json({ error: message });
    }
  }

  if (!cityCode || !routeId) {
    return res.status(400).json({ error: "cityCode와 routeId가 필요합니다." });
  }
  try {
    const all: Record<string, unknown>[] = [];
    for (let pageNo = 1; pageNo <= 30; pageNo += 1) {
      // `getRouteAcctoBusSttnList` 는 엔드포인트가 없어 404(HTML)가 나옵니다. 경유정류소 조회는 `getRouteAcctoThrghSttnList` 가 맞습니다.
      const { items } = await tagoGet("getRouteAcctoThrghSttnList", {
        cityCode,
        routeId,
        numOfRows: "500",
        pageNo: String(pageNo)
      });
      if (!items.length) break;
      all.push(...items);
      if (items.length < 500) break;
    }
    const stops = all.map((row) => ({
      seq: Number(row.seq ?? row.seqno ?? 0) || 0,
      nodeNo: String(row.nodeno ?? row.nodeNo ?? ""),
      nodeNm: String(row.nodenm ?? row.nodeNm ?? ""),
      nodeId: String(row.nodeid ?? row.nodeId ?? "")
    }));
    stops.sort((a, b) => a.seq - b.seq);
    return res.json({ stops });
  } catch (e: unknown) {
    const status = (e as Error & { status?: number }).status ?? 500;
    const message = e instanceof Error ? e.message : String(e);
    if (message === "TAGO_SERVICE_KEY_MISSING") {
      return res.status(503).json({ error: missingTagoServiceKeyHint() });
    }
    return res.status(status).json({ error: message });
  }
});
