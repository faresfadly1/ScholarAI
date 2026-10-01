export const dynamic = "force-dynamic";

export async function GET() {
  const address = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
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
  } catch {
    // The hosting health check must fail while the API or its dependencies are down.
  }
  return Response.json({ status: "not ready" }, { status: 503 });
}
