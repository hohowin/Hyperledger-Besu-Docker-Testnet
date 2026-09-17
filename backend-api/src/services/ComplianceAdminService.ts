import { ChainServiceLike } from "../chain/ChainService";
import { toComplianceError } from "../chain/errors";
import { Identity } from "../identities";

const KYC_TOPIC = 1;

/// Orchestrates the fixed 3-step onboarding sequence (register -> claim ->
/// mint) as one coherent action per caller (US-003/004/005). The ordering
/// invariant is also enforced on-chain (architecture.md §8) — this class
/// exists so a caller gets a clear, typed failure instead of a raw revert.
export class ComplianceAdminService {
  constructor(private readonly chain: ChainServiceLike) {}

  async registerIdentity(who: Identity): Promise<{ status: "registered" }> {
    const wallet = this.chain.getAddress(who);
    const registry = this.chain.identityRegistry("admin");
    try {
      // The contract itself is idempotent (US-003) — but skipping the send
      // entirely when already registered also avoids paying a full
      // block-confirmation cycle for a call that would just no-op on-chain.
      const alreadyRegistered: boolean = await registry.isRegistered(wallet);
      if (!alreadyRegistered) {
        const tx = await registry.registerIdentity(wallet);
        await tx.wait();
      }
    } catch (err) {
      this.chain.resetNonce("admin");
      throw toComplianceError(err);
    }
    return { status: "registered" };
  }

  async issueClaim(who: Identity): Promise<{ status: "verified" }> {
    const wallet = this.chain.getAddress(who);
    const registry = this.chain.identityRegistry("admin");
    try {
      const alreadyVerified: boolean = await registry.isVerified(wallet);
      if (!alreadyVerified) {
        const tx = await registry.issueClaim(wallet, KYC_TOPIC);
        await tx.wait();
      }
    } catch (err) {
      this.chain.resetNonce("admin");
      throw toComplianceError(err);
    }
    return { status: "verified" };
  }

  async mint(who: Identity, amount: number): Promise<{ status: "minted"; balance: number }> {
    const wallet = this.chain.getAddress(who);
    const token = this.chain.token("admin");
    try {
      const tx = await token.mint(wallet, amount);
      await tx.wait();
    } catch (err) {
      this.chain.resetNonce("admin");
      throw toComplianceError(err);
    }
    const balance: bigint = await token.balanceOf(wallet);
    return { status: "minted", balance: Number(balance) };
  }
}
