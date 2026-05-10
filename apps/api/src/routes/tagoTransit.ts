import { Router } from "express";
import { mergeTagoMetroFallback, tagoBusCityDisplayName } from "../tagoBusCityDisplay.js";
import { env } from "../env.js";
import {
  enrichSeoulBusRouteTermini,
  fetchSeoulBusRouteListWs,
  fetchSeoulBusRouteListWsDetailed,
  fetchSeoulOpenBusStationsByRouteId,
  searchSeoulOpenDataBusRoutesByRouteNo,
  type SeoulBusRouteRow,
  type SeoulWsBusRouteListDiag
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

function seoulBusRoutesWsOnly(): boolean {
  const v = (env.SEOUL_BUS_ROUTES_WS_ONLY ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function seoulBusOpenDataOnly(): boolean {
  const v = (env.SEOUL_BUS_OPEN_DATA_ONLY ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function seoulBusPlazaLight(): boolean {
  const v = (env.SEOUL_BUS_ROUTES_PLAZA_LIGHT ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function isSeoulWsEnvDisabled(): boolean {
  const v = (env.SEOUL_WS_BUS_DISABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function wsRouteListRecoveryHint(diag: SeoulWsBusRouteListDiag): string {
  switch (diag.reason) {
    case "ok":
      return "";
    case "ws_disabled":
      return "SEOUL_WS_BUS_DISABLED를 비우면 WS를 다시 호출합니다. 폴백을 쓰려면 SEOUL_BUS_ROUTES_WS_ONLY도 끄세요.";
    case "missing_key_or_query":
      return "SEOUL_BUS_WS_SERVICE_KEY 또는 SEOUL_OPEN_DATA_PLAZA_KEY를 확인하세요.";
    case "timeout_or_network":
      return "ws.bus.go.kr에 연결이 안 되거나 SEOUL_WS_FETCH_TIMEOUT_MS 안에 응답이 없습니다. 망·방화벽을 확인하거나, SEOUL_WS_BUS_DISABLED=1과 SEOUL_BUS_ROUTES_WS_ONLY 해제로 열린데이터+TAGO 폴백을 쓰세요.";
    case "ws_api_error":
      return `WS가 오류를 반환했습니다(headerCd=${diag.headerCd ?? "?"}). data.go.kr 버스위치정보(WS)용 serviceKey와 키 인코딩(Encoding/Decoding)을 확인하세요.`;
    case "zero_items":
      return "WS는 정상 응답처럼 보이는데 노선 레코드가 없습니다. 검색어를 바꿔 보거나, SEOUL_BUS_ROUTES_WS_ONLY를 끄면 열린데이터 시트·TAGO로 이어집니다.";
    default:
      return "";
  }
}

function routesFromSeoulWsRows(wsList: SeoulBusRouteRow[], max: number): TagoRouteWithSearchCity[] {
  const seen = new Set<string>();
  const routes: TagoRouteWithSearchCity[] = [];
  for (const s of wsList) {
    if (!s.busRouteId || seen.has(s.busRouteId) || routes.length >= max) continue;
    seen.add(s.busRouteId);
    routes.push({
      routeId: s.busRouteId,
      routeNo: s.busRouteNm,
      routeType: s.routeTypeLabel || s.routeTypeRaw,
      startNode: s.stStationNm,
      endNode: s.edStationNm,
      cityCode: "11",
      transitProvider: "seoul"
    });
  }
  return routes;
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

/** 열린데이터 마스터에 기·종점이 비어 있을 때 TAGO로 먼저 채워 `busRouteInfo` 시트 스캔을 줄임 */
function fillSeoulTerminiFromTago(seoulRows: SeoulBusRouteRow[], tagoRows: TagoRouteWithSearchCity[]): void {
  const byRouteId = new Map<string, TagoRouteWithSearchCity>();
  for (const t of tagoRows) {
    if (t.routeId && !byRouteId.has(t.routeId)) byRouteId.set(t.routeId, t);
  }
  const byRouteNo = new Map<string, TagoRouteWithSearchCity[]>();
  for (const t of tagoRows) {
    const k = t.routeNo.trim().toLowerCase();
    if (!k) continue;
    const arr = byRouteNo.get(k);
    if (arr) arr.push(t);
    else byRouteNo.set(k, [t]);
  }
  for (const s of seoulRows) {
    const needSt = !s.stStationNm?.trim();
    const needEd = !s.edStationNm?.trim();
    if (!needSt && !needEd) continue;
    const rid = s.busRouteId.trim();
    const direct = rid ? byRouteId.get(rid) : undefined;
    if (direct) {
      if (needSt && direct.startNode?.trim()) s.stStationNm = direct.startNode;
      if (needEd && direct.endNode?.trim()) s.edStationNm = direct.endNode;
      continue;
    }
    const nm = s.busRouteNm.trim().toLowerCase();
    const cands = nm ? (byRouteNo.get(nm) ?? []) : [];
    const pick = cands.find((x) => x.routeId === rid) ?? cands[0];
    if (pick) {
      if (needSt && pick.startNode?.trim()) s.stStationNm = pick.startNode;
      if (needEd && pick.endNode?.trim()) s.edStationNm = pick.endNode;
    }
  }
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

/** TAGO 시·군·구 목록은 자주 바뀌지 않아 캐시해 `/city-codes`·넓게 찾기 부하를 줄입니다. */
const CITY_CODE_LIST_TTL_MS = 45 * 60 * 1000;
let cityCodeListCache: { expiresAt: number; rows: Record<string, unknown>[] } | null = null;
let cityCodeListInflight: Promise<Record<string, unknown>[]> | null = null;

/** `getCtyCodeList` 는 `totalCount` 초과분이 잘리므로 페이지를 이어 받습니다. `totalCount`가 있으면 2페이지부터 병렬로 가져옵니다. */
async function fetchAllCtyCodeListRows(): Promise<Record<string, unknown>[]> {
  const now = Date.now();
  if (cityCodeListCache && cityCodeListCache.expiresAt > now) {
    return cityCodeListCache.rows;
  }
  if (!cityCodeListInflight) {
    cityCodeListInflight = (async () => {
      const PAGE = 500;
      /** TAGO 동시 호출 상한 — 너무 크면 429·타임아웃 위험 */
      const PARALLEL = 8;
      const acc: Record<string, unknown>[] = [];

      const finish = (rows: Record<string, unknown>[]) => {
        cityCodeListCache = { expiresAt: Date.now() + CITY_CODE_LIST_TTL_MS, rows };
        return rows;
      };

      const first = await tagoGet("getCtyCodeList", {
        numOfRows: String(PAGE),
        pageNo: "1"
      });
      acc.push(...first.items);
      if (!first.items.length) {
        return finish(acc);
      }

      const totalCount = readBodyInt(first.body, "totalcount", "totalCount");
      if (first.items.length < PAGE || (totalCount > 0 && acc.length >= totalCount)) {
        return finish(acc);
      }

      if (totalCount > 0) {
        const lastPage = Math.min(250, Math.ceil(totalCount / PAGE));
        let nextPage = 2;
        while (nextPage <= lastPage) {
          const batchEnd = Math.min(lastPage, nextPage + PARALLEL - 1);
          const packs = await Promise.all(
            Array.from({ length: batchEnd - nextPage + 1 }, (_, j) =>
              tagoGet("getCtyCodeList", {
                numOfRows: String(PAGE),
                pageNo: String(nextPage + j)
              })
            )
          );
          let stop = false;
          for (const { items } of packs) {
            if (!items.length) {
              stop = true;
              break;
            }
            acc.push(...items);
            if (acc.length >= totalCount) {
              stop = true;
              break;
            }
            if (items.length < PAGE) {
              stop = true;
              break;
            }
          }
          if (stop) break;
          nextPage = batchEnd + 1;
        }
        return finish(acc);
      }

      let pageNo = 2;
      for (;;) {
        const { body, items } = await tagoGet("getCtyCodeList", {
          numOfRows: String(PAGE),
          pageNo: String(pageNo)
        });
        if (!items.length) break;
        acc.push(...items);
        const tc = readBodyInt(body, "totalcount", "totalCount");
        if (tc > 0 && acc.length >= tc) break;
        if (items.length < PAGE) break;
        pageNo += 1;
        if (pageNo > 250) break;
      }
      return finish(acc);
    })().finally(() => {
      cityCodeListInflight = null;
    });
  }
  return cityCodeListInflight;
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
      const plaza = seoulOpenDataPlazaKey();
      const seoulWs = (env.SEOUL_BUS_WS_SERVICE_KEY ?? "").trim();
      /** TAGO 없이 서울만(열린데이터·WS) 쓰는 경우에도 UI에서 cityCode `11` 을 고를 수 있게 */
      if (plaza || seoulWs) {
        return res.json({ cities: [{ cityCode: "11", cityName: "서울특별시" }] });
      }
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
    const seoulWsKeyOnly = (env.SEOUL_BUS_WS_SERVICE_KEY ?? "").trim();
    /** 열린데이터 시트 없이 `ws.bus.go.kr` 키(data.go.kr 노선정보조회)만 있어도 서울에서 WS 우선 검색 가능 */
    const useSeoulOpen =
      shouldUseSeoulOpenDataRoutes(cityCode) && (!!openPlaza || !!seoulWsKeyOnly);
    const tagoKey = (env.TAGO_SERVICE_KEY ?? "").trim().replace(/^["']|["']$/g, "");

    if (!useSeoulOpen && !tagoKey) {
      return res.status(503).json({ error: missingTagoServiceKeyHint() });
    }

    /** 서울만 PLAZA 경량(또는 PLAZA 없을 때 TAGO만) — WS·병합·enrich 경로 진입 안 함 */
    if (seoulBusPlazaLight() && shouldUseSeoulOpenDataRoutes(cityCode)) {
      if (openPlaza) {
        let seoulRowsLight: SeoulBusRouteRow[] = [];
        try {
          seoulRowsLight = await searchSeoulOpenDataBusRoutesByRouteNo(openPlaza, routeNo, {
            maxPages: 18,
            maxRoutes: 100,
            enrichTermini: false
          });
        } catch {
          seoulRowsLight = [];
        }
        // PLAZA_LIGHT는 "가볍게 빨리"가 목적이라, 기·종점 보강(enrich)은 소량만 수행합니다.
        // (대량 enrich는 노선당 시트 페이징을 유발해 체감이 급격히 느려짐)
        try {
          await enrichSeoulBusRouteTermini(openPlaza, seoulRowsLight, {
            enrichMaxRoutes: 10,
            maxPagesPerRoute: 10,
            waveSize: 3
          });
        } catch {
          void 0;
        }
        return res.json({ routes: mergeSeoulOpenRoutesFirst(seoulRowsLight, [], 100) });
      }
      if (tagoKey) {
        try {
          const tr = await fetchRouteNoListAcrossCityCodes(trials, routeNo, { parallel: 8, maxRoutes: 100 });
          return res.json({ routes: tr });
        } catch {
          return res.json({ routes: [] });
        }
      }
      return res.status(503).json({
        error:
          "SEOUL_BUS_ROUTES_PLAZA_LIGHT=1 인데 서울 검색에 SEOUL_OPEN_DATA_PLAZA_KEY 또는 TAGO_SERVICE_KEY가 필요합니다."
      });
    }

    if (useSeoulOpen) {
      // 열린데이터광장만 강제: WS/TAGO/enrich 전부 스킵 (가장 빠름)
      if (seoulBusOpenDataOnly()) {
        if (!openPlaza) {
          return res.status(503).json({
            error: "SEOUL_BUS_OPEN_DATA_ONLY=1 인데 SEOUL_OPEN_DATA_PLAZA_KEY가 비어 있습니다."
          });
        }
        let seoulRowsOnly: SeoulBusRouteRow[] = [];
        try {
          seoulRowsOnly = await searchSeoulOpenDataBusRoutesByRouteNo(openPlaza, routeNo, {
            maxPages: 18,
            maxRoutes: 100,
            enrichTermini: false
          });
        } catch {
          seoulRowsOnly = [];
        }
        // OPEN_DATA_ONLY는 WS/TAGO를 건너뛰는 대신 호출 횟수를 최소화하는 모드라,
        // enrich는 아주 제한적으로만 수행합니다.
        try {
          await enrichSeoulBusRouteTermini(openPlaza, seoulRowsOnly, {
            enrichMaxRoutes: 10,
            maxPagesPerRoute: 10,
            waveSize: 3
          });
        } catch {
          void 0;
        }
        return res.json({ routes: mergeSeoulOpenRoutesFirst(seoulRowsOnly, [], 100) });
      }

      if (seoulBusRoutesWsOnly()) {
        const wsKeyOnly = (env.SEOUL_BUS_WS_SERVICE_KEY ?? "").trim();
        if (!wsKeyOnly || isSeoulWsEnvDisabled()) {
          return res.status(503).json({
            error:
              "서울 노선 WS 전용 모드(SEOUL_BUS_ROUTES_WS_ONLY)인데 WS 키가 없거나 SEOUL_WS_BUS_DISABLED로 WS가 꺼져 있습니다."
          });
        }
        try {
          const diagOnly = await fetchSeoulBusRouteListWsDetailed(wsKeyOnly, routeNo);
          const routesOnly = routesFromSeoulWsRows(diagOnly.rows, 100);
          if (routesOnly.length === 0) {
            return res.json({
              routes: routesOnly,
              wsSearch: {
                reason: diagOnly.reason,
                headerCd: diagOnly.headerCd,
                headerMsg: diagOnly.headerMsg,
                hint: wsRouteListRecoveryHint(diagOnly)
              }
            });
          }
          return res.json({ routes: routesOnly });
        } catch {
          const diagCatch: SeoulWsBusRouteListDiag = {
            rows: [],
            reason: "timeout_or_network",
            headerCd: null,
            headerMsg: null
          };
          return res.json({
            routes: [],
            wsSearch: {
              reason: diagCatch.reason,
              headerCd: diagCatch.headerCd,
              headerMsg: diagCatch.headerMsg,
              hint: wsRouteListRecoveryHint(diagCatch)
            }
          });
        }
      }

      const wsKey = (env.SEOUL_BUS_WS_SERVICE_KEY ?? "").trim();
      if (wsKey) {
        try {
          const wsList = await fetchSeoulBusRouteListWs(wsKey, routeNo);
          if (wsList.length > 0) {
            return res.json({ routes: routesFromSeoulWsRows(wsList, 100) });
          }
        } catch {
          void 0;
        }
      }

      let tagoRoutes: TagoRouteWithSearchCity[] = [];
      let seoulRows: SeoulBusRouteRow[] = [];

      if (tagoKey) {
        try {
          const [t, s] = await Promise.all([
            fetchRouteNoListAcrossCityCodes(trials, routeNo, { parallel: 8, maxRoutes: 100 }).catch(() => []),
            openPlaza
              ? searchSeoulOpenDataBusRoutesByRouteNo(openPlaza, routeNo, {
                  maxPages: 40,
                  maxRoutes: 100,
                  enrichTermini: false
                }).catch(() => [])
              : Promise.resolve([] as SeoulBusRouteRow[])
          ]);
          tagoRoutes = t;
          seoulRows = s;
        } catch {
          tagoRoutes = [];
          seoulRows = [];
        }
        fillSeoulTerminiFromTago(seoulRows, tagoRoutes);
        if (openPlaza) {
          try {
            await enrichSeoulBusRouteTermini(openPlaza, seoulRows, {
              deepRoutes: 6,
              maxPagesPerRoute: 40,
              waveSize: 8
            });
          } catch {
            void 0;
          }
        }
        return res.json({ routes: mergeSeoulOpenRoutesFirst(seoulRows, tagoRoutes, 100) });
      }

      try {
        seoulRows = openPlaza
          ? await searchSeoulOpenDataBusRoutesByRouteNo(openPlaza, routeNo, {
              maxPages: 40,
              maxRoutes: 100
            })
          : [];
      } catch {
        seoulRows = [];
      }
      return res.json({ routes: mergeSeoulOpenRoutesFirst(seoulRows, [], 100) });
    }

    let tagoRoutes: TagoRouteWithSearchCity[] = [];
    if (tagoKey) {
      try {
        tagoRoutes = await fetchRouteNoListAcrossCityCodes(trials, routeNo, { parallel: 8, maxRoutes: 100 });
      } catch {
        tagoRoutes = [];
      }
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
    if (seoulBusRoutesWsOnly()) {
      const openPlazaWsOnly = seoulOpenDataPlazaKey();
      const wsKeyBroadOnly = (env.SEOUL_BUS_WS_SERVICE_KEY ?? "").trim();
      if (!wsKeyBroadOnly || isSeoulWsEnvDisabled()) {
        return res.status(503).json({
          error:
            "서울 노선 WS 전용 모드(SEOUL_BUS_ROUTES_WS_ONLY)인데 WS 키가 없거나 SEOUL_WS_BUS_DISABLED로 WS가 꺼져 있습니다."
        });
      }
      try {
        const diagBroad = await fetchSeoulBusRouteListWsDetailed(wsKeyBroadOnly, routeNo);
        const seoulMetroLabelOnly = "서울특별시";
        const routesWsOnly = diagBroad.rows
          .filter((s) => s.busRouteId)
          .slice(0, MAX_ROUTES)
          .map((s) => ({
            routeId: s.busRouteId,
            routeNo: s.busRouteNm,
            routeType: s.routeTypeLabel || s.routeTypeRaw || "",
            startNode: s.stStationNm,
            endNode: s.edStationNm,
            cityCode: "11",
            cityName: seoulMetroLabelOnly,
            transitProvider: "seoul" as const
          }));
        if (routesWsOnly.length === 0) {
          return res.json({
            routes: routesWsOnly,
            wsSearch: {
              reason: diagBroad.reason,
              headerCd: diagBroad.headerCd,
              headerMsg: diagBroad.headerMsg,
              hint: wsRouteListRecoveryHint(diagBroad)
            }
          });
        }
        return res.json({ routes: routesWsOnly });
      } catch {
        const diagCatch: SeoulWsBusRouteListDiag = {
          rows: [],
          reason: "timeout_or_network",
          headerCd: null,
          headerMsg: null
        };
        return res.json({
          routes: [],
          wsSearch: {
            reason: diagCatch.reason,
            headerCd: diagCatch.headerCd,
            headerMsg: diagCatch.headerMsg,
            hint: wsRouteListRecoveryHint(diagCatch)
          }
        });
      }
    }

    if (seoulBusOpenDataOnly()) {
      const openPlazaBroadOnly = seoulOpenDataPlazaKey();
      if (!openPlazaBroadOnly) {
        return res.status(503).json({
          error: "SEOUL_BUS_OPEN_DATA_ONLY=1 인데 SEOUL_OPEN_DATA_PLAZA_KEY가 비어 있습니다."
        });
      }
      let seoulOpenSpineOnly: SeoulBusRouteRow[] = [];
      try {
        seoulOpenSpineOnly = await searchSeoulOpenDataBusRoutesByRouteNo(openPlazaBroadOnly, routeNo, {
          maxPages: 18,
          maxRoutes: MAX_ROUTES,
          enrichTermini: false
        });
      } catch {
        seoulOpenSpineOnly = [];
      }
      try {
        await enrichSeoulBusRouteTermini(openPlazaBroadOnly, seoulOpenSpineOnly, {
          enrichMaxRoutes: 10,
          maxPagesPerRoute: 10,
          waveSize: 3
        });
      } catch {
        void 0;
      }
      const seoulMetroLabelOnly = "서울특별시";
      return res.json({
        routes: seoulOpenSpineOnly
          .filter((s) => s.busRouteId)
          .slice(0, MAX_ROUTES)
          .map((s) => ({
            routeId: s.busRouteId,
            routeNo: s.busRouteNm,
            routeType: s.routeTypeLabel || s.routeTypeRaw || "",
            startNode: s.stStationNm,
            endNode: s.edStationNm,
            cityCode: "11",
            cityName: seoulMetroLabelOnly,
            transitProvider: "seoul" as const
          }))
      });
    }

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
    if (seoulBusPlazaLight() && openPlazaBroad) {
      try {
        seoulOpenSpine = await searchSeoulOpenDataBusRoutesByRouteNo(openPlazaBroad, routeNo, {
          maxPages: 18,
          maxRoutes: MAX_ROUTES,
          enrichTermini: false
        });
      } catch {
        seoulOpenSpine = [];
      }
    } else {
      const wsKeyBroad = (env.SEOUL_BUS_WS_SERVICE_KEY ?? "").trim();
      if (wsKeyBroad) {
        try {
          const ws = await fetchSeoulBusRouteListWs(wsKeyBroad, routeNo);
          if (ws.length) seoulOpenSpine = ws.slice(0, MAX_ROUTES);
        } catch {
          seoulOpenSpine = [];
        }
      }
      if (!seoulOpenSpine.length && openPlazaBroad) {
        try {
          seoulOpenSpine = await searchSeoulOpenDataBusRoutesByRouteNo(openPlazaBroad, routeNo, {
            maxPages: 45,
            maxRoutes: MAX_ROUTES
          });
        } catch {
          seoulOpenSpine = [];
        }
      }
    }
    if (seoulBusPlazaLight() && openPlazaBroad && seoulOpenSpine.length) {
      try {
        await enrichSeoulBusRouteTermini(openPlazaBroad, seoulOpenSpine, {
          enrichMaxRoutes: 10,
          maxPagesPerRoute: 10,
          waveSize: 3
        });
      } catch {
        void 0;
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
