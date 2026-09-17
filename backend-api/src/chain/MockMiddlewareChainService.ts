import { randomUUID } from "node:crypto";
import { ethers } from "ethers";
import { Identity, IDENTITIES } from "../identities";
import { ChainServiceLike } from "./ChainService";

type ContractInstance = "identityRegistry" | "token";

const VIEW_METHODS = new Set(["isRegistered", "isVerified", "balanceOf", "name", "symbol"]);

interface WriteResponse {
  id: string;
  status: "pending" | "already_processed";
}

interface ReceiptResponse {
  id: string;
  status: "pending" | "confirmed" | "error";
  error?: string;
}

async function pollReceipt(gatewayUrl: string, txHash: string, tries = 60, delayMs = 1000): Promise<{ hash: string }> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${gatewayUrl}/admin/receipts/${txHash}`);
    const receipt = (await res.json()) as ReceiptResponse;
    if (receipt.status === "confirmed") {
      return { hash: txHash };
    }
    if (receipt.status === "error") {
      throw { reason: receipt.error }; // eslint-disable-line no-throw-literal -- shape matches extractRevertReason
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Receipt ${txHash} did not resolve after ${tries} attempts`);
}

/// A "contract" here is a thin proxy over mock-middleware's generic ABI
/// gateway REST surface, not a real ethers.Contract — but it's duck-typed to
/// match exactly how ComplianceAdminService/TransferService already use one:
/// `await c.someMethod(...)` for a view call resolves straight to the value;
/// for a write call it resolves to `{ hash, wait() }`, same shape as ethers'
/// own TransactionResponse. Neither service needed to change at all to run
/// against this transport (ported unchanged from my-besu-net's
/// KaleidoChainService, which proved the same pattern against a different
/// gateway).
function createContractProxy(gatewayUrl: string, instance: ContractInstance, from: Identity): ethers.Contract {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return async (...params: unknown[]) => {
        if (VIEW_METHODS.has(prop)) {
          const query = encodeURIComponent(JSON.stringify(params));
          const res = await fetch(`${gatewayUrl}/contracts/${instance}/${prop}?params=${query}`);
          const body = (await res.json()) as { output?: unknown; error?: string };
          if (!res.ok) {
            throw { reason: body.error }; // eslint-disable-line no-throw-literal
          }
          return body.output;
        }

        // A fresh key per call, not per (contract, method, params) — two
        // legitimate identical writes (e.g. two 10-COIN mints) must both go
        // through; retries are the caller's responsibility, not implied here.
        const idempotencyKey = `${from}-${instance}-${prop}-${randomUUID()}`;
        const res = await fetch(`${gatewayUrl}/contracts/${instance}/${prop}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ params, from }),
        });
        const body = (await res.json()) as WriteResponse & { error?: string };
        if (!res.ok) {
          throw { reason: body.error }; // eslint-disable-line no-throw-literal
        }
        return {
          hash: body.id,
          wait: () => pollReceipt(gatewayUrl, body.id),
        };
      };
    },
  };
  return new Proxy({}, handler) as unknown as ethers.Contract;
}

/// backend-api's only chain-transport implementation (D-06, D-13). Holds no
/// private keys at all — mock-middleware does. The application layer
/// (ComplianceAdminService, TransferService, AuditLogRepository) is
/// unchanged from my-besu-net; only the transport differs.
export class MockMiddlewareChainService implements ChainServiceLike {
  constructor(
    private readonly gatewayUrl: string,
    private readonly walletAddresses: Record<Identity, string>,
  ) {}

  getAddress(identity: Identity): string {
    return this.walletAddresses[identity];
  }

  identityRegistry(asIdentity: Identity = "admin"): ethers.Contract {
    return createContractProxy(this.gatewayUrl, "identityRegistry", asIdentity);
  }

  token(asIdentity: Identity = "admin"): ethers.Contract {
    return createContractProxy(this.gatewayUrl, "token", asIdentity);
  }

  resetNonce(): void {
    // Nonce management lives entirely inside mock-middleware, which holds
    // the keys and does the actual signing/submission (D-06) — nothing to
    // reset on this side of the REST boundary.
  }
}

/// This process needs each identity's *address* (not its key) to build
/// request bodies and to answer GET /balance/:who — addresses aren't secret,
/// so reading them from the same .env.local is fine.
export function loadWalletAddressesFromEnv(env: NodeJS.ProcessEnv): Record<Identity, string> {
  const addresses = {} as Record<Identity, string>;
  for (const identity of IDENTITIES) {
    const envVar = `${identity.toUpperCase()}_ADDRESS`;
    const value = env[envVar];
    if (!value) {
      throw new Error(`Missing required env var ${envVar}`);
    }
    addresses[identity] = value;
  }
  return addresses;
}
