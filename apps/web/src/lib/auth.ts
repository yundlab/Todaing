export type AuthUser = {
  name: string;
  email: string;
  picture?: string;
};

export const AUTH_USER_LS_KEY = "authUser";

/** id_token 같은 JWT의 payload만 안전하게 디코드. 형식이 깨지면 null. */
export function safeParseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(b64 + pad);
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
