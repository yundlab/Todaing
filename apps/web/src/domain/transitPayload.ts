import type { Station } from "../features/transit/stations";

export type TransitLeg =
  | {
      mode: "BUS";
      start: string;
      end: string;
      busNumber: string;
      from: string;
      to: string;
    }
  | {
      mode: "SUBWAY";
      start: string;
      end: string;
      from: Station | null;
      to: Station | null;
      line: string;
    };

export type TransitPayload = {
  transitFrom: string | null;
  transitTo: string | null;
  transitVia: string | null;
  transitLine: string | null;
  transitMode: string | null;
  transitBusNumber: string | null;
  transitSegments: unknown | null;
};

const TRANSIT1 = "교통1";
const TRANSIT2 = "교통2";
const TRANSIT1_MODE_LABEL = "🚌/🚈";

const EMPTY_PAYLOAD: TransitPayload = {
  transitFrom: null,
  transitTo: null,
  transitVia: null,
  transitLine: null,
  transitMode: null,
  transitBusNumber: null,
  transitSegments: null
};

function legEndpointName(leg: TransitLeg, side: "from" | "to"): string | null {
  if (leg.mode === "BUS") return leg[side] || null;
  return leg[side]?.name ?? null;
}

function legToSegment(leg: TransitLeg) {
  if (leg.mode === "BUS") {
    return {
      mode: "BUS" as const,
      start: leg.start,
      end: leg.end,
      busNumber: leg.busNumber || null,
      from: leg.from || null,
      to: leg.to || null
    };
  }
  return {
    mode: "SUBWAY" as const,
    start: leg.start,
    end: leg.end,
    from: leg.from?.name ?? null,
    to: leg.to?.name ?? null,
    line: leg.line || null
  };
}

function buildTransit1Payload(legs: TransitLeg[]): TransitPayload {
  const segments = legs.map(legToSegment);
  const first = legs[0];
  const last = legs[legs.length - 1];
  const viaStops = legs
    .slice(0, -1)
    .map((l) => legEndpointName(l, "to"))
    .filter((v): v is string => Boolean(v));

  return {
    transitFrom: first ? legEndpointName(first, "from") : null,
    transitTo: last ? legEndpointName(last, "to") : null,
    transitVia: viaStops.length ? viaStops.join("|") : null,
    transitLine: null,
    transitMode: TRANSIT1_MODE_LABEL,
    transitBusNumber: null,
    transitSegments: segments
  };
}

type Transit2Input = {
  mode: string;
  start: string;
  end: string;
  fromText: string;
  toText: string;
};

function buildTransit2Payload({ mode, start, end, fromText, toText }: Transit2Input): TransitPayload {
  const from = fromText.trim() || null;
  const to = toText.trim() || null;
  return {
    transitFrom: from,
    transitTo: to,
    transitVia: null,
    transitLine: null,
    transitMode: mode,
    transitBusNumber: null,
    transitSegments: [{ mode, start, end, from, to }]
  };
}

/**
 * 카테고리에 맞춰 expense의 transit 관련 필드 묶음을 생성한다.
 * - "교통1": 다구간(환승) — legs 기준
 * - "교통2": 단일 구간 — transit2 기준
 * - 그 외: 모두 null
 */
export function buildTransitPayload(
  category: string,
  args: { legs: TransitLeg[]; transit2: Transit2Input }
): TransitPayload {
  const cat = category.trim();
  if (cat === TRANSIT1) return buildTransit1Payload(args.legs);
  if (cat === TRANSIT2) return buildTransit2Payload(args.transit2);
  return { ...EMPTY_PAYLOAD };
}
