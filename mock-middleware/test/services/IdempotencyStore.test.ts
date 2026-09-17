import { openDatabase } from "../../src/db/db";
import { IdempotencyStore } from "../../src/services/IdempotencyStore";

describe("IdempotencyStore", () => {
  it("returns undefined for an unknown key", () => {
    const store = new IdempotencyStore(openDatabase(":memory:"));
    expect(store.find("nope")).toBeUndefined();
  });

  it("records and retrieves a transaction by key", () => {
    const store = new IdempotencyStore(openDatabase(":memory:"));
    store.record({
      key: "k1",
      identity: "admin",
      contractName: "token",
      method: "mint",
      params: ["0xabc", 10],
      nonce: 0,
      txHash: "0xhash1",
      status: "pending",
    });

    const found = store.find("k1");
    expect(found?.txHash).toBe("0xhash1");
    expect(found?.status).toBe("pending");
    expect(found?.params).toEqual(["0xabc", 10]);
  });

  it("updates status to confirmed", () => {
    const store = new IdempotencyStore(openDatabase(":memory:"));
    store.record({
      key: "k1",
      identity: "admin",
      contractName: "token",
      method: "mint",
      params: [],
      nonce: 0,
      txHash: "0xhash1",
      status: "pending",
    });

    store.updateStatus("k1", "confirmed");
    expect(store.find("k1")?.status).toBe("confirmed");
  });

  it("lists transactions by identity ordered by nonce", () => {
    const store = new IdempotencyStore(openDatabase(":memory:"));
    store.record({ key: "k2", identity: "admin", contractName: "token", method: "mint", params: [], nonce: 1, txHash: "0x2", status: "pending" });
    store.record({ key: "k1", identity: "admin", contractName: "token", method: "mint", params: [], nonce: 0, txHash: "0x1", status: "confirmed" });

    expect(store.listByIdentity("admin").map((t) => t.nonce)).toEqual([0, 1]);
  });
});
