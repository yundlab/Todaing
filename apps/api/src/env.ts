import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  /** `apps/web` Vite `server.port`와 같게 두는 것을 권장 (기본 5176 — 5173은 다른 로컬 서비스와 충돌 방지) */
  WEB_ORIGIN: z.string().default("http://localhost:5176"),
  /** 국토교통부 TAGO(버스 노선·정류장) 프록시 — 빈 문자열이면 해당 API 비활성 */
  TAGO_SERVICE_KEY: z.string().default(""),
  /** 서울 열린데이터광장 `openapi.seoul.go.kr` — `busRteInfo`/`busRoute` 등(경로에 키 삽입). 비우면 서울 노선은 TAGO만 */
  SEOUL_OPEN_DATA_PLAZA_KEY: z.string().default(""),
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

