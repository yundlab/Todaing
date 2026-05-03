/**
 * 서울시 버스정보시스템(TOPIS) `ws.bus.go.kr` — TAGO(1613000)에는 서울 시내버스가 비는 경우가 많아
 * 노선·정류장은 이 API로 보완합니다. 공공데이터포털 「서울특별시_노선정보조회」 일반 인증키를 `SEOUL_BUS_SERVICE_KEY`에 둡니다.
 *
 * 인증키는 **Encoding(% 포함)·Decoding** 두 종류가 있고, 게이트마다 “그대로 붙일지 / 한 번 인코딩할지”가 달라
 * `SERVICE KEY IS NOT REGISTERED` 가 나도 **여러 조합으로 순차 시도**합니다.
 */

const SEOUL_BUS_BASE = "http://ws.bus.go.kr/api/rest/busRouteInfo";

/** `serviceKey=` 뒤에 붙일 문자열 후보(짧은 것부터 시도하지 않고, 포털 안내 순서에 맞춤) */
function seoulServiceKeyQueryVariants(serviceKey: string): string[] {
  const key = serviceKey.trim().replace(/^["']|["']$/g, "");
  if (!key) return [];

  const hasPct = /%[0-9A-Fa-f]{2}/.test(key);
  const out: string[] = [];
  const push = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };

  if (hasPct) {
    // ① Encoding 키: 포털에 나온 그대로(URL에 그대로 이어붙임)
    push(key);
    // ② 이중 인코딩으로 넣었을 때 복구: decode 후 한 번만 encode
    try {
      const once = encodeURIComponent(decodeURIComponent(key));
      push(once);
    } catch {
      /* ignore */
    }
  } else {
    // Decoding 키(숫자·영문 32~88자 등): 대부분의 문서는 URL 인코딩 1회
    push(encodeURIComponent(key));
    // 일부 환경·예전 게이트: 디코딩 키를 **추가 인코딩 없이** 그대로(ASCII hex만 해당)
    if (/^[0-9a-fA-F]+$/.test(key)) {
      push(key);
    }
  }

  return out;
}

function buildSeoulBusUrl(operation: string, serviceKeyQuery: string, params: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, v);
  }
  const rest = q.toString();
  return `${SEOUL_BUS_BASE}/${operation}?serviceKey=${serviceKeyQuery}${rest ? `&${rest}` : ""}`;
}

function firstMatch(xml: string, re: RegExp): string {
  const m = xml.match(re);
  return (m?.[1] ?? "").trim();
}

/** `msgHeader` — 성공 시 `headerCd` 는 보통 `0` */
function parseSeoulMsgHeader(xml: string): { headerCd: string; headerMsg: string } {
  const inner = firstMatch(xml, /<msgHeader>([\s\S]*?)<\/msgHeader>/i);
  if (!inner) return { headerCd: "", headerMsg: "" };
  const cd = firstMatch(inner, /<headerCd>([^<]*)<\/headerCd>/i);
  let msg = firstMatch(inner, /<headerMsg><!\[CDATA\[([\s\S]*?)\]\]><\/headerMsg>/i);
  if (!msg) msg = firstMatch(inner, /<headerMsg>([^<]*)<\/headerMsg>/i);
  return { headerCd: cd, headerMsg: msg };
}

async function fetchSeoulBusOperationXml(
  operation: string,
  serviceKey: string,
  params: Record<string, string>
): Promise<string> {
  const variants = seoulServiceKeyQueryVariants(serviceKey);
  if (!variants.length) {
    const err = new Error("SEOUL_BUS_SERVICE_KEY_MISSING");
    (err as Error & { status: number }).status = 503;
    throw err;
  }

  let lastXml = "";
  for (const keyQ of variants) {
    const url = buildSeoulBusUrl(operation, keyQ, params);
    const res = await fetch(url, { method: "GET" });
    const xml = await res.text();
    lastXml = xml;
    const { headerCd } = parseSeoulMsgHeader(xml);
    if (headerCd === "0") return xml;
    // 인증 계열(7 등)이면 다음 키 조합 시도, 그 외 XML 오류는 중단
    const { headerMsg } = parseSeoulMsgHeader(xml);
    const authLike =
      /인증실패|NOT REGISTERED|SERVICE KEY IS NOT REGISTERED|LIMITED NUMBER|일일 제한/i.test(headerMsg) ||
      headerCd === "7" ||
      headerCd === "8";
    if (!authLike) break;
  }
  return lastXml;
}

function textTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return (m?.[1] ?? "").trim();
}

const SEOUL_ROUTE_TYPE_LABEL: Record<string, string> = {
  "1": "공항",
  "2": "마을",
  "3": "간선",
  "4": "지선",
  "5": "순환",
  "6": "광역",
  "7": "인천",
  "8": "경기",
  "9": "폐지"
};

export type SeoulBusRouteRow = {
  busRouteId: string;
  busRouteNm: string;
  routeTypeRaw: string;
  routeTypeLabel: string;
  stStationNm: string;
  edStationNm: string;
};

function parseBusRouteListBlocks(msgBody: string): string[] {
  const blocks: string[] = [];
  const re = /<busRouteList>([\s\S]*?)<\/busRouteList>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(msgBody)) !== null) blocks.push(m[1]);
  return blocks;
}

export async function fetchSeoulBusRoutesByRouteNo(serviceKey: string, strSrch: string): Promise<SeoulBusRouteRow[]> {
  const xml = await fetchSeoulBusOperationXml("getBusRouteList", serviceKey, { strSrch });

  const { headerCd, headerMsg } = parseSeoulMsgHeader(xml);
  if (headerCd !== "0") {
    const err = new Error(headerMsg || `Seoul bus headerCd=${headerCd || "?"}`);
    (err as Error & { status: number }).status = 502;
    throw err;
  }

  const msgBody = firstMatch(xml, /<msgBody>([\s\S]*?)<\/msgBody>/i);
  const out: SeoulBusRouteRow[] = [];
  for (const block of parseBusRouteListBlocks(msgBody)) {
    const busRouteId = textTag(block, "busRouteId");
    const busRouteNm = textTag(block, "busRouteNm");
    if (!busRouteId) continue;
    const routeTypeRaw = textTag(block, "routeType");
    const routeTypeLabel = SEOUL_ROUTE_TYPE_LABEL[routeTypeRaw] ?? (routeTypeRaw ? `${routeTypeRaw}유형` : "");
    out.push({
      busRouteId,
      busRouteNm: busRouteNm || strSrch,
      routeTypeRaw,
      routeTypeLabel,
      stStationNm: textTag(block, "stStationNm"),
      edStationNm: textTag(block, "edStationNm")
    });
  }
  return out;
}

function parseStationListBlocks(msgBody: string): string[] {
  const blocks: string[] = [];
  const re = /<(?:stationList|StationList)>([\s\S]*?)<\/(?:stationList|StationList)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(msgBody)) !== null) blocks.push(m[1]);
  return blocks;
}

export type SeoulBusStopRow = { seq: number; stationNo: string; stationNm: string; stationId: string };

export async function fetchSeoulBusStationsByRoute(serviceKey: string, busRouteId: string): Promise<SeoulBusStopRow[]> {
  const xml = await fetchSeoulBusOperationXml("getStaionByRoute", serviceKey, { busRouteId });

  const { headerCd, headerMsg } = parseSeoulMsgHeader(xml);
  if (headerCd !== "0") {
    const err = new Error(headerMsg || `Seoul bus headerCd=${headerCd || "?"}`);
    (err as Error & { status: number }).status = 502;
    throw err;
  }

  const msgBody = firstMatch(xml, /<msgBody>([\s\S]*?)<\/msgBody>/i);
  const rows: SeoulBusStopRow[] = [];
  let ord = 0;
  for (const block of parseStationListBlocks(msgBody)) {
    ord += 1;
    const seqRaw = textTag(block, "seq");
    const seq = Number.parseInt(seqRaw, 10);
    const stationNo = textTag(block, "stationNo") || textTag(block, "arsId");
    const stationNm = textTag(block, "stationNm");
    const stationId = textTag(block, "station");
    if (!stationNm && !stationNo) continue;
    rows.push({
      seq: Number.isFinite(seq) && seq > 0 ? seq : ord,
      stationNo,
      stationNm,
      stationId
    });
  }
  rows.sort((a, b) => a.seq - b.seq);
  return rows;
}
