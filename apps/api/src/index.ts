import express from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { signAuthToken } from "./authToken.js";
import { requireAuth } from "./requireAuth.js";
import { safeParseJwtPayload, upsertUserFromGooglePayload } from "./googleAuth.js";
import { expensesRouter } from "./routes/expenses.js";
import { schedulesRouter } from "./routes/schedules.js";
import { tagoTransitRouter } from "./routes/tagoTransit.js";

const app = express();

/** 휴대폰에서 PC IP로 Vite 접속할 때 등 (http + 사설망) */
function isPrivateLanHttpOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "http:") return false;
    if (hostname.startsWith("192.168.")) return true;
    if (hostname.startsWith("10.")) return true;
    const m = /^172\.(\d+)\./.exec(hostname);
    if (m) {
      const n = Number(m[1]);
      return n >= 16 && n <= 31;
    }
    return false;
  } catch {
    return false;
  }
}

const configuredWebOrigin = env.WEB_ORIGIN.replace(/\/$/, "");

function originsMatch(a: string, b: string): boolean {
  return a.replace(/\/$/, "") === b.replace(/\/$/, "");
}

app.use(helmet());
const corsMiddleware = cors({
  origin: (origin, cb) => {
    // same-origin / curl / server-to-server
    if (!origin) return cb(null, true);

    // allow explicit configured origin (with or without trailing slash)
    if (originsMatch(origin, env.WEB_ORIGIN)) return cb(null, true);

    // dev convenience: allow any localhost / loopback port (Vite may auto-switch ports)
    if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
    if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return cb(null, true);

    if (isPrivateLanHttpOrigin(origin)) return cb(null, true);

    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
});

// Google Identity Services redirect POSTs include an Origin like https://accounts.google.com.
// This is a top-level navigation, not an XHR, so CORS protection here only causes false 500s.
app.use((req, res, next) => {
  if (req.path === "/auth/google" || req.path === "/auth/google/") return next();
  return corsMiddleware(req, res, next);
});
app.use(express.json({ limit: "1mb" }));
// Needed for Google Identity Services redirect UX mode (POST form body).
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => res.json({ ok: true }));

const authGoogleGetHint =
  "이 주소는 구글 로그인 버튼이 POST로만 호출합니다. 주소창에 직접 열면 GET이라 이 메시지가 보입니다. 웹 앱(예: http://localhost:5176)에서 다시 로그인해 주세요.";

app.get("/auth/google", (_req, res) => {
  res.type("text/plain; charset=utf-8").send(authGoogleGetHint);
});
app.get("/auth/google/", (_req, res) => {
  res.type("text/plain; charset=utf-8").send(authGoogleGetHint);
});

const googleCredentialSchema = z.object({
  credential: z.string().min(1)
});

async function handleGoogleRedirectPost(req: express.Request, res: express.Response) {
  const credential = typeof req.body?.credential === "string" ? req.body.credential : null;
  const payload = credential ? safeParseJwtPayload(credential) : null;

  let dbUser: Awaited<ReturnType<typeof upsertUserFromGooglePayload>> = null;
  try {
    dbUser = await upsertUserFromGooglePayload(payload);
  } catch (err) {
    console.error("[auth/google] user upsert failed", err);
    return res.redirect(`${configuredWebOrigin}?authError=server_error`);
  }
  if (!dbUser) {
    return res.redirect(`${configuredWebOrigin}?authError=google_credential_missing`);
  }

  const displayUser = {
    name: dbUser.name,
    email: dbUser.email,
    picture: dbUser.picture ?? undefined
  };
  const encoded = Buffer.from(JSON.stringify(displayUser), "utf8").toString("base64url");
  const token = signAuthToken(
    { sub: dbUser.id, email: dbUser.email, name: dbUser.name },
    env.AUTH_SESSION_SECRET
  );
  const sessionQ = encodeURIComponent(token);
  return res.redirect(`${configuredWebOrigin}?gsi_user=${encoded}&auth_session=${sessionQ}`);
}

app.post("/auth/google", handleGoogleRedirectPost);
app.post("/auth/google/", handleGoogleRedirectPost);

/** 팝업/원탭 등 클라이언트에서 credential만 받을 때 세션 발급 */
app.post("/api/auth/session", async (req, res) => {
  const parsed = googleCredentialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "credential_required" });
    return;
  }
  const payload = safeParseJwtPayload(parsed.data.credential);
  let dbUser: Awaited<ReturnType<typeof upsertUserFromGooglePayload>> = null;
  try {
    dbUser = await upsertUserFromGooglePayload(payload);
  } catch (err) {
    console.error("[api/auth/session] user upsert failed", err);
    res.status(503).json({ error: "server_error" });
    return;
  }
  if (!dbUser) {
    res.status(400).json({ error: "invalid_credential" });
    return;
  }
  const token = signAuthToken(
    { sub: dbUser.id, email: dbUser.email, name: dbUser.name },
    env.AUTH_SESSION_SECRET
  );
  res.json({
    token,
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      picture: dbUser.picture
    }
  });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const id = req.userId;
  if (!id) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  let u;
  try {
    u = await prisma.user.findUnique({ where: { id } });
  } catch (err) {
    console.error("[api/me] db query failed", err);
    res.status(503).json({ error: "server_error" });
    return;
  }
  if (!u) {
    res.status(401).json({ error: "user_not_found" });
    return;
  }
  res.json({ id: u.id, email: u.email, name: u.name, picture: u.picture });
});

app.use("/api/expenses", requireAuth, expensesRouter);
app.use("/api/schedules", requireAuth, schedulesRouter);
app.use("/api/transit/tago", tagoTransitRouter);

// Last-resort error handler: any thrown/rejected request returns 500 instead of crashing.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled request error]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "server_error" });
});

// Never let a stray rejection/exception kill the whole API process.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const listenHost = "0.0.0.0";
app.listen(env.PORT, listenHost, () => {
  console.log(`API listening on http://${listenHost}:${env.PORT} (LAN: http://<이-기기-IP>:${env.PORT})`);
});

