import { config } from "./config";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
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
      ...(init?.headers ?? {})
    }
  }).finally(() => window.clearTimeout(t));

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(res.status, text || res.statusText);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
