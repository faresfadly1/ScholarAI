import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("authentication while the free server starts", () => {
  it("waits through transient readiness failures before sending registration once", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async (input: string) => {
      if (input === "/api/ready") {
        const checks = fetcher.mock.calls.filter(([url]) => url === "/api/ready").length;
        if (checks === 2) return new Response("<html>Starting...</html>", { status: 200 });
        return Response.json(
          { status: checks === 3 ? "ready" : "not ready" },
          { status: checks === 3 ? 200 : 503 },
        );
      }
      return Response.json({ user: { name: "Test" } }, { status: 201 });
    });
    vi.stubGlobal("fetch", fetcher);

    const result = api<{ user: { name: string } }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Test",
        email: "test@example.com",
        password: "strong-password",
      }),
    });
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({ user: { name: "Test" } });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/ready",
      "/api/ready",
      "/api/ready",
      "/api/auth/register",
    ]);
  });

  it("does not repeat registration if its response is interrupted", async () => {
    const fetcher = vi.fn(async (input: string) =>
      input === "/api/ready"
        ? Response.json({ status: "ready" })
        : Response.json({ detail: "upstream unavailable" }, { status: 502 }),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(api("/auth/register", { method: "POST", body: "{}" })).rejects.toThrow(
      "Try signing in first",
    );
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/api/ready", "/api/auth/register"]);
  });

  it("does not treat an HTML waking page as successful registration", async () => {
    const fetcher = vi.fn(async (input: string) =>
      input === "/api/ready"
        ? Response.json({ status: "ready" })
        : new Response("<html>Starting...</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(api("/auth/register", { method: "POST", body: "{}" })).rejects.toThrow(
      "Try signing in first",
    );
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/api/ready", "/api/auth/register"]);
  });
});
