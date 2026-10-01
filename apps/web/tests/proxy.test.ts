import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/[...path]/route";
import { GET as health } from "../app/health/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("hosted API connection", () => {
  it("uses the runtime API address and preserves session, CSRF, origin and query data", async () => {
    vi.stubEnv("API_INTERNAL_URL", "private-api:8000");
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        { ok: true },
        {
          headers: {
            "set-cookie": "scholarai_session=session; HttpOnly; Secure; SameSite=Lax; Path=/",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const request = new NextRequest("https://app.example.com/api/auth/login?next=dashboard", {
      method: "POST",
      body: JSON.stringify({ email: "student@example.com" }),
      headers: {
        "content-type": "application/json",
        cookie: "scholarai_session=old",
        origin: "https://app.example.com",
        "x-csrf-token": "csrf",
        "sec-fetch-site": "same-origin",
      },
    });
    const response = await POST(request, context(["auth", "login"]));
    const [url, options] = fetcher.mock.calls[0];
    expect(url.href).toBe("http://private-api:8000/api/auth/login?next=dashboard");
    expect(options.headers.get("cookie")).toBe("scholarai_session=old");
    expect(options.headers.get("x-csrf-token")).toBe("csrf");
    expect(options.headers.get("origin")).toBe("https://app.example.com");
    expect(options.headers.get("sec-fetch-site")).toBe("same-origin");
    expect(options.body.toString()).toContain("student@example.com");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly; Secure");
  });

  it("preserves multipart uploads", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "document" }, { status: 202 }));
    vi.stubGlobal("fetch", fetcher);
    const body = new FormData();
    body.set("document_type", "CV");
    body.set("file", new Blob(["%PDF-1.7 test"], { type: "application/pdf" }), "cv.pdf");
    const request = new NextRequest("https://app.example.com/api/documents", {
      method: "POST",
      body,
    });
    const response = await POST(request, context(["documents"]));
    const options = fetcher.mock.calls[0][1];
    expect(options.headers.get("content-type")).toMatch(/^multipart\/form-data; boundary=/);
    expect(options.body.toString()).toContain("%PDF-1.7 test");
    expect(response.status).toBe(202);
  });

  it("replaces spoofed proxy identity with the configured edge identity", async () => {
    vi.stubEnv("INTERNAL_PROXY_SECRET", "private-secret");
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "cf-connecting-ip");
    const fetcher = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetcher);
    const request = new NextRequest("https://app.example.com/api/auth/me", {
      headers: {
        "cf-connecting-ip": "203.0.113.20",
        "x-scholarai-client-ip": "198.51.100.4",
        "x-scholarai-proxy-secret": "spoofed",
      },
    });
    await GET(request, context(["auth", "me"]));
    expect(fetcher.mock.calls[0][1].headers.get("x-scholarai-client-ip")).toBe("203.0.113.20");
    expect(fetcher.mock.calls[0][1].headers.get("x-scholarai-proxy-secret")).toBe("private-secret");
  });

  it("rejects oversized uploads before forwarding them", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const request = new NextRequest("https://app.example.com/api/documents", {
      method: "POST",
      body: new Uint8Array(16 * 1024 * 1024 + 1),
    });
    expect((await POST(request, context(["documents"]))).status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports an unavailable backend without exposing internal addresses", async () => {
    const cause = Object.assign(new Error("dns details"), { code: "ENOTFOUND" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause })));
    const response = await GET(
      new NextRequest("https://app.example.com/api/auth/me"),
      context(["auth", "me"]),
    );
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("dns details");
    expect(log).toHaveBeenCalledWith(
      "[ScholarAI API proxy] upstream request failed",
      expect.objectContaining({ category: "dns_failure", code: "ENOTFOUND" }),
    );
    expect((await health()).status).toBe(503);
  });

  it("does not fall back to localhost in production when API_INTERNAL_URL is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_INTERNAL_URL", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(
      new NextRequest("https://app.example.com/api/auth/me"),
      context(["auth", "me"]),
    );
    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("[ScholarAI API proxy] API_INTERNAL_URL missing");
  });

  it("marks the web app ready only when its backend is ready", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "ready" })));
    expect(await (await health()).json()).toEqual({ status: "ready", service: "scholarai-web" });
  });
});
