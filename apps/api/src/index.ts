import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./env.js";
import { expensesRouter } from "./routes/expenses.js";
import { schedulesRouter } from "./routes/schedules.js";
import { tagoTransitRouter } from "./routes/tagoTransit.js";

const app = express();

app.use(helmet());
const corsMiddleware = cors({
  origin: (origin, cb) => {
    // same-origin / curl / server-to-server
    if (!origin) return cb(null, true);

    // allow explicit configured origin
    if (origin === env.WEB_ORIGIN) return cb(null, true);

    // dev convenience: allow any localhost port (Vite may auto-switch ports)
    if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);

    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
});

// Google Identity Services redirect POSTs include an Origin like https://accounts.google.com.
// This is a top-level navigation, not an XHR, so CORS protection here only causes false 500s.
app.use((req, res, next) => {
  if (req.path === "/auth/google") return next();
  return corsMiddleware(req, res, next);
});
app.use(express.json({ limit: "1mb" }));
// Needed for Google Identity Services redirect UX mode (POST form body).
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => res.json({ ok: true }));

function safeParseJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

app.post("/auth/google", (req, res) => {
  const credential = typeof req.body?.credential === "string" ? req.body.credential : null;
  const payload = credential ? safeParseJwtPayload(credential) : null;
  const email = payload?.email ? String(payload.email) : null;
  if (!email) {
    return res.redirect(`${env.WEB_ORIGIN}?authError=google_credential_missing`);
  }

  const user = {
    name: payload?.name ? String(payload.name) : email,
    email,
    picture: payload?.picture ? String(payload.picture) : undefined
  };

  const encoded = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  return res.redirect(`${env.WEB_ORIGIN}?gsi_user=${encoded}`);
});

app.use("/api/expenses", expensesRouter);
app.use("/api/schedules", schedulesRouter);
app.use("/api/transit/tago", tagoTransitRouter);

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

