# PRD: Hyperledger-Besu-Docker-Testnet

> Source: `/grill-me` interview (2026-09-15). Full decision log: `docs/plan.md` §3 (D-01–D-22).

## 1. Introduction/Overview

A personal learning project: a **multi-validator, multi-RPC-node** Hyperledger Besu network fronted by a **generic ABI-driven mock middleware** (`mock-middleware`) — the network's sole chain transport, modeled on the pattern of commercial Blockchain-as-a-Service gateways (never named directly in this codebase per D-05).

It solves three learning goals at once: (1) proving a real multi-validator QBFT network with genuine Byzantine fault tolerance, (2) proving a generic ABI-to-REST gateway pattern with production-grade delivery guarantees (exactly-once, nonce sequencing, confirmation tracking) rather than a minimal in-memory mimic, and (3) proving a live chain-observability surface (block explorer) on top of a multi-node network.

**Domain vocabulary:**
- `identity` — a registered wallet record (Anson, Beatrice, Admin are seeded instances)
- `asset` — a token contract type; `COIN` is the deployed instance
- `mock-middleware` — the generic ABI-driven gateway; never referred to by the commercial product name it's patterned on
- `receipt` — the async settlement record for a submitted transaction, keyed by transaction hash
- `idempotency key` — a client-supplied key (`Idempotency-Key` header) that deduplicates a write call
- `contract template` — the ABI/contract-type label (e.g. `ERC3643Token`, `IdentityRegistry`) used as an event-subscription filter, distinct from filtering by a specific deployed `address`

## 2. Goals

- Stand up a 4-validator QBFT Besu network with genuine `f=1` Byzantine fault tolerance (kill one validator, chain keeps producing blocks)
- Expose two independently addressable RPC nodes (`besu-rpc-anson`, `besu-rpc-beatrice`) with identical chain state
- Deploy the trimmed T-REX suite, token named `COIN`
- Build `mock-middleware` as the sole chain transport, providing: ABI-upload-driven REST generation, exactly-once idempotent delivery, nonce sequencing + confirmation tracking, and WebSocket event subscriptions filterable by address or contract template
- Preserve `backend-api`'s business-orchestration role (compliance rules, audit log) unchanged in responsibility, only its chain transport changes
- Ship an Explorer tab that lets a user browse live blocks/transactions from either RPC node's perspective
- Prove all of the above with an expanded Playwright E2E suite (6 specs)

## 3. Business Model

N/A — personal local learning PoC, no monetization, no users beyond the developer (D-17).

## 4. User Stories

### US-001: 4-validator QBFT network with real fault tolerance
**Description:** As a developer, I want a 4-validator QBFT genesis so the network has genuine `f=1` Byzantine fault tolerance, not just a topology label.

**Acceptance Criteria:**
- [ ] `network-config/genesis.json` contains a `qbft` config block listing all 4 validator addresses in `extraData`
- [ ] `docker compose up -d` starts all 4 `besu-validator-*` containers healthy, no restart loop
- [ ] Killing any single validator container leaves `eth_blockNumber` (queried via either RPC node) still increasing within 30s
- [ ] `eth_gasPrice` returns `0x0` on both RPC nodes

### US-002: Two independently addressable RPC nodes
**Description:** As a developer, I want two RPC nodes so Anson's and Beatrice's traffic can be demoed as going through distinct, identically-behaving endpoints.

**Acceptance Criteria:**
- [ ] `besu-rpc-anson` (`:8545`/`:8546`) and `besu-rpc-beatrice` (`:8555`/`:8556`) both peer with all 4 validators
- [ ] `eth_blockNumber` on both endpoints reports the same value (±1 block) when queried 5s apart
- [ ] Typecheck/compose config passes

### US-003: `COIN` token deployed via the T-REX compliance suite
**Description:** As an Admin, I want the trimmed T-REX suite deployed with the token named `COIN` so the on-chain compliance guarantee holds end to end.

**Acceptance Criteria:**
- [ ] `Token.sol` constructor reads `ERC20("Coin", "COIN")`
- [ ] `npx hardhat test` green, including the compliance-rejection revert test
- [ ] Deploy script produces `deployed-addresses.json` with 6 non-zero contract addresses against the Phase 1 network

### US-004: Admin uploads a contract ABI, gets an auto-generated REST surface
**Description:** As an Admin, I want to upload a contract's ABI and address so `mock-middleware` immediately exposes it as REST endpoints, without redeploying the gateway.

**Acceptance Criteria:**
- [ ] `POST /admin/contracts { name, address, abi }` persists the registration in SQLite
- [ ] Immediately after, `GET /contracts/:name/:method` (view/pure) and `POST /contracts/:name/:method` (state-changing) work for any method in the uploaded ABI
- [ ] Registrations survive a `mock-middleware` container restart (registry is durable, unlike the reference project's hardcoded instance list)
- [ ] `npm run seed` uploads the deployed `Token` and `IdentityRegistry` ABIs automatically — no manual upload needed for the out-of-box demo

### US-005: Exactly-once idempotent transaction delivery
**Description:** As a caller of `mock-middleware`, I want to retry a write call safely (e.g. after a timeout) without risking a duplicate on-chain transaction.

**Acceptance Criteria:**
- [ ] `POST /contracts/:name/:method` requires an `Idempotency-Key` header for state-changing calls
- [ ] First request with a given key submits the transaction and persists `key → receipt id` in SQLite
- [ ] A second request with the same key returns the original receipt (same `id`, same status) without submitting a second transaction, whether the first is still pending or already settled
- [ ] Missing `Idempotency-Key` header returns `400`

### US-006: Nonce sequencing and confirmation tracking, observable
**Description:** As an Admin, I want to see each identity's nonce state and pending transactions so I can verify the exactly-once guarantee is actually working, not just trust it.

**Acceptance Criteria:**
- [ ] `GET /admin/nonce-status` returns, per identity (admin/anson/beatrice): current on-chain nonce, pending-queue length, last confirmed transaction hash
- [ ] A failed `eth_estimateGas` (revert before broadcast) does not leave a reserved nonce stuck
- [ ] Explorer tab's pending-transactions panel reflects the same in-flight transactions as `/admin/nonce-status`

### US-007: WebSocket event subscription by address or contract template
**Description:** As a client of `mock-middleware`, I want to subscribe to on-chain events either for one specific deployed contract or for every contract of a given type, and receive them in real time.

**Acceptance Criteria:**
- [ ] WebSocket endpoint accepts a subscribe message: `{ "filter": "address", "value": "0x..." }` or `{ "filter": "template", "value": "ERC3643Token" }`
- [ ] A `Transfer` event emitted on-chain by a subscribed contract is pushed to the connected client within the gateway's polling interval
- [ ] Subscribing by template delivers events from every currently-registered contract instance matching that template, including ones registered after the subscription started
- [ ] Verified via unit/integration test (not required in Playwright E2E — WebSocket push isn't reliably assertable there)

### US-008: `backend-api` orchestrates identity onboarding via `mock-middleware` only
**Description:** As an Admin, I want to register/claim/mint through the dashboard, with the request going only through `mock-middleware` (no direct chain connection from `backend-api`).

**Acceptance Criteria:**
- [ ] `backend-api`'s `ChainServiceLike` implementation (`MockMiddlewareChainService`) is the only implementation — no direct-ethers implementation exists
- [ ] `ComplianceAdminService`/`TransferService` behavior (registration, claim issuance, minting, transfer, compliance rejection) is correct end to end
- [ ] Every write from `backend-api` includes a generated `Idempotency-Key`

### US-009: Transfer flow works reliably for the end user
**Description:** As Anson or Beatrice, I want to transfer `COIN` predictably, unaffected by the middleware/topology underneath.

**Acceptance Criteria:**
- [ ] Transfer tab: acting-as switch, balance display, send form, and history table all behave correctly
- [ ] A transfer to an unverified address still fails closed with `Token: recipient not verified`, surfaced as a clean UI error

### US-010: Admin panel supports ABI upload
**Description:** As an Admin, I want a UI to upload a new contract's ABI to `mock-middleware`, not just via curl.

**Acceptance Criteria:**
- [ ] Admin panel has an "Upload Contract" form (name, address, ABI JSON paste/file)
- [ ] Successful upload shows a confirmation and the contract becomes callable immediately
- [ ] Invalid ABI JSON shows an inline error, no partial registration

### US-011: Explorer tab — live blocks and transactions
**Description:** As any local user, I want to browse blocks and transactions on either RPC node to see the chain's actual state, not just trust the dashboard's summary.

**Acceptance Criteria:**
- [ ] Explorer tab lists recent blocks (number, timestamp, tx count, proposer) and lets me drill into a block's transactions
- [ ] A "View as: Anson / Beatrice" switch changes which RPC node (`besu-rpc-anson` vs `besu-rpc-beatrice`) the data is read from
- [ ] Pending-transactions panel shows in-flight (submitted-but-unconfirmed) transactions, sourced from `mock-middleware`'s nonce-status
- [ ] Data is read via a `backend-api` read-only proxy (`GET /explorer/...`) calling Besu JSON-RPC directly — not through `mock-middleware`'s contract gateway (see `docs/architecture.md` §2)

### US-012: Full Playwright E2E coverage
**Description:** As a developer, I want automated proof that every capability actually works end to end.

**Acceptance Criteria:**
- [ ] `onboarding.spec.ts`, `happy-path-transfer.spec.ts`, `compliance-rejection.spec.ts` green
- [ ] `abi-upload.spec.ts`: admin uploads a fresh ABI via the UI, then successfully calls it through the generated REST surface
- [ ] `idempotent-retry.spec.ts`: same `Idempotency-Key` submitted twice via the UI/API results in exactly one on-chain transaction (asserted via `/admin/nonce-status` or the audit log)
- [ ] `explorer-view-as.spec.ts`: switching "View as" changes the displayed RPC source; block/tx data renders correctly for both
- [ ] All 6 specs pass across 3 consecutive runs against a genuinely fresh `docker compose down -v && up -d --build && npm run seed` (non-flaky)

## 5. Functional Requirements

**MVP (must ship for the v1 wedge):**
- FR-1: 4-validator QBFT genesis, all validator addresses in `extraData`
- FR-2: Two RPC nodes (`besu-rpc-anson`, `besu-rpc-beatrice`), statically peered to all 4 validators
- FR-3: `COIN` token deployed via the trimmed T-REX contract suite
- FR-4: `mock-middleware` exposes `POST /admin/contracts` for ABI+address registration, persisted in SQLite
- FR-5: `mock-middleware` dynamically serves `GET/POST /contracts/:name/:method` for any registered contract, unknown-name/method returns `404`
- FR-6: `mock-middleware` requires `Idempotency-Key` on state-changing `POST` calls; duplicate keys return the original receipt, never resubmit
- FR-7: `mock-middleware` exposes `GET /admin/nonce-status` (per-identity nonce, pending queue, last confirmed tx)
- FR-8: `mock-middleware` exposes a WebSocket endpoint for event subscription, filterable by `address` or `template`
- FR-9: `backend-api` reaches the chain only through `mock-middleware` — no direct ethers.js/JSON-RPC path for contract calls
- FR-10: `backend-api` exposes 6 REST routes (register/claim/mint/transfer/balance/transfers)
- FR-11: `backend-api` exposes a read-only Explorer proxy (`GET /explorer/blocks`, `/explorer/blocks/:number`, `/explorer/tx/:hash`) hitting Besu JSON-RPC directly, parameterized by which RPC node ("anson"/"beatrice")
- FR-12: Frontend has three tabs: Admin (register/claim/mint/upload ABI), Transfer, Explorer
- FR-13: Explorer tab has a "View as: Anson / Beatrice" toggle and a pending-transactions panel
- FR-14: No persistent Besu volume — `docker compose down` (with or without `-v`) resets chain state to genesis; `npm run seed` always redeploys and re-registers fresh
- FR-15: Zero-gas network (`minGasPrice = 0`)
- FR-16: 6 Playwright E2E specs (US-012), all green non-flaky across 3 fresh-stack runs

**Post-MVP (important but not blocking launch):**
- FR-17: Webhook delivery as an alternative to WebSocket for event subscriptions
- FR-18: Optional persistent Besu volume mode for longer-running demo sessions
- FR-19: Additional compliance modules (country restriction, max-holder-count) — deferred

**Future (explicitly deferred):**
- FR-20: Real MetaMask wallet integration
- FR-21: Production authentication/authorization layer
- FR-22: Per-node key custody / independent node-operator access control (rejected model, D-03)
- FR-23: Production-grade key management (HSM/KMS)
- FR-24: Multiple asset/token types beyond `COIN`

## 6. Non-Goals (Out of Scope)

- Real MetaMask wallet connection
- Per-investor OnchainID proxy contracts / full T-REX fidelity
- Production-grade key management
- Real KYC/AML integration
- Public or mainnet deployment
- CI/CD pipeline
- Production authentication — any local caller can act as Admin (accepted risk, localhost-only)
- Per-RPC-node key custody or independent access control lists (D-03 — node "ownership" is topology/labelling only)
- Alternate chain transport / toggle back to direct ethers.js (D-06 — `mock-middleware` is the only transport)
- Persistent chain data across `docker compose down`
- Any transaction type beyond single-step transfer — no cancel, change, refund, or escrow
- Multiple asset/token types — `COIN` only
- Mobile app, business model, geographic launch staging, SMS/email notifications

## 7. Design Considerations

- Admin panel, Transfer tab, and Explorer tab live in one React SPA (`frontend`) — one dashboard rather than a separate deployable app per tab (D-08)
- Explorer tab reuses the dashboard's existing identity-switch UI pattern for its "View as" control, for visual consistency
- ABI upload form should validate JSON client-side before submit to avoid a round trip for a malformed paste

## 8. Technical Considerations

- `mock-middleware`, `backend-api`, and `contracts` are all TypeScript strict, Node 24 (driven by `node:sqlite` usage)
- `mock-middleware`'s SQLite schema needs three tables: `contracts` (registry), `idempotency_keys` (key → receipt id/status), and `nonces` (per-identity counters)
- `NonceTracker` in `mock-middleware` must estimate gas before reserving a nonce, so a reverted `eth_estimateGas` never leaves a nonce stuck
- WebSocket event delivery is implemented via Besu's `eth_subscribe`/`logs` WS API on the RPC node side, fanned out to `mock-middleware`'s own subscriber connections — not a direct client-to-Besu WS proxy (keeps the filter-by-template logic server-side, where the ABI registry lives)
- Docker network: a `172.28.0.0/16` bridge accommodating 9 services

**Non-Functional Requirements:**

| NFR | MVP target | How the architecture supports it | Tradeoff / phase gate |
|---|---|---|---|
| Availability (consensus) | Chain keeps producing blocks with 1 of 4 validators down | QBFT `n=4, f=1` genesis (FR-1) | Only 1 validator can be down at a time; 2 down halts the chain — acceptable for PoC scope, documented in risk register |
| Consistency (RPC nodes) | Both RPC nodes report the same block height within ±1 block, 5s apart | Both statically peered to all 4 validators (FR-2) | No consistency guarantee under network partition — out of scope for local Docker demo |
| Reliability (delivery) | Zero duplicate on-chain transactions under client retry | Idempotency-Key + SQLite dedup store (FR-6) | Idempotency store itself isn't replicated — a `mock-middleware` container loss between key-write and receipt-resolve is a known gap, accepted for PoC |
| Observability | Nonce/pending state inspectable without reading logs | `GET /admin/nonce-status` (FR-7), Explorer pending panel (FR-13) | No metrics/tracing beyond this — no OpenTelemetry in scope |
| Security | No credential leaks in any API response | Keys held only in `mock-middleware`; `backend-api` and `frontend` never see them | No authN/authZ at all — accepted only because localhost-bound (see Risks) |
| Latency | Write call round-trip (submit-to-settled, polled) ~3-5s | Async submit + receipt/WS-confirmation pattern (FR-6, FR-8) | Slightly higher than direct-ethers transport; explicit, demonstrable tradeoff of the middleware pattern |

**Privacy & Data:** N/A — no real personal data collected (Anson/Beatrice are fictional demo identities).

## 9. Success Metrics

- E2E proof: 0/6 → 6/6 Playwright specs green across 3 consecutive fresh-stack runs, by Phase 5 exit
- Validator fault tolerance proof: unverified → killing 1 of 4 validator containers leaves `eth_blockNumber` still increasing within 30s, by Phase 1 exit
- RPC-node consistency proof: unverified → both RPC nodes report matching block height (±1) 5s apart, by Phase 1 exit
- Idempotent-delivery proof: unverified → duplicate `Idempotency-Key` POST produces exactly 1 on-chain transaction, verified by Phase 3 exit
- ABI-upload proof: unverified → an ABI uploaded at runtime is callable via generated REST within the same session, by Phase 3 exit

## 10. Open Questions

| # | Question | Owner | Deadline | Status |
|---|----------|-------|----------|--------|
| 1 | Which domain skills (`ethereum`, `express-production`, `dlt-security-review`) get installed into this repo, and are any additional skills needed for the WebSocket/event-subscription work? | Howin | Before Phase 3 starts | Open — resolved by `/skills-required` audit |

## 11. Risks

Cross-referenced against the project risk register in `docs/plan.md` §7 (generated alongside this PRD).

| Risk ID | Description | Mitigated by |
|---|---|---|
| R1 | No authentication — any local caller can act as Admin or trigger transfers, and the attack surface is now larger (2 RPC nodes + `mock-middleware` REST/WS + `backend-api`) | Accepted only because bound to localhost/internal Docker network; explicitly disclaimed in README (FR-9–FR-13 all localhost-only) |
| R2 | `mock-middleware`'s idempotency store or nonce state is lost if its container crashes mid-flight | SQLite persistence (FR-6, FR-7) narrows the window versus an in-memory-only receipt store, but doesn't eliminate it — accepted for PoC scope |
| R3 | 4-validator QBFT still halts entirely if 2+ validators are down simultaneously | Accepted for PoC scope (FR-1); documented explicitly so it isn't mistaken for full HA |
| R4 | WebSocket event fan-out logic (subscribe by template) is new, unproven code | US-007 acceptance criteria require dedicated integration tests, not just E2E coverage |

## 12. Phase Deliverables

#### Phase 1 — Network

| # | Deliverable | Notes |
|---|---|---|
| PD-1.1 | `network-config/genesis.json` with 4-validator QBFT config | |
| PD-1.2 | `docker-compose.yml` with `besu-validator-1..4`, `besu-rpc-anson`, `besu-rpc-beatrice` | All peered; zero-gas confirmed |

#### Phase 2 — Contracts

| # | Deliverable | Notes |
|---|---|---|
| PD-2.1 | `contracts/` with `Token.sol` named `Coin`/`COIN` | |
| PD-2.2 | `npx hardhat test` green including compliance-rejection test | |
| PD-2.3 | `deployed-addresses.json` against the Phase 1 4-validator/2-RPC network | |

#### Phase 3 — `mock-middleware`

| # | Deliverable | Notes |
|---|---|---|
| PD-3.1 | `ContractRegistryService` + `POST /admin/contracts` + dynamic `/contracts/:name/:method` | SQLite-backed |
| PD-3.2 | `IdempotencyStore` + `Idempotency-Key` enforcement | SQLite-backed |
| PD-3.3 | `NonceTracker` + `GET /admin/nonce-status` | Estimate-before-reserve design prevents the reset-on-revert nonce leak |
| PD-3.4 | `EventSubscriptionService` WebSocket endpoint, filter by address/template | |

#### Phase 4 — `backend-api`

| # | Deliverable | Notes |
|---|---|---|
| PD-4.1 | `MockMiddlewareChainService` implementing `ChainServiceLike` | Sole chain-transport implementation, no direct-ethers path |
| PD-4.2 | `ComplianceAdminService`/`TransferService`/`AuditLogRepository` | |
| PD-4.3 | Explorer read-only proxy routes (`GET /explorer/...`) | Direct to Besu RPC, bypasses `mock-middleware` |

#### Phase 5 — Frontend + Explorer + E2E

| # | Deliverable | Notes |
|---|---|---|
| PD-5.1 | Admin panel with ABI-upload form | |
| PD-5.2 | Transfer tab | |
| PD-5.3 | Explorer tab with View-as switch + pending-tx panel | |
| PD-5.4 | 6/6 Playwright specs green across 3 fresh-stack runs | onboarding, happy-path-transfer, compliance-rejection, abi-upload, idempotent-retry, explorer-view-as |
