import { ComplianceAdminService } from "../../src/services/ComplianceAdminService";
import { ChainServiceLike } from "../../src/chain/ChainService";
import { ComplianceRejectedError } from "../../src/chain/errors";

function makeChain(overrides: Partial<Record<"identityRegistry" | "token", any>> = {}): ChainServiceLike {
  const addresses: Record<string, string> = {
    admin: "0xAdmin000000000000000000000000000000001",
    anson: "0xAnson0000000000000000000000000000000001",
    beatrice: "0xBeatrice000000000000000000000000000001",
  };

  const registryDefault = {
    isRegistered: jest.fn().mockResolvedValue(false),
    isVerified: jest.fn().mockResolvedValue(false),
    registerIdentity: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({}) }),
    issueClaim: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({}) }),
  };
  const tokenDefault = {
    mint: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({}) }),
    balanceOf: jest.fn().mockResolvedValue(100n),
  };

  return {
    getAddress: (identity) => addresses[identity],
    identityRegistry: () => ({ ...registryDefault, ...overrides.identityRegistry }) as any,
    token: () => (overrides.token ?? tokenDefault) as any,
    resetNonce: jest.fn(),
  };
}

describe("ComplianceAdminService", () => {
  it("registers an identity", async () => {
    const chain = makeChain();
    const service = new ComplianceAdminService(chain);
    await expect(service.registerIdentity("anson")).resolves.toEqual({ status: "registered" });
  });

  it("issues a claim", async () => {
    const chain = makeChain();
    const service = new ComplianceAdminService(chain);
    await expect(service.issueClaim("anson")).resolves.toEqual({ status: "verified" });
  });

  it("mints and returns the resulting balance", async () => {
    const chain = makeChain();
    const service = new ComplianceAdminService(chain);
    await expect(service.mint("anson", 100)).resolves.toEqual({ status: "minted", balance: 100 });
  });

  it("registering the same address twice is a no-op, not a throw (US-003)", async () => {
    const chain = makeChain();
    const service = new ComplianceAdminService(chain);
    await service.registerIdentity("anson");
    await expect(service.registerIdentity("anson")).resolves.toEqual({ status: "registered" });
  });

  it("skips sending a transaction when already registered/verified", async () => {
    const registerIdentity = jest.fn();
    const issueClaim = jest.fn();
    const chain = makeChain({
      identityRegistry: {
        isRegistered: jest.fn().mockResolvedValue(true),
        isVerified: jest.fn().mockResolvedValue(true),
        registerIdentity,
        issueClaim,
      },
    });
    const service = new ComplianceAdminService(chain);

    await service.registerIdentity("anson");
    await service.issueClaim("anson");

    expect(registerIdentity).not.toHaveBeenCalled();
    expect(issueClaim).not.toHaveBeenCalled();
  });

  it("converts a chain revert into a ComplianceRejectedError with the readable reason", async () => {
    const chain = makeChain({
      token: {
        mint: jest.fn().mockRejectedValue({ reason: "Token: recipient not verified" }),
      },
    });
    const service = new ComplianceAdminService(chain);

    await expect(service.mint("anson", 100)).rejects.toBeInstanceOf(ComplianceRejectedError);
    await expect(service.mint("anson", 100)).rejects.toThrow("Token: recipient not verified");
    expect(chain.resetNonce).toHaveBeenCalledWith("admin");
  });

  it("rejects issueClaim for an unregistered wallet with a readable reason", async () => {
    const chain = makeChain({
      identityRegistry: {
        issueClaim: jest.fn().mockRejectedValue({ reason: "IdentityRegistry: wallet not registered" }),
      },
    });
    const service = new ComplianceAdminService(chain);

    await expect(service.issueClaim("anson")).rejects.toThrow("IdentityRegistry: wallet not registered");
  });
});
