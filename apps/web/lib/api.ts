import type { Auth } from "@/types";
let csrf = "";
const authFormPaths = new Set([
  "/auth/register",
  "/auth/login",
  "/auth/demo",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
]);
const startupAttempts = 4;
const startupRequestTimeoutMs = 45_000;
const startupRetryDelayMs = 2_000;
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function waitForAuthServer(): Promise<void> {
  for (let attempt = 0; attempt < startupAttempts; attempt += 1) {
    try {
      const response = await fetch("/api/ready", {
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(startupRequestTimeoutMs),
      });
      if (response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.status === "ready") return;
        // Render can return an HTML waking page with HTTP 200.
      }
      if (!response.ok && ![502, 503, 504].includes(response.status)) {
        throw new ApiError(response.status, "ScholarAI's server is unavailable. Please retry.");
      }
      // A missing Vercel backend address cannot be fixed by waiting for Render.
      if (response.status === 503) {
        const body = await response.json().catch(() => null);
        if (body?.detail === "ScholarAI's server is temporarily unavailable. Please retry.") {
          throw new ApiError(503, body.detail);
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // A network interruption or timeout during cold start can be retried safely:
      // the account-changing POST has not been sent yet.
    }
    if (attempt + 1 < startupAttempts) {
      await new Promise((resolve) => setTimeout(resolve, startupRetryDelayMs));
    }
  }
  throw new ApiError(
    503,
    "ScholarAI's free server is taking longer to start. Please try again in a minute.",
  );
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method)) {
    if (!csrf && !path.startsWith("/auth/")) {
      const session = await api<Auth>("/auth/me");
      csrf = session.csrf_token;
    }
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  if (options.method?.toUpperCase() === "POST" && authFormPaths.has(path)) {
    await waitForAuthServer();
  }
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: "same-origin" });
  const body = await response.json().catch(() => null);
  if (body === null && authFormPaths.has(path)) {
    throw new ApiError(
      502,
      path === "/auth/register"
        ? "The connection was interrupted. Try signing in first; your account may already have been created."
        : "ScholarAI's free server is temporarily unavailable. Please retry shortly.",
    );
  }
  if ([502, 503, 504].includes(response.status))
    throw new ApiError(
      response.status,
      path === "/auth/register"
        ? "The connection was interrupted. Try signing in first; your account may already have been created."
        : "ScholarAI's free server is temporarily unavailable. Please retry shortly.",
    );
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof body?.detail === "string"
        ? body.detail
        : Array.isArray(body?.detail)
          ? body.detail.map((e: { msg: string }) => e.msg).join(". ")
          : "Request failed",
    );
  if (body?.csrf_token) csrf = body.csrf_token;
  return body as T;
}
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
