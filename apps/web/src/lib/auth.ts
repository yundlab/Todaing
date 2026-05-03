export type AuthUser = {
  name: string;
  email: string;
  picture?: string;
};

export const AUTH_USER_LS_KEY = "authUser";
/** API Bearer — `POST /api/auth/session` 또는 `/auth/google` 리다이렉트 `auth_session`으로 저장 */
export const AUTH_SESSION_LS_KEY = "authSession";

export function readStoredSessionToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_SESSION_LS_KEY);
  } catch {
    return null;
  }
}

/** base64url → UTF-8 문자열 (JWT 페이로드·gsi_user JSON 등). */
function base64UrlToUtf8String(segment: string): string {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  return new TextDecoder("utf-8").decode(bytes);
}

/** API가 넘긴 `gsi_user` 한 덩어리(base64url UTF-8 JSON). */
export function decodeGsiUserPayload<T = unknown>(base64url: string): T | null {
  try {
    const text = base64UrlToUtf8String(base64url.trim());
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** 클라이언트 표시용(서명 검증 없음). 만료만 본다. */
export function decodeAuthSessionPayload(
  token: string
): { sub: string; email: string; name: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const text = base64UrlToUtf8String(parts[1]);
    const o = JSON.parse(text) as { sub?: unknown; email?: unknown; name?: unknown; exp?: unknown };
    if (typeof o.exp === "number" && o.exp < Date.now() / 1000) return null;
    if (typeof o.sub !== "string" || typeof o.email !== "string" || typeof o.name !== "string") {
      return null;
    }
    return { sub: o.sub, email: o.email, name: o.name };
  } catch {
    return null;
  }
}

/** id_token 같은 JWT의 payload만 안전하게 디코드. 형식이 깨지면 null. */
export function safeParseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const text = base64UrlToUtf8String(parts[1]);
    const obj = JSON.parse(text);
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
