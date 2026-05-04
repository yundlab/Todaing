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

type HttpInit = RequestInit & { /** 기본 15초 — `routes-broad` 등 장시간 API만 늘림 */ timeoutMs?: number };

export async function http<T>(path: string, init?: HttpInit): Promise<T> {
  const controller = new AbortController();
  const timeoutRaw = init?.timeoutMs;
  const timeoutMs =
    typeof timeoutRaw === "number" && Number.isFinite(timeoutRaw) && timeoutRaw >= 5_000 && timeoutRaw <= 300_000
      ? timeoutRaw
      : 15_000;
  const { timeoutMs: _omit, ...fetchInit } = init ?? {};
  const t = window.setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      ...fetchInit,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
        ...(fetchInit.headers ?? {})
      }
    });
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new HttpError(
        408,
        `서버 응답이 ${Math.round(timeoutMs / 1000)}초를 넘겼어요. 여러 지역을 한꺼번에 찾는 검색은 시간이 걸릴 수 있어요.`
      );
    }
    throw e;
  } finally {
    window.clearTimeout(t);
  }

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
