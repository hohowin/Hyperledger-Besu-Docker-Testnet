import { ChainServiceLike } from "../chain/ChainService";
import { toComplianceError } from "../chain/errors";
import { AuditLogRepositoryLike } from "../db/AuditLogRepository";
import { Identity } from "../identities";

/// A transfer is really two things — an on-chain call and an audit log
/// write — presented as one action (architecture.md §6). The audit log is
/// only ever written after a confirmed receipt (US-006/US-007): if the
/// on-chain call reverts, no row is written; if it succeeds but the SQLite
/// write itself fails, the chain transfer still stands (documented gap, R5).
export class TransferService {
  constructor(
    private readonly chain: ChainServiceLike,
    private readonly auditLog: AuditLogRepositoryLike,
  ) {}

  async transfer(from: Identity, to: Identity, amount: number): Promise<{ status: "success"; balances: Record<string, number> }> {
    const fromAddress = this.chain.getAddress(from);
    const toAddress = this.chain.getAddress(to);
    const token = this.chain.token(from);

    let txHash: string;
    try {
      const tx = await token.transfer(toAddress, amount);
      const receipt = await tx.wait();
      txHash = receipt.hash;
    } catch (err) {
      this.chain.resetNonce(from);
      throw toComplianceError(err);
    }

    this.auditLog.recordTransfer({
      from: fromAddress,
      to: toAddress,
      amount,
      txHash,
      timestamp: new Date().toISOString(),
    });

    const [fromBalance, toBalance]: [bigint, bigint] = await Promise.all([token.balanceOf(fromAddress), token.balanceOf(toAddress)]);

    return {
      status: "success",
      balances: { [from]: Number(fromBalance), [to]: Number(toBalance) },
    };
  }
}
