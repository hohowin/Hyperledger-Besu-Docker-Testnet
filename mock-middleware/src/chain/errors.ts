/// ethers v6 decodes a standard `require(cond, "reason")` revert into
/// `error.reason` for both eth_call gas estimation and RPC providers that
/// return revert data (Besu does). Falls back to shortMessage/message
/// pattern-matching for anything that slips through with a differently
/// shaped error. Ported from my-besu-net's backend-api/src/chain/errors.ts —
/// mock-middleware needs the same sanitization so a revert never leaks a raw
/// RPC error or stack trace through the gateway's response body.
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
      const quoted = e.message.match(/reverted with reason string '([^']+)'/);
      if (quoted) return quoted[1];
      const parenthesized = e.message.match(/execution reverted \(([^)]+)\)/i);
      if (parenthesized) return parenthesized[1];
      const inline = e.message.match(/execution reverted:?\s*([^"]+)/i);
      if (inline) return inline[1].trim();
    }
  }
  return null;
}
