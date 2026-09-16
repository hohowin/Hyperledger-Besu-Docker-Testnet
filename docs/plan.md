# Plan — Hyperledger-Besu-Docker-Testnet

> **Owner:** Howin Ho · **Created:** 2026-09-15 · **Status:** Locked (post grill-me)
> *"Four validators, two owners, one gateway — a real multi-node permissioned chain proven end to end through a generic ABI middleware."*

---

## §1 Vision

**Long-term vision:** A personal reference implementation showing how a real multi-validator, multi-RPC-node permissioned Besu network can be fronted end to end by a generic, BaaS-style ABI gateway — with production-shaped guarantees (exactly-once delivery, nonce sequencing, live event subscriptions) instead of a toy mimic — building directly on the `my-besu-net` reference project's proven ERC-3643 compliance model.

**Expansion axes:**
- **Width** — more compliance modules, more than one asset type, webhook delivery alongside WebSocket, additional node operators beyond Anson/Beatrice
- **Depth** — real wallet integration (MetaMask), full per-investor OnchainID, production key management (HSM/KMS), persistent chain-state mode, promoting the WS event relay to a durable outbox+broker

**v1 wedge:** A 4-validator QBFT Besu network (genuine `f=1` fault tolerance) with 2 RPC nodes (`besu-rpc-anson`, `besu-rpc-beatrice`), running a trimmed ERC-3643 token (`COIN`, forked unchanged from `my-besu-net`'s `DAT`), fronted exclusively by `mock-middleware` — a generic ABI-driven gateway providing ABI-upload-to-REST, exactly-once idempotent delivery, nonce/confirmation tracking, and WebSocket event subscriptions — with `backend-api` retained as the business-orchestration layer and a Explorer tab added to the dashboard for live chain browsing. Nothing beyond this is in scope for v1.

---

## §2 Core Architecture Principles

| Hard-coded specific naming (avoid) | Generic abstraction (use) |
|---|---|
| `anson`, `beatrice` as literal identifiers baked into logic | `identity` — a generic registered-wallet record; Anson and Beatrice are just two seeded rows |
| `COIN` token contract treated as the only possible asset | `asset` (token contract type) — `COIN` is the first deployed instance, not a hardcoded assumption |
| Single/fixed validator set assumed everywhere | `validator set` — config-driven list in `genesis.json`, currently length 4 |
| The commercial BaaS product this middleware is patterned on, named anywhere in code/docs | `mock-middleware` — a generic gateway pattern name; the real product is never named (D-05) |
| Two RPC endpoints hardcoded as "Anson's" / "Beatrice's" with special-cased behavior | `rpc node` — a generic node record; `anson`/`beatrice` are just two labelled instances with identical behavior (D-03) |
| Hardcoded contract-instance list (`identityRegistry`, `token`) inside the gateway | `contract registry` — dynamically registered `{name, address, abi}` rows; `template` = the ABI/contract-type label used for event filtering (D-07, D-10) |
| Admin as a single privileged wallet with no role model | `TrustedIssuer` / `TokenAgent` roles — both currently held by one wallet, modeled as distinct roles in the contracts (inherited from `my-besu-net`) |

---

## §3 Locked Decisions

| # | Decision | Lock |
|---|----------|------|
| D-01 | Asset model = **ERC-3643 (T-REX)** trimmed suite, forked unchanged in logic from `my-besu-net`; token renamed `Coin`/`COIN` | Locked |
| D-02 | Single **Admin wallet** plays both Token Agent and Trusted Issuer roles (inherited) | Locked |
| D-03 | Node "ownership" (Anson/Beatrice each "own" an RPC node) = **topology/naming only** — no per-node key custody, no per-node ACL; behavior is identical across both RPC nodes | Locked |
| D-04 | Validator count = **4** (not the 3 originally requested) — required for genuine QBFT `n=3f+1`, `f=1` Byzantine fault tolerance; a 3-validator set would have `f=0`, identical fault tolerance to a single validator | Locked |
| D-05 | The mock middleware is named **`mock-middleware`** throughout code and docs; the commercial BaaS product it's patterned on is never named anywhere in this repository | Locked |
| D-06 | `mock-middleware` = **default and only** chain transport — no direct-connect fallback/toggle (unlike `my-besu-net`'s optional `CHAIN_TRANSPORT`) | Locked |
| D-07 | ABI upload = Admin REST endpoint (`POST /admin/contracts`) + SQLite-persisted registry; `/contracts/:name/:method` dynamically dispatches against it | Locked |
| D-08 | Idempotent delivery = client-supplied **`Idempotency-Key`** header, SQLite-persisted dedup store; duplicate keys return the original receipt, never resubmit | Locked |
| D-09 | Nonce/confirmation observability = `GET /admin/nonce-status` (per-identity nonce, pending queue, last confirmed tx) + Explorer pending-tx panel | Locked |
| D-10 | Event subscription = **WebSocket push**; filterable by specific contract `address` or by **contract template** (ABI/contract-type label, e.g. `ERC3643Token`) | Locked |
| D-11 | Explorer = a tab inside the existing `frontend` (not a separate service); data source is switchable **"View as: Anson / Beatrice"** | Locked |
| D-12 | Explorer read path = `backend-api` read-only JSON-RPC proxy directly to `besu-rpc-*`, bypassing `mock-middleware`'s contract gateway entirely (raw block/tx browsing isn't a contract call) | Locked |
| D-13 | `backend-api` retained as the business-orchestration layer (`ComplianceAdminService`, `TransferService`, `AuditLogRepository`); it reaches chain only through `mock-middleware`, never directly | Locked |
| D-14 | `mock-middleware` RPC routing: connects to **both** RPC nodes — transaction submission defaults via `besu-rpc-anson`; event subscription listens on both | Locked |
| D-15 | **No persistent Besu volume** — every `docker compose down` resets the chain to genesis (inherited from `my-besu-net` D-15/D-16); `npm run seed` always redeploys fresh | Locked |
| D-16 | **5-phase build plan**, horizontal layering: ① Network ② Contracts ③ `mock-middleware` ④ `backend-api` ⑤ Frontend+Explorer+E2E, each with a hard exit gate | Locked |
| D-17 | **No production auth** anywhere in the system — the "acting as" dropdown is the entire access model, explicitly disclaimed; attack surface is larger than `my-besu-net`'s (2 RPC nodes + `mock-middleware` REST/WS + `backend-api` Explorer proxy) | Locked |
| D-18 | Business model / compliance = **N/A** — personal local learning PoC, no real PII, no CASL/PIPEDA/GDPR/PCI applicability | Locked |
| D-19 | Solo repo — commits go directly to `main`; no CI workflow; local `typecheck`/`test` only (inherited) | Locked |
| D-20 | `mock-middleware`'s persisted store (contract registry, idempotency keys, nonce state) = **SQLite / `node:sqlite`**, matching `backend-api`'s existing tech choice — no Postgres container added | Locked |
| D-21 | Playwright E2E = **6 specs total**: 3 ported unchanged (`onboarding`, `happy-path-transfer`, `compliance-rejection`) + 3 new (`abi-upload`, `idempotent-retry`, `explorer-view-as`); WebSocket event push is verified by unit/integration test, not forced into E2E | Locked |
| D-22 | Project name = repo's existing name `Hyperledger-Besu-Docker-Testnet`; English only, no localization, no domain registered | Locked |
| D-23 | Consensus = **QBFT**, zero-gas network (`minGasPrice = 0`) (inherited) | Locked |
| D-24 | Transaction lifecycle scope = **single-step compliant transfer only** — no cancel, change, refund, or escrow (inherited from `my-besu-net` D-20) | Locked |
| D-25 | Confirm channel = N/A — no SMS/email; all feedback is synchronous in-UI or via the WebSocket event feed (inherited) | Locked |
| D-26 | Launch/distribution/acquisition/geography/data-residency/retention/privacy-officer = **N/A** — solo local PoC, all data stays on the developer's machine, no rollout of any kind (inherited from `my-besu-net` D-21/D-22) | Locked |
| D-27 | Architecture style = **Hybrid**: modular monolith (`backend-api`) + one extracted service (`mock-middleware`, isolated for key-custody/security-boundary reasons) + SPA frontend + blockchain infra tier (see `architecture.md` §1) | Locked |
| D-28 | Integration patterns = sync REST for all business orchestration (`frontend`↔`backend-api`↔`mock-middleware`), no internal domain-event broker; WebSocket push used only for the choreographed, best-effort on-chain event relay (see `architecture.md` §3–§4) | Locked |
| D-29 | Skills: reference `my-besu-net`'s relevant domain skills (`ethereum`, `express-production`, `dlt-security-review`) in addition to the ones this repo already has (`playwright-e2e`, `pr-review`, `design-doc-mermaid`, `q`, `skills-required`, `full-output-enforcement`); final gap check via `/skills-required` | Open — pending `/skills-required` run |

---

## §4 Phase Plan

### Phase 1 — Network

**Goal:** A working 4-validator QBFT Besu network with genuine `f=1` fault tolerance and 2 RPC nodes, zero-gas, reachable via JSON-RPC.

**Scope:**
- `genesis.json` with a 4-validator QBFT config and `minGasPrice = 0`
- `docker-compose.yml` defining `besu-validator-1..4` and `besu-rpc-anson`/`besu-rpc-beatrice`, all statically peered
- Out of scope: contracts, `mock-middleware`, `backend-api`, `frontend`

#### M1.1 — Genesis & QBFT Config for 4 Validators (Day 1)

**Services in scope:** validator key + genesis file generation (no containers running yet)
**Out:** `besu-rpc-*`, `mock-middleware`, `backend-api`, `frontend`
**Surface for demo:** inspecting the generated `genesis.json` and 4 key files on disk
**Vertical slice proven:** a valid 4-validator QBFT genesis exists that all validators can boot from

**Steps:**

1. Generate 4 validator key pairs and a QBFT genesis using Besu's `operator generate-blockchain-config` CLI subcommand.
   > **Gate ✓** — `network-config/genesis.json` exists with a `qbft` config block listing all 4 validator addresses in `extraData`; 4 key files exist under `network-config/validator-keys/`

2. Write the `besu-validator-1..4` service definitions in `docker-compose.yml`, each mounting its own generated key.
   > **Gate ✓** — `docker compose config` exits 0

**Exit gate:**
- [ ] `genesis.json` contains a `qbft` config block with all 4 validator addresses
- [ ] `docker compose config` validates without error

#### M1.2 — Validator Peering & Fault Tolerance Proof (Day 1–2)

**Services in scope:** `besu-validator-1..4`
**Out:** `besu-rpc-*`, contracts, `mock-middleware`, `backend-api`, `frontend`
**Surface for demo:** `docker compose logs besu-validator-1` showing peer count ≥ 3
**Vertical slice proven:** the 4-validator set actually produces blocks and survives one validator dying

**Steps:**

1. Statically peer all 4 validators (`static-nodes.json` or `--bootnodes`).
   > **Gate ✓** — `docker compose up -d besu-validator-1 besu-validator-2 besu-validator-3 besu-validator-4` starts all 4 healthy, no restart loop; logs show peer count ≥ 3 on each

2. Prove genuine `f=1` fault tolerance.
   > **Gate ✓** — `docker stop besu-validator-4`; block height (queried once validators expose RPC, or via `debug_` on a validator) continues increasing within 30s; `docker start besu-validator-4` rejoins cleanly

**Exit gate:**
- [ ] All 4 validators peered and producing blocks
- [ ] Killing any single validator does not halt block production

**Anti-gate:** if killing 1 of 4 validators halts block production, D-04's core premise (`f=1` fault tolerance) is broken — stop and re-verify the genesis validator set/`extraData` before proceeding to M1.3.

#### M1.3 — RPC Nodes & Two-Node Consistency (Day 2)

**Services in scope:** `besu-rpc-anson`, `besu-rpc-beatrice`
**Out:** contracts, `mock-middleware`, `backend-api`, `frontend`
**Surface for demo:** `curl` against both `:8545` and `:8555`
**Vertical slice proven:** two independently addressable RPC endpoints expose identical, externally-queryable chain state

**Steps:**

1. Add `besu-rpc-anson` and `besu-rpc-beatrice` as non-validating full nodes, each statically peered to all 4 validators.
   > **Gate ✓** — `docker compose up -d` starts both, `docker compose ps` shows both `running`, no restart loop

2. Confirm two-node consistency and zero-gas.
   > **Gate ✓** — `eth_blockNumber` on `:8545` and `:8555` report the same value (±1) when queried 5s apart; `eth_gasPrice` returns `0x0` on both

**Exit gate (= Phase 1 exit gate):**
- [ ] All 4 validators healthy, peered, and tolerate 1 validator dying without halting
- [ ] Both RPC nodes healthy, peered, and report matching block height
- [ ] `eth_gasPrice` returns `0x0` on both RPC nodes

**Anti-gate:** if either RPC node cannot peer or diverges in block height from the other after fixing networking, do not proceed to Phase 2 — every later phase depends on a live, consistent chain.

**Rationale for this slicing:** horizontal-layer decomposition (network → contracts → middleware → backend → frontend), same rationale as `my-besu-net`: each layer is a hard, one-directional dependency for the next, there's no external stakeholder needing a weekly vertical demo, and a solo developer benefits more from finishing and gate-checking one layer completely before touching the next.

---

### Phase 2 — Contracts

**Goal:** The trimmed T-REX suite, forked unchanged in logic from `my-besu-net`, is deployed on the Phase 1 network with the token renamed to `COIN`.

**Scope:** Solidity contracts (forked), Hardhat deploy script, Admin CLI scripts, Hardhat tests
**Out of scope:** `mock-middleware`, `backend-api`, `frontend`

**Steps:**

1. Fork the 6 trimmed T-REX contracts from `my-besu-net`; rename `Token`'s ERC20 constructor to `ERC20("Coin", "COIN")`.
   > **Gate ✓** — `npx hardhat compile` exits 0; `git diff` against the `my-besu-net` fork shows no changes outside the name/symbol string

2. Write the Hardhat deploy script against the Phase 1 4-validator/2-RPC network (`--network besu`).
   > **Gate ✓** — deploy script produces `deployed-addresses.json` with 6 non-zero contract addresses

3. Port Admin CLI scripts (`registerIdentity.ts`, `issueClaim.ts`, `mintToken.ts`, `transfer.ts`).
   > **Gate ✓** — register→claim→mint sequence run via CLI against the live network leaves the target address `verified` with a non-zero `COIN` balance

4. Port Hardhat tests, including the compliance-rejection anti-gate.
   > **Gate ✓** — `npx hardhat test` green, including a test asserting `transfer()` reverts for an unverified recipient

**Exit gate:**
- [ ] `npx hardhat test` green, including the compliance-rejection test
- [ ] Admin CLI register→claim→mint→transfer runs end to end against the live Phase 1 network
- [ ] `deployed-addresses.json` available for Phase 3 to consume

**Anti-gate:** do not proceed to Phase 3 if the compliance-rejection test does not actually revert — D-01's core guarantee wouldn't be real.

---

### Phase 3 — `mock-middleware`

**Goal:** A generic ABI-driven gateway is the network's sole chain transport, providing ABI-upload-to-REST, exactly-once idempotent delivery, nonce/confirmation tracking, and WebSocket event subscription.

**Scope:** `mock-middleware` container, SQLite schema, service-layer tests
**Out of scope:** `backend-api`, `frontend`

**Steps:**

1. Implement `ContractRegistryService` + `POST /admin/contracts` + dynamic `/contracts/:name/:method`.
   > **Gate ✓** — uploading the Phase 2 `Token` ABI via `curl POST /admin/contracts`, then immediately `curl GET /contracts/token/balanceOf?params=...` succeeds; registration survives a `docker compose restart mock-middleware`

2. Implement `IdempotencyStore` + `Idempotency-Key` enforcement.
   > **Gate ✓** — unit test: same key POSTed twice results in exactly one entry in the underlying tx log / one call to the signer; missing header returns `400`

3. Implement `NonceTracker` + `GET /admin/nonce-status`, carrying the `my-besu-net` reset-on-revert fix.
   > **Gate ✓** — unit test reproducing `my-besu-net`'s original bug (reverted `eth_estimateGas` leaves a reserved nonce) passes against the new implementation; `/admin/nonce-status` returns correct per-identity state

4. Implement `EventSubscriptionService` WebSocket endpoint, filter by `address` and by `template`.
   > **Gate ✓** — integration test: subscribing by `template` receives a `Transfer` event from a contract registered *after* the subscription started; subscribing by `address` does not receive events from other registered contracts

5. Add `mock-middleware` to `docker-compose.yml`.
   > **Gate ✓** — `docker compose up -d mock-middleware` starts healthy and reaches both `besu-rpc-anson`/`besu-rpc-beatrice` over the internal Docker network

**Exit gate:**
- [ ] ABI upload → immediately callable via generated REST, durable across restart
- [ ] Idempotent delivery proven by unit test (duplicate key → 1 transaction)
- [ ] Nonce-reset-on-revert regression test passes
- [ ] WebSocket subscription by both `address` and `template` proven by integration test
- [ ] Zero private-key leakage in any response body (spot-checked)

**Anti-gate:** do not proceed to Phase 4 if the idempotency test can produce two on-chain transactions for one key under any interleaving — this breaks the project's core new guarantee outright.

---

### Phase 4 — `backend-api`

**Goal:** `backend-api`'s business-orchestration layer is ported to reach chain only through `mock-middleware`, plus a new read-only Explorer proxy.

**Scope:** `backend-api` container, `MockMiddlewareChainService`, Explorer proxy routes
**Out of scope:** `frontend`

**Steps:**

1. Implement `MockMiddlewareChainService` (implements `ChainServiceLike`), generating an `Idempotency-Key` per write.
   > **Gate ✓** — unit test confirms each of Admin/Anson/Beatrice resolves to its expected identity through `mock-middleware`, mocked at the HTTP boundary

2. Port `ComplianceAdminService`/`TransferService`/`AuditLogRepository` unchanged in behavior.
   > **Gate ✓** — service-layer test suite green (mocked `MockMiddlewareChainService`), covering the same cases as `my-besu-net`'s Phase 3 suite

3. Implement the Explorer read-only proxy (`GET /explorer/blocks`, `/explorer/blocks/:number`, `/explorer/tx/:hash`), strictly allowlisting the node-name parameter to `anson`/`beatrice`.
   > **Gate ✓** — `curl localhost:4000/explorer/blocks?node=anson` returns recent blocks; `curl localhost:4000/explorer/blocks?node=http://evil` returns `400`, proving the allowlist (not a passthrough)

4. Add `backend-api` to `docker-compose.yml`.
   > **Gate ✓** — `docker compose up -d backend-api` starts healthy and reaches `mock-middleware` and both RPC nodes over the internal Docker network

**Exit gate:**
- [ ] All original 6 REST routes (register/claim/mint/transfer/balance/transfers) manually verified via `curl` against the full Phase 1–4 stack
- [ ] Explorer proxy allowlist rejects any non-`anson`/`beatrice` node parameter
- [ ] Service-layer unit tests green
- [ ] Spot-check confirms no private key ever appears in any `backend-api` response

**Anti-gate:** do not proceed to Phase 5 if the Explorer proxy accepts an arbitrary URL/host for the `node` parameter — that's an open SSRF, not an accepted risk.

---

### Phase 5 — Frontend + Explorer + E2E

**Goal:** React dashboard with Admin/Transfer/Explorer tabs, wired to the full stack, with all 6 Playwright specs green.

**Scope:** `frontend` container, `AdminPanel` (+ ABI upload), `TransferDashboard`, `ExplorerTab`, Playwright specs
**Out of scope:** anything listed in §10 Out of Scope

**Steps:**

1. Port `AdminPanel`/`TransferDashboard`, add the ABI-upload form.
   > **Gate ✓** — `npx playwright test tests/onboarding.spec.ts tests/happy-path-transfer.spec.ts tests/compliance-rejection.spec.ts` passes

2. Build the ABI-upload flow end to end (UI → `backend-api` → `mock-middleware`).
   > **Gate ✓** — `npx playwright test tests/abi-upload.spec.ts` passes

3. Build the idempotent-retry proof surface (UI action or debug panel that re-sends the same `Idempotency-Key`).
   > **Gate ✓** — `npx playwright test tests/idempotent-retry.spec.ts` passes

4. Build `ExplorerTab` (block/tx list, pending panel, View-as switch).
   > **Gate ✓** — `npx playwright test tests/explorer-view-as.spec.ts` passes

5. Add `frontend` to `docker-compose.yml`; validate a fresh full-stack run.
   > **Gate ✓** — from `docker compose down -v && docker compose up -d --build`, then `npm run seed`, all 6 Playwright specs pass against the freshly started 9-container stack

**Exit gate:**
- [ ] `npx playwright test` — 6/6 specs pass (onboarding, happy-path-transfer, compliance-rejection, abi-upload, idempotent-retry, explorer-view-as)
- [ ] All 6 pass across 3 consecutive runs against a genuinely fresh stack (non-flaky)
- [ ] README "Getting Started" followed literally from a clean checkout produces a working demo

**Anti-gate:** do not consider the project done if any Playwright spec is flaky — fix the root cause before closing Phase 5.

---

## §5 Architecture Snapshot

**Topology:** 9-container Docker Compose stack — 4 QBFT validators + 2 RPC nodes → T-REX `COIN` contracts → `mock-middleware` (sole transport, holds all keys) → `backend-api` (orchestration monolith) → `frontend` (SPA, 3 tabs). Full detail: `architecture.md`.

| Phase gate | Architecture change |
|---|---|
| Phase 1 → 2 | Deployed contract addresses (against the 4V/2RPC network) become the coupling artifact Phase 3 depends on |
| Phase 2 → 3 | `mock-middleware` introduces the system's only signing-key custody point and its first persistent SQLite store |
| Phase 3 → 4 | `backend-api` loses its own chain-transport implementation entirely — `mock-middleware` becomes a hard dependency, not an option |
| Phase 4 → 5 | `frontend` becomes the only browser-facing surface (still localhost-only); Explorer's read path is added as a second, independent data source (raw RPC) alongside the business-data path (SQLite audit log) |

---

## §6 KPI Summary

**North Star:** A real, verifiable Anson ↔ Beatrice `COIN` transfer completes end to end through `mock-middleware`, with exactly-once delivery actually proven (not just asserted) and both RPC nodes agreeing on the resulting chain state.

| Phase | Gating metric | Target |
|---|---|---|
| Phase 1 | Fault tolerance + consistency | Block production survives 1-of-4 validators dying; both RPC nodes report matching block height within 30s of `docker compose up` |
| Phase 2 | Compliance enforcement | Compliance-rejection Hardhat test passes 100% of runs |
| Phase 3 | Delivery correctness | Idempotent-delivery test passes 100% (duplicate key → exactly 1 tx); ABI upload → callable within the same session |
| Phase 4 | API correctness | 6/6 original endpoints + Explorer proxy manually verified; 0 key leaks; 0 SSRF via node-name allowlist bypass |
| Phase 5 | E2E proof | 6/6 Playwright specs green across 3 consecutive local runs (non-flaky) |

**Anti-metric kill switch:**
- If killing 1 of 4 validators halts block production (Phase 1), stop and re-verify the QBFT genesis/validator-set wiring before continuing — D-04's premise would be false.
- If the compliance-rejection test (Phase 2) cannot be made to revert correctly after roughly a day of debugging, stop and re-verify the trimmed T-REX wiring before continuing.
- If the idempotent-delivery test (Phase 3) cannot be made to guarantee exactly-once after a day of debugging, stop and reconsider the dedup design before building `backend-api`/`frontend` on top of it.

---

## §7 Risk Register

| # | Risk | L | I | Phase | Mitigation |
|---|------|---|---|-------|------------|
| R1 | Even with 4 validators (`f=1`), 2+ simultaneous validator failures halt the chain entirely | Med | High | 1–5 | Accepted for PoC scope (D-04); documented explicitly in README/architecture so it isn't mistaken for full HA |
| R2 | `mock-middleware`'s SQLite idempotency/nonce state lost if its container crashes mid-flight | Low | Med | 3–5 | SQLite persistence narrows the window versus `my-besu-net`'s fully in-memory receipt store, but doesn't eliminate it — accepted for PoC scope (see `architecture.md` §10 R2) |
| R3 | Trimmed T-REX (no per-investor OnchainID) is not audit-grade compliance tooling | Low | Low | 2 | Accepted by design (D-01, inherited); disclaimed in README |
| R4 | Demo private keys leak via unhandled error stack traces or logs | Low | Med | 3 | Sanitized error handling in `mock-middleware` (carried from `my-besu-net`'s `ChainService`); `.env.local` gitignored |
| R5 | SQLite audit-log write fails after a confirmed on-chain transfer, creating a gap between chain state and local log | Low | Low | 4 | Chain remains source of truth for balances; gap can be backfilled manually |
| R6 | No authentication on any API — any local caller can act as Admin or trigger transfers; attack surface larger than `my-besu-net`'s (2 RPC nodes + `mock-middleware` REST/WS + Explorer proxy) | Med (if exposed) | High (if exposed) | 3–5 | Accepted only because bound to localhost/internal Docker network (D-17); must add real auth before any non-local deployment |
| R7 | Solo-developer bandwidth across a materially larger topology (9 containers vs. `my-besu-net`'s 4) | Med | Med | all | Strict 5-phase sequencing with hard exit gates (D-16) prevents context-thrashing across layers |
| R8 | Besu / Hardhat / ethers.js version incompatibilities | Med | Med | 1–2 | Pin exact versions in `package.json` and Docker image tags at Phase 1 start |
| R9 | Arbitrary contract call via uploaded ABI — any local caller can register and invoke any method on any address, unlike `my-besu-net`'s hardcoded two-instance gateway | Med | Med | 3–5 | Accepted MVP risk, localhost-only (see `architecture.md` §10); no authZ exists to scope which callers may register contracts |
| R10 | WebSocket event relay (subscribe by address/template) is new, unproven code with no reference implementation in `my-besu-net` | Low | Med | 3 | Dedicated integration tests required in Phase 3 exit gate, not just E2E coverage (PRD R4) |
| R11 | Explorer proxy becomes an SSRF vector if the RPC-node parameter isn't strictly allowlisted | Low | High (if exploited) | 4 | Phase 4 exit gate explicitly requires proving the allowlist rejects arbitrary values, not just documenting the intent |
| R12 | Supply-side vendor adoption | — | — | — | N/A — no vendors or marketplace exist in this project (D-18) |
| R13 | CASL violation (unsolicited messaging) | — | — | — | N/A — no marketing or messaging sent (D-25) |
| R14 | Distribution host policy change | — | — | — | N/A — not distributed via any platform (D-26) |
| R15 | Unit economics (CAC > LTV) | — | — | — | N/A — no business model (D-18) |
| R16 | Bilingual UI delay | — | — | — | N/A — English-only demo, no localization requirement (D-22) |
| R17 | Third-party cost spikes (SMS/email/infra) | — | — | — | N/A — no third-party services used (D-18, D-25) |

---

## §8 Compliance Notes

- **CASL:** Not applicable — no marketing or transactional messaging is sent by this system; there is no consent/opt-in flow to log.
- **PIPEDA / provincial privacy (Canada):** Not applicable — no real personal information is collected, stored, or processed. Anson and Beatrice are fictional demo identities; nothing in the system constitutes personal information under PIPEDA. No data residency requirement exists because all data stays on the developer's own machine, and no designated privacy officer is required.
- **GDPR / HIPAA / PCI / other regulations:** Not applicable — no EU data subjects, no health data, no payment card data are processed anywhere in this system.
- This positioning (D-18) is explicit and intentional and must be re-evaluated from scratch — via a new `/grill-me` pass — before any of these patterns are reused with real user data.

---

## §9 Open Questions

| # | Question | Owner | Deadline | Status |
|---|----------|-------|----------|--------|
| 1 | Which of `my-besu-net`'s domain skills (`ethereum`, `express-production`, `dlt-security-review`) should be installed into this repo, and are any additional skills needed for the WebSocket/event-subscription work in Phase 3? | Howin | Before Phase 3 starts | Open — resolved by the `/skills-required` run at the end of this grill-me flow |

---

## §10 Out of Scope (MVP)

- Real MetaMask wallet connection
- Per-investor OnchainID proxy contracts / full T-REX fidelity
- Production-grade key management (HSM, KMS, hardware wallet)
- Real KYC/AML integration — claims are Admin-self-issued for demo purposes only
- Public or mainnet deployment
- CI/CD pipeline
- Per-RPC-node key custody or independent node-operator access control (D-03 — node "ownership" is topology/labelling only)
- Alternate chain transport / toggle back to direct ethers.js (D-06 — `mock-middleware` is the only transport)
- Webhook delivery for event subscriptions (Post-MVP, PRD FR-17)
- Persistent chain volume across `docker compose down` (Post-MVP, PRD FR-18)
- Any transaction type beyond single-step transfer — no cancel, change, refund, or escrow (D-24)
- Multiple asset/token types — `COIN` only
- Mobile app
- Marketplace, vendor, or multi-tenant concepts of any kind
- Business model, pricing, or paywall of any kind (D-18)
- Any geographic launch staging or acquisition strategy (D-26)
- SMS/email/any external notification channel (D-25)
- Production authentication/authorization (D-17 — accepted MVP risk, R6)

---

## §11 Related Artifacts

- [docs/prd.md](prd.md) — product requirements, user stories, functional requirements
- [docs/architecture.md](architecture.md) — service architecture, integration patterns, security model
- [docs/use-cases.md](use-cases.md) — end-to-end flows with sequence diagrams
- [docs/deliverables.md](deliverables.md) — phase-by-phase deliverables and "how to try it" guides
