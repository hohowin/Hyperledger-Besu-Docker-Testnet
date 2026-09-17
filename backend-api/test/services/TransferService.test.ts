import { TransferService } from "../../src/services/TransferService";
import { ChainServiceLike } from "../../src/chain/ChainService";
import { AuditLogRepositoryLike, TransferRecord } from "../../src/db/AuditLogRepository";
import { ComplianceRejectedError } from "../../src/chain/errors";

function makeAuditLog(): AuditLogRepositoryLike & { records: TransferRecord[] } {
  const records: TransferRecord[] = [];
  return {
    records,
    recordTransfer: jest.fn((record: TransferRecord) => {
      records.push(record);
    }),
    listTransfers: () => records,
  };
}

function makeChain(transferImpl?: jest.Mock): ChainServiceLike {
  const addresses: Record<string, string> = {
    admin: "0xAdmin000000000000000000000000000000001",
    anson: "0xAnson0000000000000000000000000000000001",
    beatrice: "0xBeatrice000000000000000000000000000001",
  };

  const transfer = transferImpl ?? jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xtxhash" }) });

  const balanceOf = jest.fn().mockImplementation((address: string) => {
    if (address === addresses.anson) return Promise.resolve(50n);
    if (address === addresses.beatrice) return Promise.resolve(50n);
    return Promise.resolve(0n);
  });

  return {
    getAddress: (identity) => addresses[identity],
    identityRegistry: () => ({}) as any,
    token: () => ({ transfer, balanceOf }) as any,
    resetNonce: jest.fn(),
  };
}

describe("TransferService", () => {
  it("writes to the audit log only after a confirmed transfer (US-006/US-007)", async () => {
    const chain = makeChain();
    const auditLog = makeAuditLog();
    const service = new TransferService(chain, auditLog);

    const result = await service.transfer("anson", "beatrice", 50);

    expect(result).toEqual({ status: "success", balances: { anson: 50, beatrice: 50 } });
    expect(auditLog.records).toHaveLength(1);
    expect(auditLog.records[0]).toMatchObject({
      from: "0xAnson0000000000000000000000000000000001",
      to: "0xBeatrice000000000000000000000000000001",
      amount: 50,
      txHash: "0xtxhash",
    });
  });

  it("does not write to the audit log when the on-chain transfer reverts (compliance-rejection error path)", async () => {
    const failingTransfer = jest.fn().mockRejectedValue({ reason: "Token: recipient not verified" });
    const chain = makeChain(failingTransfer);
    const auditLog = makeAuditLog();
    const service = new TransferService(chain, auditLog);

    await expect(service.transfer("anson", "beatrice", 50)).rejects.toBeInstanceOf(ComplianceRejectedError);
    expect(auditLog.records).toHaveLength(0);
  });

  it("resets the sender's nonce cache on a failed send", async () => {
    const failingTransfer = jest.fn().mockRejectedValue({ reason: "Token: recipient not verified" });
    const chain = makeChain(failingTransfer);
    const service = new TransferService(chain, makeAuditLog());

    await expect(service.transfer("anson", "beatrice", 50)).rejects.toThrow();
    expect(chain.resetNonce).toHaveBeenCalledWith("anson");
  });
});
