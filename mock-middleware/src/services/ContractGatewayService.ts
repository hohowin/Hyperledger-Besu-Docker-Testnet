import { ethers } from "ethers";
import { Identity, isIdentity } from "../identities";
import { ContractRegistryServiceLike } from "./ContractRegistryService";
import { IdempotencyStore } from "./IdempotencyStore";
import { NonceTracker } from "./NonceTracker";
import { EventSubscriptionService } from "./EventSubscriptionService";
import { extractRevertReason } from "../chain/errors";

/// FR-6-equivalent for mock-middleware: a revert surfaces as a readable 4xx,
/// never a raw RPC error — see errorHandler.ts, which is the only place this
/// status is consumed.
export class ContractGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ContractGatewayError";
  }
}

export interface WriteResult {
  id: string;
  status: "pending" | "already_processed";
  nonce: number;
}

/// Narrow surfaces so this service can be unit-tested without a live chain
/// (a real ethers.JsonRpcProvider/Wallet satisfies both structurally).
export interface ProviderLike {
  call(tx: { to: string; data: string }): Promise<string>;
  estimateGas(tx: { to: string; from: string; data: string }): Promise<bigint>;
}

export interface SignerLike {
  address: string;
  sendTransaction(tx: {
    to: string;
    data: string;
    nonce: number;
    gasLimit: bigint;
    gasPrice: number;
  }): Promise<{ hash: string; wait(): Promise<unknown> }>;
}

/// The generic ABI-driven gateway itself (D-07). Deliberately knows nothing
/// about what "registering an identity" or "transferring" means — it only
/// knows how to look up a registered {address, abi} by name and dispatch a
/// read or write call against it. Business invariants live one layer up, in
/// backend-api's ComplianceAdminService/TransferService (architecture.md §6).
export class ContractGatewayService {
  constructor(
    private readonly registry: ContractRegistryServiceLike,
    private readonly idempotency: IdempotencyStore,
    private readonly nonces: NonceTracker,
    private readonly provider: ProviderLike,
    private readonly signers: Record<Identity, SignerLike>,
    private readonly events: EventSubscriptionService,
  ) {}

  async callRead(name: string, method: string, params: unknown[]): Promise<unknown> {
    const { entry, iface } = this.resolveContract(name);
    const fragment = this.resolveFunction(iface, method);
    if (fragment.stateMutability !== "view" && fragment.stateMutability !== "pure") {
      throw new ContractGatewayError(`${method} is not a read method — use POST`, 400);
    }

    const data = this.encodeParams(iface, fragment, params);
    let resultData: string;
    try {
      resultData = await this.provider.call({ to: entry.address, data });
    } catch (err) {
      throw new ContractGatewayError(extractRevertReason(err) ?? "call failed", 400);
    }
    const decoded = iface.decodeFunctionResult(fragment, resultData);
    return decoded.length === 1 ? decoded[0] : Array.from(decoded);
  }

  async callWrite(name: string, method: string, params: unknown[], from: string, idempotencyKey: string): Promise<WriteResult> {
    if (!isIdentity(from)) {
      throw new ContractGatewayError(`unknown identity: ${from}`, 400);
    }
    const { entry, iface } = this.resolveContract(name);
    const fragment = this.resolveFunction(iface, method);
    if (fragment.stateMutability === "view" || fragment.stateMutability === "pure") {
      throw new ContractGatewayError(`${method} is a read method — use GET`, 400);
    }

    const existing = this.idempotency.find(idempotencyKey);
    if (existing) {
      return { id: existing.txHash, status: "already_processed", nonce: existing.nonce };
    }

    const signer = this.signers[from];
    const data = this.encodeParams(iface, fragment, params);

    // D-09: estimate *before* reserving a nonce — a reverted estimate must
    // never touch nonce state (the my-besu-net regression this carries the fix for).
    let gasLimit: bigint;
    try {
      gasLimit = await this.provider.estimateGas({ to: entry.address, from: signer.address, data });
    } catch (err) {
      throw new ContractGatewayError(extractRevertReason(err) ?? "gas estimation failed", 400);
    }

    const nonce = this.nonces.reserve(from);
    let tx: { hash: string; wait(): Promise<unknown> };
    try {
      tx = await signer.sendTransaction({ to: entry.address, data, nonce, gasLimit, gasPrice: 0 });
    } catch (err) {
      this.nonces.reset(from, nonce);
      throw new ContractGatewayError(extractRevertReason(err) ?? "send failed", 400);
    }

    this.idempotency.record({
      key: idempotencyKey,
      identity: from,
      contractName: name,
      method,
      params,
      nonce,
      txHash: tx.hash,
      status: "pending",
    });

    tx.wait()
      .then(() => this.idempotency.updateStatus(idempotencyKey, "confirmed"))
      .catch((err: unknown) => this.idempotency.updateStatus(idempotencyKey, "error", extractRevertReason(err) ?? String(err)));

    return { id: tx.hash, status: "pending", nonce };
  }

  /// Attaches a live event relay for a registered contract (D-10). Called
  /// once at registration time and again at startup for every contract
  /// already in the registry, so listeners survive a restart.
  watch(name: string): void {
    const { entry, iface } = this.resolveContract(name);
    if (!(this.provider instanceof ethers.AbstractProvider)) {
      return; // test doubles for ProviderLike don't support live subscriptions — nothing to attach.
    }
    const contract = new ethers.Contract(entry.address, iface, this.provider);
    for (const fragment of iface.fragments) {
      if (fragment.type !== "event") continue;
      const eventFragment = fragment as ethers.EventFragment;
      contract.on(eventFragment.name, (...args: unknown[]) => {
        const payload = args[args.length - 1] as ethers.ContractEventPayload;
        const decodedArgs: Record<string, unknown> = {};
        for (const input of eventFragment.inputs) {
          if (!input.name) continue;
          const value = (payload.args as unknown as Record<string, unknown>)[input.name];
          decodedArgs[input.name] = typeof value === "bigint" ? value.toString() : value;
        }
        this.events.broadcast({
          contractName: name,
          address: entry.address,
          template: entry.template,
          eventName: eventFragment.name,
          blockNumber: payload.log.blockNumber,
          args: decodedArgs,
        });
      });
    }
  }

  private resolveContract(name: string): { entry: { address: string; template: string | null }; iface: ethers.Interface } {
    const entry = this.registry.get(name);
    if (!entry) {
      throw new ContractGatewayError(`unknown contract: ${name}`, 404);
    }
    return { entry, iface: new ethers.Interface(entry.abi as ethers.InterfaceAbi) };
  }

  private resolveFunction(iface: ethers.Interface, method: string): ethers.FunctionFragment {
    const fragment = iface.getFunction(method);
    if (!fragment) {
      throw new ContractGatewayError(`unknown method: ${method}`, 404);
    }
    return fragment;
  }

  /// ABI-encoding failures (wrong arity, malformed address, etc.) are a bad
  /// request, not a server fault — must surface as 400, same as any other
  /// rejected call, never bubble up as an unhandled 500.
  private encodeParams(iface: ethers.Interface, fragment: ethers.FunctionFragment, params: unknown[]): string {
    try {
      return iface.encodeFunctionData(fragment, params);
    } catch (err) {
      throw new ContractGatewayError(extractRevertReason(err) ?? "invalid params", 400);
    }
  }
}
