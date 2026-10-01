import { classifyUpstreamFailure } from "../../lib/upstream-diagnostics";

export const dynamic = "force-dynamic";

export async function GET() {
  const configuredAddress = process.env.API_INTERNAL_URL;
  if (!configuredAddress && process.env.NODE_ENV === "production") {
    console.error("[ScholarAI health] API_INTERNAL_URL missing");
    return Response.json({ status: "not ready" }, { status: 503 });
  }
  const address = configuredAddress || "http://127.0.0.1:8000";
  const origin = /^https?:\/\//i.test(address) ? address : `http://${address}`;
  try {
    const response = await fetch(new URL("/ready", origin), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok && (await response.json()).status === "ready") {
      return Response.json(
        { status: "ready", service: "scholarai-web" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("[ScholarAI health] API readiness returned non-ready", {
      category: "upstream_not_ready",
      status: response.status,
    });
  } catch (error) {
    console.error(
      "[ScholarAI health] API readiness request failed",
      classifyUpstreamFailure(error),
    );
  }
  return Response.json({ status: "not ready" }, { status: 503 });
}
