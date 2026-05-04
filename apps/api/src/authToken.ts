import crypto from "node:crypto";

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

type AuthTokenPayload = {
  sub: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
};

/** HS256 JWT (payload는 작게 유지 — 리다이렉트 URL 길이 제한) */
export function signAuthToken(
  claims: { sub: string; email: string; name: string },
  secret: string,
  ttlSec = 60 * 60 * 24 * 30
): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const now = Math.floor(Date.now() / 1000);
  const body: AuthTokenPayload = {
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    iat: now,
    exp: now + ttlSec
  };
  const payloadPart = b64url(Buffer.from(JSON.stringify(body)));
  const data = `${header}.${payloadPart}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyAuthToken(token: string, secret: string): { sub: string; email: string; name: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  const sigBuf = Buffer.from(s);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const body = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as AuthTokenPayload;
    if (typeof body.exp === "number" && body.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof body.sub !== "string" || typeof body.email !== "string" || typeof body.name !== "string") {
      return null;
    }
    return { sub: body.sub, email: body.email, name: body.name };
  } catch {
    return null;
  }
}
