/** env 값에 끼어든 양옆 공백·줄바꿈을 잘라낸 뒤 fallback 적용. */
function readEnv(key: string, fallback: string): string {
  const raw = (import.meta.env as Record<string, string | undefined>)[key];
  const trimmed = (raw ?? "").trim();
  return trimmed || fallback;
}

const explicitApiBaseRaw = readEnv("VITE_API_BASE_URL", "").replace(/\/$/, "");

/** 개발에서 `localhost`/`127.0.0.1` 은 폰에서 깨지므로 → 상대 경로 + Vite 프록시로 통일 */
function devApiBaseUrl(explicit: string): string {
  if (!explicit) return "";
  try {
    const u = new URL(explicit.includes("://") ? explicit : `http://${explicit}`);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return "";
    return explicit;
  } catch {
    return explicit;
  }
}

const explicitApiBase = import.meta.env.DEV
  ? devApiBaseUrl(explicitApiBaseRaw)
  : explicitApiBaseRaw;

/**
 * - 개발: `VITE_API_BASE_URL` 비우거나 localhost 면 `""` → `/api`·`/auth` 는 Vite 프록시 → PC의 8787.
 *   폰은 `http://<PC-IP>:5176` 만 열면 됨. LAN IP로 API만 직접 줄 필요 없음.
 * - 개발: API를 다른 기기에서 직접 쓸 때만 `http://192.168.x.x:8787` 처럼 비루프백 URL.
 * - 프로덕션: 미지정 시 기존처럼 `http://localhost:8787` (배포 시에는 보통 `VITE_API_BASE_URL` 필수).
 */
export const config = {
  apiBaseUrl: explicitApiBase || (import.meta.env.DEV ? "" : "http://localhost:8787"),
  googleClientId: readEnv("VITE_GOOGLE_CLIENT_ID", "")
};

/** Vercel 등: 프로덕션 정적 호스트에서 localhost API를 쓰면 모든 방문자 기기의 루프백으로 요청이 감 */
function warnMisconfiguredProductionApiBase() {
  if (!import.meta.env.PROD || typeof window === "undefined") return;
  const pageHost = window.location.hostname;
  if (pageHost === "localhost" || pageHost === "127.0.0.1") return;
  const base = config.apiBaseUrl.trim();
  if (!base) return;
  try {
    const u = new URL(base.includes("://") ? base : `https://${base}`);
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return;
  } catch {
    return;
  }
  console.error(
    "[Todaing] 프로덕션 웹이 localhost API를 가리킵니다. Vercel → Settings → Environment Variables에 공개 API의 `VITE_API_BASE_URL`(https://…)을 넣고 재배포하세요."
  );
}
warnMisconfiguredProductionApiBase();
