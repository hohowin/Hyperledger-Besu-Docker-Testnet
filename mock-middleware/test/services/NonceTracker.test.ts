import { openDatabase } from "../../src/db/db";
import { NonceTracker } from "../../src/services/NonceTracker";

describe("NonceTracker", () => {
  it("initializes from the on-chain nonce when no local state exists", async () => {
    const tracker = new NonceTracker(openDatabase(":memory:"), async () => 5);
    await tracker.init(["admin"]);
    expect(tracker.peek("admin")).toBe(5);
  });

  it("reserves sequential nonces without re-querying the chain", async () => {
    const onChain = jest.fn().mockResolvedValue(0);
    const tracker = new NonceTracker(openDatabase(":memory:"), onChain);
    await tracker.init(["admin"]);

    expect(tracker.reserve("admin")).toBe(0);
    expect(tracker.reserve("admin")).toBe(1);
    expect(tracker.reserve("admin")).toBe(2);
    expect(onChain).toHaveBeenCalledTimes(1);
  });

  it("persists reservations across tracker instances against the same db (survives restart)", async () => {
    const db = openDatabase(":memory:");
    const trackerA = new NonceTracker(db, async () => 0);
    await trackerA.init(["admin"]);
    trackerA.reserve("admin");
    trackerA.reserve("admin");

    const trackerB = new NonceTracker(db, async () => {
      throw new Error("should not re-query chain — local state already exists");
    });
    await trackerB.init(["admin"]);
    expect(trackerB.peek("admin")).toBe(2);
  });

  it("reset() rolls back a reservation that was never broadcast (my-besu-net regression)", async () => {
    const tracker = new NonceTracker(openDatabase(":memory:"), async () => 0);
    await tracker.init(["admin"]);

    const reserved = tracker.reserve("admin");
    // Simulate sendTransaction itself failing after a successful gas estimate.
    tracker.reset("admin", reserved);

    expect(tracker.peek("admin")).toBe(reserved);
    expect(tracker.reserve("admin")).toBe(reserved); // nonce is reusable, not skipped forever
  });

  it("resync() overwrites a stale cache with the real on-chain nonce, unlike a restart", async () => {
    const db = openDatabase(":memory:");
    let onChainNonce = 0;
    const tracker = new NonceTracker(db, async () => onChainNonce);
    await tracker.init(["admin"]);
    expect(tracker.peek("admin")).toBe(0);

    // Something outside this tracker (e.g. contracts/scripts/deploy.ts
    // signing directly against chain) advances the real nonce to 9 without
    // this tracker ever seeing it.
    onChainNonce = 9;

    // A restart would reload the stale persisted value (0) — resync must not.
    const restarted = new NonceTracker(db, async () => onChainNonce);
    await restarted.init(["admin"]);
    expect(restarted.peek("admin")).toBe(0);

    await expect(restarted.resync("admin")).resolves.toBe(9);
    expect(restarted.peek("admin")).toBe(9);
  });
});
