import { prisma } from "./prisma.js";

export function safeParseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    const o = JSON.parse(json);
    return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Google id_token credential 페이로드로 User upsert 후 레코드 반환 */
export async function upsertUserFromGooglePayload(payload: Record<string, unknown> | null) {
  const email = payload?.email ? String(payload.email) : null;
  if (!email) return null;
  const name = payload?.name ? String(payload.name) : email;
  const picture = payload?.picture != null ? String(payload.picture) : null;

  return prisma.user.upsert({
    where: { email },
    create: { email, name, picture },
    update: { name, picture }
  });
}
