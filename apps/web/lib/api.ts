import type { Auth } from "@/types";
let csrf = "";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
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
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: "same-origin" });
  const body = await response.json().catch(() => ({ detail: "Server unavailable. Please retry." }));
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof body.detail === "string"
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((e: { msg: string }) => e.msg).join(". ")
          : "Request failed",
    );
  if (body.csrf_token) csrf = body.csrf_token;
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
