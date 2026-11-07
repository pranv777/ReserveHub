export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  constructor(status: number, code: string, message: string, requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider = async () => null;
export function setTokenProvider(fn: TokenProvider): void {
  tokenProvider = fn;
}

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

type Query = Record<string, string | number | boolean | undefined | null>;
export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
}

interface ErrorEnvelope { error?: { code?: string; message?: string; request_id?: string | null } }

function qs(query?: Query): string {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** The single place that talks HTTP. Components never call fetch directly. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = await tokenProvider();
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}${qs(opts.query)}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const e = (data as ErrorEnvelope | null)?.error;
    throw new ApiError(
      res.status,
      e?.code ?? "unknown_error",
      e?.message ?? "Something went wrong. Please try again.",
      e?.request_id ?? null,
    );
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Something went wrong. Please try again.";
}
