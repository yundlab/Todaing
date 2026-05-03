import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  /** `apps/web` Vite `server.port`와 같게 두는 것을 권장 (기본 5176 — 5173은 다른 로컬 서비스와 충돌 방지) */
  WEB_ORIGIN: z.string().default("http://localhost:5176"),
  /** 국토교통부 TAGO(버스 노선·정류장) 프록시 — 빈 문자열이면 해당 API 비활성 */
  TAGO_SERVICE_KEY: z.string().default(""),
  /** 서울시 ws.bus.go.kr 노선·정류장 — TAGO에 없는 서울 시내버스 보완(공공데이터포털 별도 활용신청 키) */
  SEOUL_BUS_SERVICE_KEY: z.string().default(""),
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

