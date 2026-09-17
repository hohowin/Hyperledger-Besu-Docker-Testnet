Owner: Howin Ho
Created: 2026-09-15
Status: Draft

Companion docs: [docs/plan.md](plan.md) · [docs/prd.md](prd.md) · [docs/architecture.md](architecture.md) · [docs/use-cases.md](use-cases.md)

This document is the single reference for what is deliverable and verifiable at the end of each project phase, and how to try each deliverable from a cold start.

---

## §1 Overview Table

| DL-ID | Phase | Milestone | Type | Deliverable | Status |
|---|---|---|---|---|---|
| DL-1.1 | Phase 1 — Network | M1.1 | infra | 4-validator QBFT genesis config | Planned |
| DL-1.2 | Phase 1 — Network | M1.2 | infra | 4 validators peered, `f=1` fault-tolerance proof | Planned |
| DL-1.3 | Phase 1 — Network | M1.3 | infra | 2 RPC nodes peered, two-node consistency proof | Planned |
| DL-2.1 | Phase 2 — Contracts | N/A | infra | `COIN` token deployed (T-REX fork) | Planned |
| DL-2.2 | Phase 2 — Contracts | N/A | test | Hardhat test suite incl. compliance-rejection | Planned |
| DL-2.3 | Phase 2 — Contracts | N/A | api | Admin CLI scripts (register/claim/mint/transfer) | Planned |
| DL-3.1 | Phase 3 — mock-middleware | N/A | api | ABI upload -> dynamic REST (`ContractRegistryService`) | Planned |
| DL-3.2 | Phase 3 — mock-middleware | N/A | api | Idempotent delivery (`IdempotencyStore`) | Planned |
| DL-3.3 | Phase 3 — mock-middleware | N/A | api | Nonce tracking + `/admin/nonce-status` | Planned |
| DL-3.4 | Phase 3 — mock-middleware | N/A | api | WebSocket event subscription | Planned |
| DL-4.1 | Phase 4 — backend-api | N/A | infra | `MockMiddlewareChainService` + 6 original REST routes | Planned |
| DL-4.2 | Phase 4 — backend-api | N/A | api | Explorer read-only proxy with node allowlist | Planned |
| DL-4.3 | Phase 4 — backend-api | N/A | test | Service-layer unit tests + key-leak spot check | Planned |
| DL-5.1 | Phase 5 — Frontend+Explorer+E2E | N/A | ui | Admin panel incl. ABI-upload form | Planned |
| DL-5.2 | Phase 5 — Frontend+Explorer+E2E | N/A | ui | Transfer tab | Planned |
| DL-5.3 | Phase 5 — Frontend+Explorer+E2E | N/A | ui | Explorer tab (View-as switch, pending panel) | Planned |
| DL-5.4 | Phase 5 — Frontend+Explorer+E2E | N/A | test | 6 Playwright specs green, non-flaky across 3 runs | Planned |

---

## §2 Phase 1 — Network

**Goal**: A developer can boot a 4-validator QBFT network with 2 RPC nodes and prove it tolerates one validator dying.

**Prerequisites**:

```
Checklist:
- [ ] Docker + Docker Compose installed
- [ ] Repo cloned, working directory is repo root
- [ ] No prior Besu containers running on ports 8545/8546/8555/8556
```

---

##### DL-1.1 — 4-validator QBFT genesis config

| Field | Value |
|---|---|
| **Type** | infra |
| **Phase** | Phase 1 — Network |
| **Milestone** | M1.1 |
| **Traces to** | `plan.md` D-04, PRD FR-1 |
| **Demo surface** | inspecting generated files |

**What it is**: A QBFT genesis file listing all 4 validator addresses, plus 4 validator key pairs, that a Besu node can boot from.

**How to try it**:
```
1. cd network-config
2. Generate 4 keys and the genesis using Besu's operator CLI, per docs/deliverables.md §5 setup script (see below)
3. cat genesis.json | grep -A5 '"qbft"'
```

**Verification checklist**:
- [ ] `network-config/genesis.json` exists and contains a `qbft` config block
- [ ] `extraData` in `genesis.json` lists exactly 4 validator addresses
- [ ] 4 key files exist under `network-config/validator-keys/`
- [ ] `docker compose config` exits 0

**Known limitations at this phase**: no containers are running yet — this deliverable is files-on-disk only, proven live in DL-1.2.

---

##### DL-1.2 — 4 validators peered, f=1 fault-tolerance proof

| Field | Value |
|---|---|
| **Type** | infra |
| **Phase** | Phase 1 — Network |
| **Milestone** | M1.2 |
| **Traces to** | `plan.md` D-04, M1.2 exit gate, PRD US-001 |
| **Demo surface** | `docker compose logs`, `docker stop`/`start` |

**What it is**: A live QBFT network with genuine Byzantine fault tolerance — the chain keeps producing blocks with 1 of 4 validators down.

**How to try it**:
```
1. docker compose up -d besu-validator-1 besu-validator-2 besu-validator-3 besu-validator-4
2. docker compose ps
3. docker compose logs besu-validator-1 | grep -i peer
4. docker stop besu-validator-4
5. Wait 30 seconds
6. docker compose logs besu-validator-1 --tail 20
7. docker start besu-validator-4
```

**Verification checklist**:
- [ ] All 4 containers show `running`, no restart loop
- [ ] Peer count >= 3 in `besu-validator-1`'s logs before the stop test
- [ ] Log timestamps show new blocks continuing to be proposed after `besu-validator-4` is stopped
- [ ] `besu-validator-4` rejoins cleanly after `docker start` (no manual intervention needed)

**Known limitations at this phase**: no RPC node is running yet, so block height can only be observed via validator logs, not `eth_blockNumber` — that's proven in DL-1.3.

---

##### DL-1.3 — 2 RPC nodes peered, two-node consistency proof

| Field | Value |
|---|---|
| **Type** | infra |
| **Phase** | Phase 1 — Network |
| **Milestone** | M1.3 |
| **Traces to** | `plan.md` D-03, Phase 1 exit gate, PRD US-002 |
| **Demo surface** | `curl http://localhost:8545`, `curl http://localhost:8555` |

**What it is**: Two independently addressable, identically-behaving RPC endpoints, one nominally "Anson's" and one "Beatrice's".

**How to try it**:
```
1. docker compose up -d besu-rpc-anson besu-rpc-beatrice
2. docker compose ps
3. curl -s -X POST http://localhost:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
4. curl -s -X POST http://localhost:8555 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
5. curl -s -X POST http://localhost:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}'
```

**Verification checklist**:
- [ ] Both containers `running`, peered to all 4 validators
- [ ] Both `eth_blockNumber` responses report the same block height (+/-1) when run 5 seconds apart
- [ ] `eth_gasPrice` returns `0x0` on both endpoints

**Known limitations at this phase**: no contracts, no `mock-middleware`, no `backend-api`, no `frontend` yet.

**Phase exit gate summary** (see `plan.md` §4 Phase 1 for full text):
- [ ] All DL-1.1 to DL-1.3 verified
- [ ] Both RPC nodes healthy and consistent, `eth_gasPrice = 0x0`
- [ ] Chain tolerates 1 of 4 validators dying without halting

---

## §3 Phase 2 — Contracts

**Goal**: The trimmed T-REX suite, renamed to `COIN`, is deployed on the Phase 1 network and actually enforces compliance.

**Prerequisites**:

```
Checklist:
- [ ] Phase 1 exit gate passed (DL-1.1 to DL-1.3)
- [ ] cd contracts && npm install
- [ ] .env.local populated with ADMIN_PRIVATE_KEY (see §6 setup script)
```

---

##### DL-2.1 — `COIN` token deployed (T-REX fork)

| Field | Value |
|---|---|
| **Type** | infra |
| **Phase** | Phase 2 — Contracts |
| **Milestone** | N/A |
| **Traces to** | `plan.md` D-01, PRD FR-3, US-003 |
| **Demo surface** | `deployed-addresses.json`, `npx hardhat compile` |

**What it is**: The 6-contract trimmed T-REX suite, with the token named `Coin`/`COIN`.

**How to try it**:
```
1. cd contracts
2. npx hardhat compile
3. npx hardhat run scripts/deploy.ts --network besu
4. cat ../deployed-addresses.json
```

**Verification checklist**:
- [ ] `npx hardhat compile` exits 0
- [ ] `deployed-addresses.json` contains 6 non-zero contract addresses
- [ ] `Token.sol`'s constructor reads `ERC20("Coin", "COIN")`

**Known limitations at this phase**: deployed against Phase 1's 4-validator/2-RPC network directly via ethers.js — this is the last point in the plan where anything talks to chain outside `mock-middleware` (Phase 3 removes that path for the application layer).

---

##### DL-2.2 — Hardhat test suite incl. compliance-rejection

| Field | Value |
|---|---|
| **Type** | test |
| **Phase** | Phase 2 — Contracts |
| **Milestone** | N/A |
| **Traces to** | `plan.md` Phase 2 anti-gate, PRD FR-3 |
| **Demo surface** | `npx hardhat test` |

**What it is**: Automated proof that the compliance guarantee (transfers revert for unverified parties) actually holds on the deployed contracts.

**How to try it**:
```
1. cd contracts
2. npx hardhat test
```

**Verification checklist**:
- [ ] All tests pass, including a test asserting `transfer()` reverts for an unverified recipient
- [ ] A test asserting `transfer()` succeeds for a verified recipient also passes

**Known limitations at this phase**: none.

---

##### DL-2.3 — Admin CLI scripts

| Field | Value |
|---|---|
| **Type** | api |
| **Phase** | Phase 2 — Contracts |
| **Milestone** | N/A |
| **Traces to** | `plan.md` Phase 2 exit gate |
| **Demo surface** | `npx hardhat run scripts/*.ts --network besu` |

**What it is**: Command-line scripts to register an identity, issue a claim, mint tokens, and transfer, usable without the UI (useful for debugging Phase 3/4 without the full stack).

**How to try it**:
```
1. cd contracts
2. WALLET=<anson-address> npx hardhat run scripts/registerIdentity.ts --network besu
3. WALLET=<anson-address> npx hardhat run scripts/issueClaim.ts --network besu
4. WALLET=<anson-address> AMOUNT=1000 npx hardhat run scripts/mintToken.ts --network besu
5. FROM=<anson-address> TO=<beatrice-address> AMOUNT=10 npx hardhat run scripts/transfer.ts --network besu
```

**Verification checklist**:
- [ ] After step 2, the address shows `registered` but not yet `verified`
- [ ] After step 3, the address shows `verified`
- [ ] After step 4, the address's `COIN` balance is 1000
- [ ] After step 5, the balance moves from Anson to Beatrice

**Known limitations at this phase**: replace `<anson-address>`/`<beatrice-address>` with the addresses generated in your `.env.local` (see §6 setup script).

**Phase exit gate summary** (see `plan.md` §4 Phase 2 for full text):
- [ ] DL-2.1 to DL-2.3 verified
- [ ] `npx hardhat test` green including the compliance-rejection test
- [ ] `deployed-addresses.json` available for Phase 3

---

## §4 Phase 3 — mock-middleware

**Goal**: A generic ABI-driven gateway becomes the network's sole chain transport, with ABI-upload-to-REST, exactly-once delivery, nonce tracking, and event subscription.

**Prerequisites**:

```
Checklist:
- [ ] Phase 2 exit gate passed (DL-2.1 to DL-2.3)
- [ ] cd mock-middleware && npm install
- [ ] .env.local includes ADMIN_PRIVATE_KEY, ANSON_PRIVATE_KEY, BEATRICE_PRIVATE_KEY
```

---

##### DL-3.1 — ABI upload -> dynamic REST

| Field | Value |
|---|---|
| **Type** | api |
| **Phase** | Phase 3 — mock-middleware |
| **Milestone** | N/A |
| **Traces to** | `plan.md` D-07, PRD FR-4/FR-5, US-004 |
| **Demo surface** | `curl http://localhost:5001` |

**What it is**: Uploading a contract's ABI and address registers it with `mock-middleware`, immediately making every method callable via a generated REST route — no gateway code change or redeploy.

**How to try it**:
```
1. docker compose up -d mock-middleware
2. ABI=$(cat ../contracts/artifacts/contracts/Token.sol/Token.json | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d).abi)))")
3. curl -X POST http://localhost:5001/admin/contracts -H "Content-Type: application/json" -d "{\"name\":\"token\",\"address\":\"<token-address-from-deployed-addresses.json>\",\"abi\":$ABI}"
4. curl "http://localhost:5001/contracts/token/name"
5. docker compose restart mock-middleware
6. curl "http://localhost:5001/contracts/token/name"
```

**Verification checklist**:
- [ ] Step 3 returns `200`
- [ ] Step 4 returns `{"output":"Coin"}`
- [ ] Step 6 (after restart) still returns `{"output":"Coin"}` — proves the registry is persisted, not in-memory

**Known limitations at this phase**: `npm run seed` (Phase 5) automates steps 2-3 for the demo's `token`/`identityRegistry` contracts — this manual walkthrough is for understanding/debugging the mechanism.

---

##### DL-3.2 — Idempotent delivery

| Field | Value |
|---|---|
| **Type** | api |
| **Phase** | Phase 3 — mock-middleware |
| **Milestone** | N/A |
| **Traces to** | `plan.md` D-08, PRD FR-6, US-005 |
| **Demo surface** | `curl http://localhost:5001` |

**What it is**: Retrying the same write call with the same `Idempotency-Key` never causes a second on-chain transaction.

**How to try it**:
```
1. curl -X POST http://localhost:5001/contracts/token/mint -H "Content-Type: application/json" -H "Idempotency-Key: demo-key-1" -d '{"params":["<anson-address>",10],"from":"admin"}'
2. curl -X POST http://localhost:5001/contracts/token/mint -H "Content-Type: application/json" -H "Idempotency-Key: demo-key-1" -d '{"params":["<anson-address>",10],"from":"admin"}'
3. curl "http://localhost:5001/contracts/token/balanceOf?params=%5B%22<anson-address>%22%5D"
```

**Verification checklist**:
- [ ] Steps 1 and 2 return the same `id` (transaction hash)
- [ ] The minted amount in step 3 reflects only ONE 10-token mint, not two
- [ ] A request without an `Idempotency-Key` header returns `400`

**Known limitations at this phase**: no UI yet to trigger this from — see DL-5.1/DL-5.2 and `tests/idempotent-retry.spec.ts` for the end-to-end version.

---

##### DL-3.3 — Nonce tracking + `/admin/nonce-status`

| Field | Value |
|---|---|
| **Type** | api |
| **Phase** | Phase 3 — mock-middleware |
| **Milestone** | N/A |
| **Traces to** | `plan.md` D-09, PRD FR-7, US-006 |
| **Demo surface** | `curl http://localhost:5001/admin/nonce-status` |

**What it is**: Per-identity nonce and pending-transaction visibility, plus the estimate-before-reserve nonce design that prevents a reverted `eth_estimateGas` from ever leaving a nonce stuck.

**How to try it**:
```
1. curl "http://localhost:5001/admin/nonce-status"
2. curl -X POST http://localhost:5001/contracts/token/mint -H "Content-Type: application/json" -H "Idempotency-Key: demo-key-2" -d '{"params":["<unregistered-address>",10],"from":"admin"}'
3. curl "http://localhost:5001/admin/nonce-status"
```

**Verification checklist**:
- [ ] Step 1 returns per-identity nonce/pending-queue/last-confirmed-tx for admin/anson/beatrice
- [ ] Step 2 returns `400` (mint to an unverified/unregistered address reverts on `eth_estimateGas`)
- [ ] Step 3's admin nonce is unchanged from step 1 — proves the reverted call did not leave a nonce stuck

**Known limitations at this phase**: the Explorer's pending-tx panel (DL-5.3) is the UI surface for this data — this deliverable is the API underneath it.

---

##### DL-3.4 — WebSocket event subscription

| Field | Value |
|---|---|
| **Type** | api |
| **Phase** | Phase 3 — mock-middleware |
| **Milestone** | N/A |
| **Traces to** | `plan.md` D-10, PRD FR-8, US-007 |
| **Demo surface** | `wscat` or browser DevTools WebSocket console against `ws://localhost:5001` |

**What it is**: A WebSocket endpoint that pushes on-chain events to subscribers, filterable by contract address or by contract template (ABI/type label).

**How to try it**:
```
1. npx wscat -c ws://localhost:5001
2. Send: {"filter":"template","value":"ERC3643Token"}
3. In another terminal, trigger a transfer (DL-2.3 step 5, or the UI once Phase 5 is done)
4. Observe the message pushed into the wscat session
```

**Verification checklist**:
- [ ] A `Transfer` event pushed after step 3 includes `event_name`, `contract_address`, `block_number`, and decoded args
- [ ] Subscribing by `address` (instead of `template`) only receives events from that exact contract
- [ ] Disconnecting and reconnecting does not replay missed events (documented at-most-once behavior)

**Known limitations at this phase**: no dedicated UI consumer yet — the Explorer tab's live feed (DL-5.3) is the first UI to use this.

**Phase exit gate summary** (see `plan.md` §4 Phase 3 for full text):
- [ ] DL-3.1 to DL-3.4 verified
- [ ] Zero private-key leakage in any response body (spot-checked across all `mock-middleware` endpoints)

---

## §5 Phase 4 — backend-api

**Goal**: `backend-api`'s business-orchestration layer reaches chain only through `mock-middleware`, and a read-only Explorer proxy exists.

**Prerequisites**:

```
Checklist:
- [ ] Phase 3 exit gate passed (DL-3.1 to DL-3.4)
- [ ] cd backend-api && npm install
- [ ] mock-middleware running and reachable at http://mock-middleware:5001 (or http://localhost:5001 outside Docker)
```

---

##### DL-4.1 — `MockMiddlewareChainService` + 6 original REST routes

| Field | Value |
|---|---|
| **Type** | infra |
| **Phase** | Phase 4 — backend-api |
| **Milestone** | N/A |
| **Traces to** | `plan.md` D-06/D-13, PRD FR-9/FR-10, US-008 |
| **Demo surface** | `curl http://localhost:4000` |

**What it is**: `backend-api`'s only chain-transport implementation, talking exclusively to `mock-middleware`; 6 REST routes (`register-identity`, `issue-claim`, `mint`, `transfer`, `balance`, `transfers`).

**How to try it**:
```
1. docker compose up -d --build backend-api
2. curl -X POST http://localhost:4000/admin/register-identity -H "Content-Type: application/json" -d '{"who":"anson"}'
3. curl http://localhost:4000/balance/anson
4. curl http://localhost:4000/transfers
```

**Verification checklist**:
- [ ] Step 2 returns `200`
- [ ] Step 3 returns a balance (0 until minted)
- [ ] Step 4 returns an empty array (or prior demo history)
- [ ] `grep -r "PRIVATE_KEY" backend-api/src` finds no key ever assembled into a response body

**Known limitations at this phase**: no frontend yet — all verification here is via `curl`.

---

##### DL-4.2 — Explorer read-only proxy with node allowlist

| Field | Value |
|---|---|
| **Type** | api |
| **Phase** | Phase 4 — backend-api |
| **Milestone** | N/A |
| **Traces to** | `plan.md` D-12, Phase 4 anti-gate, PRD FR-11, US-011 |
| **Demo surface** | `curl http://localhost:4000/explorer` |

**What it is**: A read-only JSON-RPC proxy for raw block/transaction browsing, strictly allowlisting which RPC node name may be queried.

**How to try it**:
```
1. curl "http://localhost:4000/explorer/blocks?node=anson"
2. curl "http://localhost:4000/explorer/blocks?node=beatrice"
3. curl "http://localhost:4000/explorer/blocks?node=http://evil.example"
```

**Verification checklist**:
- [ ] Steps 1 and 2 both return a block list, matching heights (+/-1)
- [ ] Step 3 returns `400`, proving the allowlist rejects an arbitrary value (not a passthrough)

**Known limitations at this phase**: no UI yet — the Explorer tab (DL-5.3) is the browser-facing version of this.

---

##### DL-4.3 — Service-layer unit tests + key-leak spot check

| Field | Value |
|---|---|
| **Type** | test |
| **Phase** | Phase 4 — backend-api |
| **Milestone** | N/A |
| **Traces to** | `plan.md` Phase 4 exit gate |
| **Demo surface** | `npm run test` |

**What it is**: Automated proof that `ComplianceAdminService`/`TransferService` behave correctly against a mocked `MockMiddlewareChainService`.

**How to try it**:
```
1. cd backend-api
2. npm run test -- --testPathPattern=services
3. npm run typecheck
```

**Verification checklist**:
- [ ] All service-layer tests pass
- [ ] `npm run typecheck` exits 0

**Known limitations at this phase**: none.

**Phase exit gate summary** (see `plan.md` §4 Phase 4 for full text):
- [ ] DL-4.1 to DL-4.3 verified
- [ ] Explorer proxy allowlist rejects any non-`anson`/`beatrice` node parameter

---

## §6 Phase 5 — Frontend + Explorer + E2E

**Goal**: A React dashboard exposes Admin/Transfer/Explorer tabs, wired to the full stack, with all 6 Playwright specs green.

**Prerequisites**:

```
Checklist:
- [ ] Phase 4 exit gate passed (DL-4.1 to DL-4.3)
- [ ] npm install (repo root, for Playwright)
- [ ] npx playwright install chromium
- [ ] cp .env.example .env.local and fill in ADMIN/ANSON/BEATRICE keys and addresses:
      node -e "const {ethers}=require('ethers');for (const n of ['ADMIN','ANSON','BEATRICE']){const w=ethers.Wallet.createRandom();console.log(n+'_PRIVATE_KEY='+w.privateKey);console.log(n+'_ADDRESS='+w.address)}"
```

---

##### DL-5.1 — Admin panel incl. ABI-upload form

| Field | Value |
|---|---|
| **Type** | ui |
| **Phase** | Phase 5 — Frontend+Explorer+E2E |
| **Milestone** | N/A |
| **Traces to** | PRD FR-12, US-010 |
| **Demo surface** | browser at `http://localhost:3000` |

**What it is**: The Admin tab — register/claim/mint per identity, plus a form to upload a new contract's ABI.

**How to try it**:
```
1. docker compose up -d --build
2. npm run seed
3. Open http://localhost:3000 in a browser
4. On the Admin tab, click Register, then Issue Claim, then enter an amount and click Mint for Anson
5. Scroll to Upload Contract, paste a name/address/ABI JSON, click Upload
6. npx playwright test tests/onboarding.spec.ts tests/abi-upload.spec.ts
```

**Verification checklist**:
- [ ] Step 4's card shows `verified` and the new balance
- [ ] Step 5 shows a success confirmation
- [ ] `npx playwright test tests/onboarding.spec.ts tests/abi-upload.spec.ts` exits 0

**Known limitations at this phase**: none — this is the final, complete form of the Admin tab.

---

##### DL-5.2 — Transfer tab

| Field | Value |
|---|---|
| **Type** | ui |
| **Phase** | Phase 5 — Frontend+Explorer+E2E |
| **Milestone** | N/A |
| **Traces to** | PRD FR-10, US-009 |
| **Demo surface** | browser at `http://localhost:3000` |

**What it is**: Acting-as switch, balance display, send form, and history table.

**How to try it**:
```
1. On the dashboard, click the Transfer tab
2. Acting as: Anson. Send to: Beatrice. Amount: 10. Click Send
3. Change Send to: Admin (unverified). Amount: 5. Click Send
4. npx playwright test tests/happy-path-transfer.spec.ts tests/compliance-rejection.spec.ts
```

**Verification checklist**:
- [ ] Step 2: balance updates, a new history row appears
- [ ] Step 3: inline error `Token: recipient not verified`, balance/history unchanged
- [ ] `npx playwright test tests/happy-path-transfer.spec.ts tests/compliance-rejection.spec.ts` exits 0

**Known limitations at this phase**: none.

---

##### DL-5.3 — Explorer tab

| Field | Value |
|---|---|
| **Type** | ui |
| **Phase** | Phase 5 — Frontend+Explorer+E2E |
| **Milestone** | N/A |
| **Traces to** | PRD FR-13, US-011 |
| **Demo surface** | browser at `http://localhost:3000` |

**What it is**: Block/transaction browser with a "View as: Anson / Beatrice" switch and a pending-transactions panel.

**How to try it**:
```
1. On the dashboard, click the Explorer tab
2. Confirm View as: Anson is selected, note the latest block number
3. Click a recent block, then a transaction inside it
4. Switch View as to Beatrice, confirm the block list still matches (+/-1)
5. Trigger a transfer from the Transfer tab, then watch the pending panel while it settles
6. npx playwright test tests/explorer-view-as.spec.ts
```

**Verification checklist**:
- [ ] Step 3 shows transaction detail (from/to/value/status)
- [ ] Step 4's block height matches Anson's view within 1 block
- [ ] Step 5's pending panel shows the in-flight transaction, then it disappears once settled
- [ ] `npx playwright test tests/explorer-view-as.spec.ts` exits 0

**Known limitations at this phase**: none.

---

##### DL-5.4 — 6 Playwright specs green, non-flaky across 3 runs

| Field | Value |
|---|---|
| **Type** | test |
| **Phase** | Phase 5 — Frontend+Explorer+E2E |
| **Milestone** | N/A |
| **Traces to** | `plan.md` D-21, Phase 5 exit gate, PRD FR-16 |
| **Demo surface** | `npx playwright test` |

**What it is**: The complete E2E proof that the whole stack — network, contracts, `mock-middleware`, `backend-api`, `frontend` — works together, repeatably, from a genuinely cold start.

**How to try it**:
```
1. docker compose down -v
2. docker compose up -d --build
3. npm run seed
4. npx playwright test
5. Repeat steps 1-4 two more times
```

**Verification checklist**:
- [ ] All 6 specs pass on every one of the 3 runs: `onboarding`, `happy-path-transfer`, `compliance-rejection`, `abi-upload`, `idempotent-retry`, `explorer-view-as`
- [ ] `npx playwright show-report` shows no retries needed (non-flaky)

**Known limitations at this phase**: none — this is the project's completion gate.

**Phase exit gate summary** (see `plan.md` §4 Phase 5 for full text):
- [ ] DL-5.1 to DL-5.4 verified
- [ ] README "Getting Started" followed literally from a clean checkout produces a working demo

---

## §7 How to Run a Full End-to-End Demo

**1. Start the stack**
```bash
git clone <this-repo>
cd Hyperledger-Besu-Docker-Testnet
cp .env.example .env.local   # fill in ADMIN/ANSON/BEATRICE keys, see §6 setup script above
cd contracts && npm install && cd ..
npm install
npx playwright install chromium
docker compose up -d --build
npm run seed
```

**2. Walk through the primary flow**
- Open http://localhost:3000 — start on the Admin tab (DL-5.1): identities are already onboarded by `npm run seed`, but you can re-run Register/Issue Claim/Mint to see the idempotent skip-if-already-true behavior
- Upload a fresh contract ABI via the Upload Contract form (DL-5.1) to see `mock-middleware`'s generic gateway in action
- Switch to the Transfer tab (DL-5.2): send `COIN` from Anson to Beatrice, then try sending to the unverified Admin identity to see the compliance rejection
- Switch to the Explorer tab (DL-5.3): browse the block you just produced, switch "View as" between Anson and Beatrice to see both RPC nodes agree

**3. Show the key outputs**
- Frontend dashboard: http://localhost:3000
- `backend-api` audit log: `curl http://localhost:4000/transfers`
- `mock-middleware` nonce status: `curl http://localhost:5001/admin/nonce-status`
- Both RPC nodes agreeing on block height: `curl -s -X POST http://localhost:8545 ...` vs `:8555` (DL-1.3 commands)
- `npx playwright test` — 6/6 specs green

**4. Tear down**
```bash
docker compose down -v
```
