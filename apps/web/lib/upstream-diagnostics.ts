export function classifyUpstreamFailure(error: unknown) {
  const cause =
    error instanceof Error ? (error as Error & { cause?: { code?: unknown } }).cause : null;
  const code = typeof cause?.code === "string" ? cause.code : undefined;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return { category: "dns_failure", code };
  if (code === "ECONNREFUSED") return { category: "connection_refused", code };
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return { category: "upstream_timeout_or_cold_start" };
  }
  return { category: "upstream_unreachable", code };
}
