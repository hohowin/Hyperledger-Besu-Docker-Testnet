export type Identity = "admin" | "anson" | "beatrice";

export interface TransferRecord {
  from: string;
  to: string;
  amount: number;
  txHash: string;
  timestamp: string;
}

/// Thrown for both validation errors (400 from a bad request shape) and
/// compliance rejections (400 with the contract's revert reason, FR-6) —
/// the UI shows `message` inline rather than a generic failure (US-007).
export class ApiError extends Error {}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : `Request failed with status ${res.status}`;
    throw new ApiError(message);
  }
  return body as T;
}

/// Thin wrapper over the backend-api REST surface (US-008) — no business
/// logic here, just request/response shaping, matching the API layer's own
/// thin-adapter discipline (architecture.md §6). The browser never talks to
/// mock-middleware over REST (only its WebSocket feed, see useEventFeed) —
/// contract upload and the idempotent-retry debug action are both proxied
/// through backend-api.
export const ApiClient = {
  registerIdentity(who: Identity) {
    return request<{ status: "registered" }>("/admin/register-identity", {
      method: "POST",
      body: JSON.stringify({ who }),
    });
  },
  issueClaim(who: Identity) {
    return request<{ status: "verified" }>("/admin/issue-claim", {
      method: "POST",
      body: JSON.stringify({ who }),
    });
  },
  mint(who: Identity, amount: number) {
    return request<{ status: "minted"; balance: number }>("/admin/mint", {
      method: "POST",
      body: JSON.stringify({ who, amount }),
    });
  },
  transfer(from: Identity, to: Identity, amount: number) {
    return request<{ status: "success"; balances: Record<string, number> }>("/transfer", {
      method: "POST",
      body: JSON.stringify({ from, to, amount }),
    });
  },
  getBalance(who: Identity) {
    return request<{ who: string; balance: number }>(`/balance/${who}`);
  },
  getTransfers() {
    return request<TransferRecord[]>("/transfers");
  },
  uploadContract(name: string, address: string, abi: unknown[], template?: string) {
    return request<{ name: string; address: string; template: string | null }>("/admin/contracts", {
      method: "POST",
      body: JSON.stringify({ name, address, abi, template }),
    });
  },
  mintWithKey(who: Identity, amount: number, requestId: string) {
    return request<{ id: string; status: "pending" | "already_processed" }>("/admin/mint-with-key", {
      method: "POST",
      body: JSON.stringify({ who, amount, requestId }),
    });
  },
  listBlocks(node: "anson" | "beatrice") {
    return request<{ number: string; hash: string; timestamp: string; transactions: string[] }[]>(`/explorer/blocks?node=${node}`);
  },
  getBlock(node: "anson" | "beatrice", numberOrTag: string) {
    return request<{ number: string; hash: string; timestamp: string; transactions: { hash: string }[] }>(`/explorer/blocks/${numberOrTag}?node=${node}`);
  },
  getTransaction(node: "anson" | "beatrice", hash: string) {
    return request<{ hash: string; from: string; to: string | null; value: string; receipt: { status: string } | null }>(`/explorer/tx/${hash}?node=${node}`);
  },
};
