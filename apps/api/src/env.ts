import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  /** `apps/web` Vite `server.port`와 같게 두는 것을 권장 (기본 5176 — 5173은 다른 로컬 서비스와 충돌 방지) */
  WEB_ORIGIN: z.string().default("http://localhost:5176"),
  /** 국토교통부 TAGO(버스 노선·정류장) 프록시 — 빈 문자열이면 해당 API 비활성 */
  TAGO_SERVICE_KEY: z.string().default(""),
  /**
   * 서울 열린데이터광장 `openapi.seoul.go.kr` — 시트·정류장 등. 비우면 `SEOUL_BUS_WS_SERVICE_KEY`만으로도 서울 `/routes`는 WS 우선 가능(폴백 시트는 생략).
   */
  SEOUL_OPEN_DATA_PLAZA_KEY: z.string().default(""),
  /**
   * 공공데이터포털「서울특별시_노선정보조회」`ws.bus.go.kr` 일반 인증키 — `getBusRouteList`·`getStaionByRoute` 등.
   * 이 값만 있어도 서울 cityCode 요청 시 WS를 먼저 호출합니다.
   */
  SEOUL_BUS_WS_SERVICE_KEY: z.string().default(""),
  /** `ws.bus.go.kr` 호출 상한(ms). 응답이 없으면 이후 열린데이터·TAGO 폴백으로 넘김 — 너무 크면 체감만 늘어남 */
  SEOUL_WS_FETCH_TIMEOUT_MS: z.coerce.number().min(2000).max(25000).default(8000),
  /** `1`/`true` 이면 WS(노선·정류장) 호출 생략 — 로컬에서 ws.bus 가 막히면 */
  SEOUL_WS_BUS_DISABLED: z.string().default(""),
  /** `1`/`true` 이면 서울 노선 검색(`/routes`, `/routes-broad`)은 WS만 — TAGO·열린데이터 시트 폴백 없음(실험·지연 원인 분리용) */
  SEOUL_BUS_ROUTES_WS_ONLY: z.string().default(""),
  /** `1`/`true` 이면 서울 노선 검색은 열린데이터광장만(WS/TAGO/enrich 스킵) — 느릴 때 강제 단순화 */
  SEOUL_BUS_OPEN_DATA_ONLY: z.string().default(""),
  /**
   * `1`/`true` 이면 서울(`/routes`·`routes-broad` 스파인)은 열린데이터만 가볍게 — WS·TAGO 병합·enrich 없음.
   * 지방 `cityCode`·`routes-broad` 나머지는 TAGO. (`SEOUL_BUS_OPEN_DATA_ONLY`와 달리 broad에서 전국 TAGO 스캔 유지)
   */
  SEOUL_BUS_ROUTES_PLAZA_LIGHT: z.string().default(""),
  DATABASE_URL: z
    .string()
    .min(
      1,
      "DATABASE_URL is required. Set it in apps/api/.env (Supabase connection string)."
    ),
  /** 세션 JWT 서명용. 프로덕션에서는 32자 이상 난수로 설정하세요. */
  AUTH_SESSION_SECRET: z.string().min(16).default("dev-insecure-secret-change-me")
});

export const env = envSchema.parse(process.env);

