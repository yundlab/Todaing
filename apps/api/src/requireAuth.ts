import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "./authToken.js";
import { env } from "./env.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers.authorization;
  const token =
    typeof raw === "string" && raw.startsWith("Bearer ") ? raw.slice("Bearer ".length).trim() : "";
  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const v = verifyAuthToken(token, env.AUTH_SESSION_SECRET);
  if (!v) {
    res.status(401).json({ error: "invalid_token" });
    return;
  }
  req.userId = v.sub;
  next();
}
