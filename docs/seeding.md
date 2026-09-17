# Seeding — What `npm run seed` Does and How to Run It

> `npm run seed` (repo root) is what turns a freshly-started, empty stack into a working demo: deployed contracts, a populated `mock-middleware` registry, and two onboarded identities. This doc walks through every step it performs, in order, plus how to run it and what to do when a step fails.

---

## Prerequisites

The full stack must already be up and healthy — seeding doesn't start anything itself, it only configures what's already running.

```bash
docker compose up -d          # first time: add --build
docker compose ps             # wait until besu-rpc-anson, besu-rpc-beatrice,
                               # mock-middleware, and backend-api all show (healthy)
```

`.env.local` must exist with `ADMIN_PRIVATE_KEY`/`ADMIN_ADDRESS`, `ANSON_PRIVATE_KEY`/`ANSON_ADDRESS`, and `BEATRICE_PRIVATE_KEY`/`BEATRICE_ADDRESS` filled in (see README's "First time" checklist). `contracts/` must have its dependencies installed (`cd contracts && npm install`).

## How to run it

```bash
npm run seed
```

That's the whole command — it's `node scripts/seed.js` under the hood, and it runs to completion (or fails loudly) with no further input needed. It takes roughly 20–40 seconds on a healthy stack, most of which is waiting for QBFT block confirmations (one every ~2 seconds) across the 9 transactions the deploy step sends.

**You need to run this every time you start the stack from a `docker compose down -v`** — this project deliberately has no persistent Besu volume (D-15), so the chain resets to genesis (block 0, no contracts, no onboarded identities) every time. See README's "Running the Demo, Step by Step" for the full first-time-vs-not-first-time checklist.

---

## Step by step: what `scripts/seed.js` actually does

The script prints a numbered line for each step as it runs, so you can match the console output directly to this list.

### 1. Wait for Besu RPC

Polls `POST http://localhost:8545` with an `eth_blockNumber` call every 2 seconds, up to 30 tries (1 minute), until it gets a response. This exists so seeding can be run immediately after `docker compose up -d` without a separate manual wait — if the RPC nodes are still starting up, seed just waits rather than failing.

### 2. Deploy contracts (always fresh)

Runs `npm run deploy:besu` inside `contracts/`, which is `npx hardhat run scripts/deploy.ts --network besu`. This is a **direct Hardhat deployment**, signing with `ADMIN_PRIVATE_KEY` straight against `besu-rpc-anson` — it does **not** go through `mock-middleware` (the one deliberate exception to D-06, since `mock-middleware` has no "deploy new bytecode" capability by design, see `docs/mock-middleware-technical.md`).

This sends 9 transactions from the Admin account, in order: deploy `ClaimTopicsRegistry`, deploy `TrustedIssuersRegistry`, deploy `IdentityRegistryStorage`, deploy `IdentityRegistry`, `bindIdentityRegistry(...)`, `addTrustedIssuer(admin, KYC_TOPIC)`, deploy `BasicCompliance`, deploy `Token`, `bindToken(...)`. The script writes every resulting address to `deployed-addresses.json` at the repo root.

**Always redeploys, never reuses a stale `deployed-addresses.json`** — because the chain itself resets on every `docker compose down -v`, trusting old addresses would just point at contracts that no longer exist post-reset.

### 3. Wait for mock-middleware

Polls `GET http://localhost:5001/admin/nonce-status` until it responds `200`. Same "don't assume it's ready yet" pattern as step 1.

### 4. Resync mock-middleware's nonce cache

Calls `POST http://localhost:5001/admin/nonces/resync`.

This step exists because of what step 2 just did: `mock-middleware`'s `NonceTracker` caches the Admin identity's next nonce and persists it across restarts — but step 2 just sent 9 transactions from that same Admin key *directly to chain*, bypassing `mock-middleware` entirely. Without this resync, `mock-middleware`'s cached nonce is now 9 behind reality, and the very next write through it (step 7's onboarding calls) would fail with `nonce has already been used`. A plain container restart does **not** fix this on its own — `NonceTracker.init()` prefers whatever's already persisted over re-querying the chain, precisely so an in-flight reservation survives a restart. `resync()` is the only thing that force-overwrites the cache from a live `eth_getTransactionCount` query. Full explanation: `docs/mock-middleware-technical.md` §5.

The script prints the resulting nonce for every identity, e.g. `nonces: { admin: 9, anson: 0, beatrice: 0 }` — admin's should match however many admin-signed transactions have happened on this chain since genesis.

### 5. Register token + identityRegistry with mock-middleware

Reads `deployed-addresses.json` and the two contracts' ABIs from their Hardhat artifacts (`contracts/artifacts/contracts/Token.sol/Token.json` and `.../IdentityRegistry.sol/IdentityRegistry.json`), then calls `POST http://localhost:5001/admin/contracts` twice:

- `{name: "token", address: <deployed token address>, abi: [...], template: "ERC3643Token"}`
- `{name: "identityRegistry", address: <deployed identityRegistry address>, abi: [...]}`

This is the same thing the Admin tab's **Upload Contract** form does (see `docs/FAQ.md`'s "can I do it manually" entry) — the names `token` and `identityRegistry` matter specifically because `backend-api`'s `MockMiddlewareChainService` is hardcoded to look up contracts under exactly those two names. Registration is an upsert (`ON CONFLICT... DO UPDATE`), so re-running this against an already-registered name just overwrites the address/ABI rather than erroring.

### 6. Wait for backend-api

Polls `GET http://localhost:4000/transfers` until it responds `200`.

### 7. Onboard Anson and Beatrice, mint a starting balance

For each of `anson` and `beatrice`, in order:

- `POST http://localhost:4000/admin/register-identity {who}`
- `POST http://localhost:4000/admin/issue-claim {who}`

Then once, for Anson only:

- `POST http://localhost:4000/admin/mint {who: "anson", amount: 1000}`

This is exactly what clicking **Register → Issue Claim → Mint** on the Admin tab does — see `docs/playbook.md` Scenario 1 for the equivalent manual walkthrough, and `docs/FAQ.md` for why these three steps represent distinct real-world triggers that don't actually happen together outside a demo.

The script prints `Seed complete — Anson has 1000 COIN, Beatrice is verified with 0 COIN.` on success.

---

## Verifying it worked

```bash
curl http://localhost:4000/balance/anson
# {"who":"anson","balance":1000}

curl http://localhost:5001/contracts/token/name
# {"output":"Coin"}
```

Or just open `http://localhost:3000` — the Admin tab's Anson/Beatrice cards will show `verified` behavior immediately (register/issue-claim will report `registered`/`verified` as no-ops if you click them again), and the Transfer tab will show Anson's 1000 COIN balance.

---

## Re-running seed on a stack that's already seeded

You can run `npm run seed` again without tearing the stack down first — it's designed to be safe, but it's worth understanding exactly what happens, because it's **not** the same as a no-op:

- **Step 2 deploys a brand-new set of 6 contracts every time**, at new addresses — it never reuses the previous deployment. The *old* Token contract and everything minted/transferred on it still physically exists on chain (you can still find it via the Explorer tab if you know its old address), but nothing in the dashboard points at it anymore.
- **Step 5 overwrites the `token`/`identityRegistry` registration** in `mock-middleware` to point at the *new* addresses — so the dashboard immediately starts talking to the new contract set.
- **Step 7 re-onboards Anson/Beatrice against the new `IdentityRegistry`** and mints Anson a fresh 1000 COIN on the new `Token` — since it's a brand-new contract, this is not "add 1000 to whatever was there," it's genuinely starting from 0 again on a new instance.

In practice this means: running `npm run seed` twice in a row on a live stack gives you a clean, freshly-funded demo state again, but it does so by cutting over to an entirely new contract deployment, not by resetting balances on the existing one. If you specifically want the chain itself back at block 0, use `docker compose down -v` first (see README).

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Hangs at step 1 forever | `besu-rpc-anson` isn't healthy yet, or the stack isn't up at all | `docker compose ps` — wait for `(healthy)`, or `docker compose up -d` if nothing's running |
| Step 2 seems to hang with no output for a while | Normal — `deploy.ts` has no progress logging between its 9 sequential transactions, each waiting for a ~2s block confirmation. Also possible: a transient QBFT round-change stall under heavy local resource contention (rare, self-recovers within ~30–60s) | Check `docker compose logs besu-validator-1 --tail 20` for `Imported block`/`Produced` lines to confirm the chain is still progressing before assuming it's actually stuck |
| `Error: POST /admin/register-identity failed: nonce has already been used` | Step 4 (resync) didn't run, or ran before step 2 finished sending all 9 transactions | Re-run `npm run seed` from the top — the resync step will catch up correctly on a clean pass. If it recurs, check `curl -X POST http://localhost:5001/admin/nonces/resync` manually and inspect the returned nonces against `eth_getTransactionCount` on the admin address directly |
| `register token failed: ...` at step 5 | `mock-middleware` isn't actually healthy despite step 3 passing, or `deployed-addresses.json`/the Hardhat artifacts are missing | Confirm `contracts/artifacts/contracts/Token.sol/Token.json` exists (run `cd contracts && npm run compile` if not) and that `deployed-addresses.json` was actually written by step 2 |
| Everything succeeds but the dashboard still shows old balances | Browser cache / a stale page open from before the reseed | Reload `http://localhost:3000` — the frontend re-fetches balances on tab switch and on mount, it doesn't cache across a page reload |
