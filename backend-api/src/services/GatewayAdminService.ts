import { Identity } from "../identities";
import { extractRevertReason } from "../chain/errors";

export class GatewayAdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GatewayAdminError";
  }
}

export interface UploadContractInput {
  name: string;
  address: string;
  abi: unknown[];
  template?: string;
}

interface MintResult {
  id: string;
  status: "pending" | "already_processed";
}

/// Two thin, deliberately narrow proxies onto mock-middleware surfaces that
/// the frontend must never reach directly (architecture table: frontend
/// only talks to backend-api over REST, mock-middleware only over WS):
///
/// - uploadContract: lets the Admin tab's "Upload Contract" form (DL-5.1)
///   register a new ABI without the browser touching mock-middleware's REST API.
/// - mintWithKey: a demo-only debug action (DL-5.2/idempotent-retry.spec.ts)
///   that lets the caller supply its own retry identifier, so the UI can
///   send the exact same Idempotency-Key twice and prove mock-middleware's
///   dedup guarantee (D-08) end to end. Regular business writes (mint,
///   transfer, ...) go through MockMiddlewareChainService instead, which
///   always mints a fresh key per call — this method exists only to make
///   that guarantee demonstrable from the UI.
export class GatewayAdminService {
  constructor(
    private readonly gatewayUrl: string,
    private readonly walletAddresses: Record<Identity, string>,
  ) {}

  async uploadContract(input: UploadContractInput): Promise<{ name: string; address: string; template: string | null }> {
    const res = await fetch(`${this.gatewayUrl}/admin/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json()) as { name: string; address: string; template: string | null; error?: string };
    if (!res.ok) {
      throw new GatewayAdminError(body.error ?? "upload failed", res.status);
    }
    return body;
  }

  async mintWithKey(who: Identity, amount: number, requestId: string): Promise<MintResult> {
    const wallet = this.walletAddresses[who];
    const idempotencyKey = `debug-mint-${who}-${requestId}`;
    const res = await fetch(`${this.gatewayUrl}/contracts/token/mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ params: [wallet, amount], from: "admin" }),
    });
    const body = (await res.json()) as MintResult & { error?: string };
    if (!res.ok) {
      throw new GatewayAdminError(extractRevertReason(body) ?? body.error ?? "mint failed", res.status);
    }
    return body;
  }
}
