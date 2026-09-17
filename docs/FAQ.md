# FAQ

> Answers to specific "why does this work like that?" questions that come up while reading the code or running the demo. For the full picture, see [docs/architecture.md](architecture.md) (system design) or [docs/mock-middleware-technical.md](mock-middleware-technical.md) (gateway internals).

---

### The validator and RPC node service definitions in `docker-compose.yml` look almost identical. How does Besu tell them apart?

Not by container name or by anything in `docker-compose.yml` at all — by **whether the node's private key's address appears in `genesis.json`'s `extraData` field.**

`network-config/genesis.json`'s `extraData` was written once, at genesis-generation time (Phase 1, M1.1), with exactly 4 validator addresses baked in. Besu doesn't care what a node is called; it only checks whether the node's own identity (derived from whichever private key it was started with) matches one of those 4 addresses.

- `besu-validator-1..4` each get `--node-private-key-file=/data/key`, pointing at `validator-keys/validator-{1..4}/key` — the exact 4 keys whose addresses are in `extraData`. That's what gives them QBFT proposing/voting rights.
- `besu-rpc-anson`/`besu-rpc-beatrice` have **no** `--node-private-key-file` flag at all. Besu auto-generates a random ephemeral node key for them instead, which is (by construction) never one of the 4 addresses in `extraData` — so these nodes sync and serve RPC, but never propose or vote on a block.

If you added `--node-private-key-file` pointing at `validator-1/key` to `besu-rpc-anson`, it would become a validator — and collide with `besu-validator-1`, since they'd share the same on-chain identity. The role is entirely a function of the key, not the container.

Everything else that differs between the two groups (`--rpc-ws-enabled`, published `ports:`, `depends_on`, static IP ranges `.11`–`.14` vs `.21`–`.22`) is operational convenience, not part of how consensus membership is decided.

One more detail: `network-config/static-nodes.json` lists only the 4 validator enodes. Every node — including the RPC nodes themselves — dials out to those 4 on startup; nothing is configured to dial the RPC nodes back. They're reachable purely because Besu's own peer discovery finds them once the initial connections are up, not because anything statically points at them.

---

### Why does the block count keep going up every time I open the Explorer tab, even when nobody's doing anything?

Because this is a QBFT chain with a **fixed block period**, not a "block only when there's a transaction" chain. `network-config/genesis.json`'s `qbft.blockperiodseconds` is `2` — every 2 seconds, whichever validator is up for its round proposes a new block, empty or not. You'll see plenty of `Tx count: 0` rows in the Recent Blocks table for exactly this reason.

So "Latest block" is a snapshot of wherever the chain happens to be the instant you look, not a value that only moves when you do something. Leave the tab open for a minute and refresh — it'll have climbed by roughly 30 blocks, transaction or no transaction.

This tradeoff is deliberate: fixed block period means every transaction confirms within ~2 seconds no matter what else is happening, at the cost of the chain growing continuously even when idle. It's not a problem here because there's no persistent Besu volume (D-15) — `docker compose down -v` resets everything back to block 0.

---

### Why does `contracts/` have a nested `contracts/contracts/` folder?

Two different reasons stacked on top of each other:

1. **The outer `contracts/`** is one of this repo's independent npm sub-projects (alongside `mock-middleware/`, `backend-api/`, `frontend/`), each with its own `package.json`. This is just repo-level layering, unrelated to Solidity.
2. **The inner `contracts/contracts/`** is a Hardhat convention, not something specific to this repo — Hardhat expects `.sol` source files in a subdirectory literally named `contracts` by default (see `contracts/hardhat.config.ts`'s `paths.sources: "./contracts"`). `test/`, `scripts/`, `cache/`, `artifacts/`, and `typechain-types/` sitting next to it are the same story — standard Hardhat project layout, present in any Hardhat project.

There's a third, intentional layer beyond those two: `contracts/contracts/compliance/` groups `BasicCompliance.sol` and its interface `IModularCompliance.sol` separately from the core T-REX contracts. `Token.sol` only ever depends on the `IModularCompliance` interface, never on a concrete implementation — keeping the concrete module in its own folder makes that "swappable compliance module" design (D-01) visible in the file layout, not just in the code. A future country-restriction or max-holder-count module would go in the same folder.
