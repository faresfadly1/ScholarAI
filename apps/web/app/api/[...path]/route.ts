import type { NextRequest } from "next/server";
import { isIP } from "node:net";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const forwardedRequestHeaders = [
  "accept",
  "content-type",
  "cookie",
  "origin",
  "sec-fetch-site",
  "x-csrf-token",
];
const maxBodyBytes = 16 * 1024 * 1024;

async function readBody(request: NextRequest) {
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBodyBytes) {
      await reader.cancel();
      throw new RangeError("Request is too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const apiAddress = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
  const apiOrigin = /^https?:\/\//i.test(apiAddress) ? apiAddress : `http://${apiAddress}`;
  const { path } = await context.params;
  if (path.some((segment) => segment === "." || segment === "..")) {
    return Response.json({ detail: "Invalid API path" }, { status: 400 });
  }
  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, apiOrigin);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Only enable this header on hosts whose edge overwrites the incoming client IP.
  const proxySecret = process.env.INTERNAL_PROXY_SECRET;
  const clientIpHeader = process.env.TRUSTED_CLIENT_IP_HEADER;
  const clientIp = clientIpHeader ? request.headers.get(clientIpHeader) : null;
  if (proxySecret && clientIp && isIP(clientIp)) {
    headers.set("x-scholarai-proxy-secret", proxySecret);
    headers.set("x-scholarai-client-ip", clientIp);
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await readBody(request),
      cache: "no-store",
      redirect: "manual",
    });

    const responseHeaders = new Headers(upstream.headers);
    for (const name of ["connection", "content-encoding", "content-length", "transfer-encoding"]) {
      responseHeaders.delete(name);
    }
    const setCookies = upstream.headers.getSetCookie();
    if (setCookies.length) {
      responseHeaders.delete("set-cookie");
      for (const cookie of setCookies) responseHeaders.append("set-cookie", cookie);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const tooLarge = error instanceof RangeError;
    return Response.json(
      {
        detail: tooLarge
          ? "Request is too large"
          : "ScholarAI's free demo server is waking up. This may take a moment. Please retry shortly.",
      },
      { status: tooLarge ? 413 : 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
