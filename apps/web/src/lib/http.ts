import { config } from "@/lib/config";
import { AUTH_SESSION_LS_KEY } from "@/lib/auth";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function authHeader(): Record<string, string> {
  try {
    const tok = window.localStorage.getItem(AUTH_SESSION_LS_KEY);
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  } catch {
    return {};
  }
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = 15_000;
  const t = window.setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(init?.headers ?? {})
    }
  }).finally(() => window.clearTimeout(t));

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j?.error === "string" && j.error.trim()) msg = j.error.trim();
    } catch {
      void 0;
    }
    throw new HttpError(res.status, msg);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
