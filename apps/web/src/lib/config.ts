/** env 값에 끼어든 양옆 공백·줄바꿈을 잘라낸 뒤 fallback 적용. */
function readEnv(key: string, fallback: string): string {
  const raw = (import.meta.env as Record<string, string | undefined>)[key];
  const trimmed = (raw ?? "").trim();
  return trimmed || fallback;
}

export const config = {
  apiBaseUrl: readEnv("VITE_API_BASE_URL", "http://localhost:8787"),
  googleClientId: readEnv("VITE_GOOGLE_CLIENT_ID", "")
};
