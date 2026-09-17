import { DatabaseSync } from "node:sqlite";

interface NonceRow {
  next_nonce: number;
}

/// D-09: per-identity nonce sequencing, reset-on-revert, confirmation
/// tracking — guards against the bug class where ethers.NonceManager-style
/// tracking leaves a nonce reserved forever after a reverted
/// eth_estimateGas. The fix here is structural rather than a patched
/// reset() call: callers of this class
/// (ContractGatewayService) always run eth_estimateGas *before* calling
/// reserve(), so a reverted estimate never touches nonce state at all.
/// reset() exists for the one remaining edge case — sendTransaction itself
/// failing *after* a successful estimate — to roll back that reservation.
export class NonceTracker {
  private readonly cache = new Map<string, number>();

  constructor(
    private readonly db: DatabaseSync,
    private readonly getOnChainNonce: (identity: string) => Promise<number>,
  ) {}

  async init(identities: readonly string[]): Promise<void> {
    for (const identity of identities) {
      const row = this.db.prepare(`SELECT next_nonce FROM nonces WHERE identity = ?`).get(identity) as
        | NonceRow
        | undefined;
      if (row) {
        this.cache.set(identity, row.next_nonce);
      } else {
        const onChain = await this.getOnChainNonce(identity);
        this.cache.set(identity, onChain);
        this.persist(identity, onChain);
      }
    }
  }

  /// Reserves and returns the next nonce for `identity`. Synchronous and
  /// race-safe: Node's single-threaded event loop guarantees no other call
  /// can interleave between the read and the write here, since neither
  /// touches `await`.
  reserve(identity: string): number {
    const current = this.cache.get(identity) ?? 0;
    this.cache.set(identity, current + 1);
    this.persist(identity, current + 1);
    return current;
  }

  /// Rolls back a reservation that was never actually broadcast.
  reset(identity: string, toNonce: number): void {
    this.cache.set(identity, toNonce);
    this.persist(identity, toNonce);
  }

  /// Re-reads the on-chain nonce and overwrites the cache, discarding
  /// whatever was persisted before. init() intentionally trusts a persisted
  /// value over the chain (so a mid-flight reservation survives a restart),
  /// which means a restart alone can never recover from a *stale* cache —
  /// only this can. Needed when something advances an identity's on-chain
  /// nonce without going through this tracker at all: the deploy/CLI
  /// scripts under contracts/scripts/ sign with the same admin key directly
  /// against chain, the one deliberate exception to D-06 (docs/deliverables.md
  /// DL-2.x) — `npm run seed` calls this after every fresh deploy.
  async resync(identity: string): Promise<number> {
    const onChain = await this.getOnChainNonce(identity);
    this.cache.set(identity, onChain);
    this.persist(identity, onChain);
    return onChain;
  }

  peek(identity: string): number {
    return this.cache.get(identity) ?? 0;
  }

  private persist(identity: string, nextNonce: number): void {
    this.db
      .prepare(
        `INSERT INTO nonces (identity, next_nonce) VALUES (?, ?)
         ON CONFLICT(identity) DO UPDATE SET next_nonce = excluded.next_nonce`,
      )
      .run(identity, nextNonce);
  }
}
