/// ethers v6 decodes uint256 etc. as `bigint`, which JSON.stringify cannot
/// serialize on its own. Converts recursively so any decoded read-call
/// result — scalar, array, or ethers' array-like `Result` struct — becomes
/// plain JSON.
export function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    let hasNamedKey = false;
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (/^\d+$/.test(key)) continue; // ethers Result also carries positional index keys
      hasNamedKey = true;
      out[key] = toJsonSafe(val);
    }
    return hasNamedKey ? out : value;
  }
  return value;
}
