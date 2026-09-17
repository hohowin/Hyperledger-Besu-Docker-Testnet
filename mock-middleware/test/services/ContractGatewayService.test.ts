import { Interface } from "ethers";
import { openDatabase } from "../../src/db/db";
import { ContractRegistryService } from "../../src/services/ContractRegistryService";
import { IdempotencyStore } from "../../src/services/IdempotencyStore";
import { NonceTracker } from "../../src/services/NonceTracker";
import { EventSubscriptionService } from "../../src/services/EventSubscriptionService";
import { ContractGatewayService, ProviderLike, SignerLike } from "../../src/services/ContractGatewayService";
import { Identity } from "../../src/identities";

const TOKEN_ABI = ["function name() view returns (string)", "function mint(address to, uint256 amount) external"];
const TOKEN_ADDRESS = "0x" + "1".repeat(40);
const ADMIN_ADDRESS = "0x" + "2".repeat(40);
const ANSON_ADDRESS = "0x" + "3".repeat(40);

function setup() {
  const db = openDatabase(":memory:");
  const registry = new ContractRegistryService(db);
  registry.register({ name: "token", address: TOKEN_ADDRESS, abi: TOKEN_ABI });
  const idempotency = new IdempotencyStore(db);
  const nonceTracker = new NonceTracker(db, async () => 0);
  return { registry, idempotency, nonceTracker };
}

describe("ContractGatewayService — write path", () => {
  it("sends exactly one transaction for two POSTs with the same Idempotency-Key (DL-3.2)", async () => {
    const { registry, idempotency, nonceTracker } = setup();
    await nonceTracker.init(["admin"]);

    const sendTransaction = jest.fn().mockResolvedValue({ hash: "0xdeadbeef", wait: () => new Promise(() => undefined) });
    const provider: ProviderLike = { estimateGas: jest.fn().mockResolvedValue(21000n), call: jest.fn() };
    const signers = { admin: { address: ADMIN_ADDRESS, sendTransaction } } as unknown as Record<Identity, SignerLike>;

    const gateway = new ContractGatewayService(registry, idempotency, nonceTracker, provider, signers, new EventSubscriptionService());

    const first = await gateway.callWrite("token", "mint", [ANSON_ADDRESS, 10], "admin", "same-key");
    const second = await gateway.callWrite("token", "mint", [ANSON_ADDRESS, 10], "admin", "same-key");

    expect(first.id).toBe("0xdeadbeef");
    expect(second.id).toBe("0xdeadbeef");
    expect(second.status).toBe("already_processed");
    expect(sendTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns 400 without touching the nonce when eth_estimateGas reverts (DL-3.3, nonce-leak regression)", async () => {
    const { registry, idempotency, nonceTracker } = setup();
    await nonceTracker.init(["admin"]);
    const nonceBefore = nonceTracker.peek("admin");

    const sendTransaction = jest.fn();
    const provider: ProviderLike = {
      estimateGas: jest.fn().mockRejectedValue({ reason: "Token: recipient not verified" }),
      call: jest.fn(),
    };
    const signers = { admin: { address: ADMIN_ADDRESS, sendTransaction } } as unknown as Record<Identity, SignerLike>;

    const gateway = new ContractGatewayService(registry, idempotency, nonceTracker, provider, signers, new EventSubscriptionService());

    await expect(gateway.callWrite("token", "mint", [ANSON_ADDRESS, 10], "admin", "k1")).rejects.toMatchObject({
      status: 400,
      message: "Token: recipient not verified",
    });
    expect(sendTransaction).not.toHaveBeenCalled();
    expect(nonceTracker.peek("admin")).toBe(nonceBefore);
  });

  it("rejects an unknown identity before ever calling the chain", async () => {
    const { registry, idempotency, nonceTracker } = setup();
    await nonceTracker.init(["admin"]);
    const estimateGas = jest.fn();
    const provider: ProviderLike = { estimateGas, call: jest.fn() };

    const gateway = new ContractGatewayService(registry, idempotency, nonceTracker, provider, {} as Record<Identity, SignerLike>, new EventSubscriptionService());

    await expect(gateway.callWrite("token", "mint", [ANSON_ADDRESS, 10], "stranger", "k1")).rejects.toMatchObject({ status: 400 });
    expect(estimateGas).not.toHaveBeenCalled();
  });

  it("returns 400, not a 500, for a malformed param (e.g. an invalid address)", async () => {
    const { registry, idempotency, nonceTracker } = setup();
    await nonceTracker.init(["admin"]);
    const estimateGas = jest.fn();
    const provider: ProviderLike = { estimateGas, call: jest.fn() };
    const signers = { admin: { address: ADMIN_ADDRESS, sendTransaction: jest.fn() } } as unknown as Record<Identity, SignerLike>;

    const gateway = new ContractGatewayService(registry, idempotency, nonceTracker, provider, signers, new EventSubscriptionService());

    await expect(gateway.callWrite("token", "mint", ["not-an-address", 10], "admin", "k1")).rejects.toMatchObject({ status: 400 });
    expect(estimateGas).not.toHaveBeenCalled();
  });
});

describe("ContractGatewayService — read path", () => {
  it("decodes a view call result (DL-3.1)", async () => {
    const { registry, idempotency, nonceTracker } = setup();
    const iface = new Interface(TOKEN_ABI);
    const encodedResult = iface.encodeFunctionResult("name", ["Coin"]);
    const provider: ProviderLike = { call: jest.fn().mockResolvedValue(encodedResult), estimateGas: jest.fn() };

    const gateway = new ContractGatewayService(registry, idempotency, nonceTracker, provider, {} as Record<Identity, SignerLike>, new EventSubscriptionService());

    await expect(gateway.callRead("token", "name", [])).resolves.toBe("Coin");
  });

  it("rejects a GET against a state-mutating method", async () => {
    const { registry, idempotency, nonceTracker } = setup();
    const provider: ProviderLike = { call: jest.fn(), estimateGas: jest.fn() };
    const gateway = new ContractGatewayService(registry, idempotency, nonceTracker, provider, {} as Record<Identity, SignerLike>, new EventSubscriptionService());

    await expect(gateway.callRead("token", "mint", [ANSON_ADDRESS, 10])).rejects.toMatchObject({ status: 400 });
  });
});
