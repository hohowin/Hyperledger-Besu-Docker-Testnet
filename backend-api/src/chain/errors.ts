/// Surfaced through the API as a 4xx with a human-readable reason — never a
/// raw RPC error, which could leak internals.
export class ComplianceRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplianceRejectedError";
  }
}

/// mock-middleware already sanitizes chain errors into `{error: "<reason>"}`
/// response bodies (D-06 boundary) — this just recognizes that shape (and a
/// couple of fallbacks) on the way back through the fetch-based
/// MockMiddlewareChainService proxy.
export function extractRevertReason(err: unknown): string | null {
  if (err && typeof err === "object") {
    const e = err as { reason?: unknown; shortMessage?: unknown; message?: unknown };
    if (typeof e.reason === "string" && e.reason.length > 0) {
      return e.reason;
    }
    if (typeof e.shortMessage === "string" && e.shortMessage.length > 0) {
      return e.shortMessage;
    }
    if (typeof e.message === "string") {
      return e.message;
    }
  }
  return null;
}

export function toComplianceError(err: unknown): Error {
  const reason = extractRevertReason(err);
  if (reason) {
    return new ComplianceRejectedError(reason);
  }
  return err instanceof Error ? err : new Error(String(err));
}
