export function appOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" || url.username || url.password ||
    !["", "/"].includes(url.pathname) || url.search || url.hash ||
    url.hostname === "localhost" || url.hostname.endsWith(".github.io")
  ) {
    throw new Error("PUBLIC_APP_URL must be the HTTPS origin of the hosted application.");
  }
  return url.origin;
}

export async function assertAppReady(origin, fetcher = fetch) {
  const response = await fetcher(`${origin}/health`, {
    redirect: "error", signal: AbortSignal.timeout(15000),
  });
  const health = await response.json();
  if (!response.ok || health.status !== "ready" || health.service !== "scholarai-web") {
    throw new Error("The full ScholarAI application is not ready. Keeping the previous Pages deployment.");
  }
}

export function redirectHtml(origin) {
  const login = `${origin}/login`.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  // Encode '<' so an administrator-supplied URL cannot end the script element.
  const encodedOrigin = JSON.stringify(origin).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open ScholarAI</title><meta name="robots" content="noindex">
<script>
const destination = new URL(${encodedOrigin});
const prefix = "/ScholarAI";
const incoming = location.pathname;
const route = incoming === prefix || incoming === prefix + "/"
  ? "/login" : incoming.startsWith(prefix + "/") ? incoming.slice(prefix.length) : "/login";
destination.pathname = route;
destination.search = location.search;
destination.hash = location.hash;
location.replace(destination.href);
</script></head><body><p>Opening your ScholarAI workspace…</p><p><a href="${login}">Continue to ScholarAI</a></p></body></html>`;
}
