# Use Cases — Hyperledger-Besu-Docker-Testnet

> **Owner:** Howin Ho · **Created:** 2026-09-15 · **Status:** Locked (post grill-me)
> Companion docs: [docs/prd.md](prd.md), [docs/architecture.md](architecture.md)

This document is the single reference for end-to-end interaction flows.

---

## Actors

| Actor | Role |
|---|---|
| Admin | Human. Token Agent + Trusted Issuer — registers identities, issues KYC claims, mints `COIN`, uploads contract ABIs |
| Anson | Human. Verified investor, nominal operator of `besu-rpc-anson` |
| Beatrice | Human. Verified investor, nominal operator of `besu-rpc-beatrice` |
| Explorer viewer | Human. Any local user browsing chain state, no distinct identity required |
| Developer | Human. Boots and operates the stack (Phase 1 network verification) |
| `frontend` | React SPA — Admin / Transfer / Explorer tabs |
| `backend-api` | Business orchestration service — `ComplianceAdminService`, `TransferService`, `AuditLogRepository`, `ExplorerProxy` |
| `mock-middleware` | Generic ABI-driven gateway and sole chain transport — `ContractRegistryService`, `IdempotencyStore`, `NonceTracker`, `EventSubscriptionService`; holds all signing keys |
| `besu-rpc-anson` | RPC node nominally owned by Anson |
| `besu-rpc-beatrice` | RPC node nominally owned by Beatrice |
| `besu-validator-1..4` | QBFT validators |
| T-REX Contract Suite | On-chain contracts enforcing ERC-3643 compliance |

---

## UC-01: Network Boots With Genuine Fault Tolerance

**Goal:** The developer confirms the 4-validator network produces blocks and survives one validator dying, proving `f=1` fault tolerance is real, not just a topology label.

**Trigger:** `docker compose up -d` followed by manually stopping one validator container.

```mermaid
sequenceDiagram
  actor Dev as Developer
  participant V1 as besu-validator-1
  participant V2 as besu-validator-2
  participant V3 as besu-validator-3
  participant V4 as besu-validator-4
  participant RA as besu-rpc-anson
  participant RB as besu-rpc-beatrice

  Note over Dev,RB: One-time network bootstrap
  Dev->>V1: docker compose up -d
  Dev->>V2: docker compose up -d
  Dev->>V3: docker compose up -d
  Dev->>V4: docker compose up -d
  V1->>V2: QBFT peer handshake
  V1->>V3: QBFT peer handshake
  V1->>V4: QBFT peer handshake
  V2->>V3: QBFT peer handshake
  V2->>V4: QBFT peer handshake
  V3->>V4: QBFT peer handshake
  Dev->>RA: docker compose up -d
  Dev->>RB: docker compose up -d
  RA->>V1: peer and sync blocks
  RB->>V1: peer and sync blocks

  loop every 5 seconds
    Dev->>RA: eth_blockNumber
    Dev->>RB: eth_blockNumber
    RA-->>Dev: block height N
    RB-->>Dev: block height N, matches RA
  end

  Note over Dev,V4: Fault tolerance proof
  Dev->>V4: docker stop besu-validator-4
  alt f=1 tolerance holds, only 1 validator down
    V1->>V2: QBFT rounds continue
    V1->>V3: QBFT rounds continue
    Dev->>RA: eth_blockNumber
    RA-->>Dev: block height still increasing
  else 2 or more validators down
    Dev->>RA: eth_blockNumber
    RA-->>Dev: block height frozen
    Note over Dev,RA: chain halted, outside the accepted fault budget
  end
  Dev->>V4: docker start besu-validator-4
  V4->>V1: rejoin QBFT set
```

**Notes:**
- References `plan.md` D-04 and M1.2 exit gate; `architecture.md` §1 deployment model
- The "2 or more validators down" branch is the accepted-risk case (`plan.md` R1) — the chain halts by design, not a bug
- Playwright coverage: not applicable — this is an infra-level flow verified via the Phase 1 gate commands in `plan.md`, not a browser flow

---

## UC-02: Admin Onboards an Identity (Register, Claim, Mint)

**Goal:** Admin registers an identity, issues its KYC claim, and mints `COIN` to it, making the identity able to hold and transfer tokens.

**Trigger:** Admin clicks "Register" for an identity on the Admin panel.

```mermaid
sequenceDiagram
  actor Admin
  participant FE as frontend
  participant BE as backend-api ComplianceAdminService
  participant MW as mock-middleware
  participant RA as besu-rpc-anson
  participant TX as T-REX Contract Suite

  Note over Admin,TX: Register
  Admin->>FE: Click Register Anson
  FE->>BE: POST /admin/register-identity who=anson
  BE->>MW: GET /contracts/identityRegistry/isRegistered params
  MW->>RA: eth_call isRegistered
  RA->>TX: read state
  TX-->>RA: false
  RA-->>MW: false
  MW-->>BE: output false
  BE->>MW: POST /contracts/identityRegistry/registerIdentity, Idempotency-Key, from=admin
  MW->>RA: eth_estimateGas and send
  RA->>TX: registerIdentity executes
  MW-->>BE: 202 submitted, id=txHash
  BE->>MW: await settle
  MW-->>BE: receipt success
  BE-->>FE: 200 registered
  FE-->>Admin: status shows registered

  Note over Admin,TX: Issue claim, same idempotent pattern
  Admin->>FE: Click Issue Claim
  FE->>BE: POST /admin/issue-claim who=anson
  BE->>MW: GET isVerified params
  MW-->>BE: false
  BE->>MW: POST issueClaim, Idempotency-Key, from=admin
  MW->>RA: send transaction
  MW-->>BE: 202 submitted
  BE->>MW: await settle
  MW-->>BE: receipt success
  BE-->>FE: 200 verified
  FE-->>Admin: status shows verified

  Note over Admin,TX: Mint, requires verified recipient
  Admin->>FE: Enter amount, click Mint
  FE->>BE: POST /admin/mint who=anson amount=1000
  BE->>MW: POST contracts/token/mint, Idempotency-Key, from=admin
  MW->>RA: send transaction
  alt recipient verified
    RA->>TX: mint succeeds
    MW-->>BE: receipt success
    BE-->>FE: 200 minted
    FE-->>Admin: balance updates
  else recipient not verified
    RA->>TX: mint reverts, recipient not verified
    MW-->>BE: 400 revert reason
    BE-->>FE: 400 mint failed
    FE-->>Admin: inline error shown
  end
```

**Notes:**
- Register/claim skip-if-already-true checks carried from `my-besu-net`'s Phase 4 fix (avoids paying full confirmation latency for a no-op transaction)
- Idempotent per `plan.md` D-08 / `prd.md` FR-6
- References `prd.md` US-008
- Playwright coverage: `tests/onboarding.spec.ts` covers the happy path; the mint-reverts branch is not currently covered — flagged as test backlog

---

## UC-03: Anson Transfers COIN to Beatrice

**Goal:** Anson sends `COIN` to a verified recipient; a transfer to an unverified address fails closed with no state change.

**Trigger:** Anson clicks "Send" on the Transfer tab.

```mermaid
sequenceDiagram
  actor Anson
  participant FE as frontend
  participant BE as backend-api TransferService
  participant MW as mock-middleware
  participant RA as besu-rpc-anson
  participant TX as T-REX Contract Suite
  participant DB as backend-api transfers table

  Anson->>FE: Acting as Anson, send to Beatrice, amount 10
  FE->>BE: POST /transfer from=anson to=beatrice amount=10
  BE->>MW: POST contracts/token/transfer, Idempotency-Key, from=anson
  MW->>RA: eth_estimateGas
  alt both parties verified and compliance passes
    RA->>TX: transfer succeeds
    MW-->>BE: 202 submitted, id=txHash
    BE->>MW: await settle
    MW-->>BE: receipt success
    BE->>DB: insert transfer row
    BE-->>FE: 200 transfer sent
    FE-->>Anson: balance updates, history row appears
  else recipient not verified
    RA->>TX: eth_estimateGas reverts, recipient not verified
    MW-->>BE: 400 revert reason
    BE-->>FE: 400 transfer failed
    FE-->>Anson: inline error, balance and history unchanged
  end
```

**Notes:**
- Mirrors `my-besu-net`'s happy-path and compliance-rejection flows unchanged in business behavior
- References `architecture.md` §3 transfer critical-path diagram, `prd.md` FR-10, US-009
- Playwright coverage: `tests/happy-path-transfer.spec.ts` (happy path), `tests/compliance-rejection.spec.ts` (alt path)

---

## UC-04: Admin Uploads a New Contract ABI

**Goal:** Admin registers a new contract's ABI and address with `mock-middleware`, and it becomes callable via a generated REST surface immediately, with no gateway redeploy.

**Trigger:** Admin submits the "Upload Contract" form.

```mermaid
sequenceDiagram
  actor Admin
  participant FE as frontend
  participant MW as mock-middleware ContractRegistryService
  participant DB as mock-middleware SQLite

  Admin->>FE: Paste name, address, ABI JSON, click Upload
  FE->>FE: validate JSON client side
  alt valid ABI
    FE->>MW: POST /admin/contracts name, address, abi
    MW->>MW: parse as ethers Interface
    MW->>DB: persist registration
    MW-->>FE: 200 registered
    FE-->>Admin: confirmation shown
    Admin->>FE: Try a read call on the new contract
    FE->>MW: GET /contracts/name/method params
    MW->>DB: lookup abi by name
    MW-->>FE: output value
    FE-->>Admin: result displayed
  else malformed ABI JSON
    FE-->>Admin: inline error, no request sent
  end
```

**Notes:**
- References `plan.md` D-07, `prd.md` FR-4/FR-5, US-004/US-010
- Registration persisted in SQLite, survives a `mock-middleware` container restart, unlike `my-besu-net`'s hardcoded two-instance list
- Playwright coverage: `tests/abi-upload.spec.ts` covers the happy path; the malformed-JSON branch is server-side validated but not yet in Playwright — flagged as test backlog

---

## UC-05: Client Retries a Write Call Safely (Exactly-Once Delivery)

**Goal:** A client that times out and retries a write call does not cause a duplicate on-chain transaction.

**Trigger:** The same POST request is sent twice with the same `Idempotency-Key` header (e.g. a client-side timeout triggers a retry).

```mermaid
sequenceDiagram
  actor Client
  participant MW as mock-middleware IdempotencyStore
  participant NT as mock-middleware NonceTracker
  participant DB as mock-middleware SQLite
  participant RA as besu-rpc-anson

  Client->>MW: POST contracts/token/mint, Idempotency-Key=K1
  MW->>DB: lookup K1
  DB-->>MW: not found
  MW->>NT: reserve next nonce for admin
  MW->>RA: eth_estimateGas and send
  RA-->>MW: tx broadcast, hash=H1
  MW->>DB: persist K1 mapped to pending H1
  MW-->>Client: 202 submitted, id=H1

  Note over Client,RA: Client times out before seeing the 202, retries
  Client->>MW: POST contracts/token/mint, Idempotency-Key=K1
  MW->>DB: lookup K1
  DB-->>MW: found, status pending, id=H1
  MW-->>Client: 202 submitted, id=H1
  Note over MW,RA: no second eth_estimateGas or send call happens

  RA-->>MW: tx.wait resolves, status success
  MW->>DB: update K1 to success
  Client->>MW: GET /receipts/H1
  MW-->>Client: status success

  Client->>MW: GET /admin/nonce-status
  MW-->>Client: admin nonce, pending queue 0, last confirmed H1
```

**Notes:**
- References `plan.md` D-08/D-09, `prd.md` FR-6/FR-7, US-005/US-006
- `NonceTracker` carries the reset-on-revert fix from `my-besu-net`'s `ChainService` — a reverted `eth_estimateGas` never leaves a nonce stuck (see `architecture.md` §6)
- Playwright coverage: `tests/idempotent-retry.spec.ts`, asserted via `/admin/nonce-status` or the audit-log row count, not just UI state

---

## UC-06: Client Subscribes to On-Chain Events by Address or Template

**Goal:** A WebSocket client receives `Transfer` events for either one specific contract or every contract matching a template, in near real time.

**Trigger:** Client opens a WebSocket connection to `mock-middleware` and sends a subscribe message.

```mermaid
sequenceDiagram
  actor Client
  participant MW as mock-middleware EventSubscriptionService
  participant RA as besu-rpc-anson
  participant TX as T-REX Contract Suite

  Client->>MW: WS connect
  Client->>MW: subscribe filter=template value=ERC3643Token
  MW->>MW: register subscription

  Note over MW,TX: Elsewhere in the system, a transfer happens
  RA->>TX: transfer executes, Transfer event emitted
  TX-->>RA: event logged on chain
  RA-->>MW: eth_subscribe logs notification
  MW->>MW: match event contract against template subscriptions
  MW-->>Client: WS push, event_name Transfer, contract_address, block_number, decoded_args

  alt client instead subscribes by address
    Client->>MW: subscribe filter=address value=0xTOKEN
    Note over MW,Client: only events from that exact address are pushed
  end

  alt client disconnects
    Client--xMW: connection drops
    MW->>MW: drop subscription silently
    Note over MW,Client: no backlog replay on reconnect, at most once delivery
  end
```

**Notes:**
- References `plan.md` D-10, `prd.md` FR-8, US-007
- Explicitly a best-effort, choreographed relay, not a durable event log — see `architecture.md` §4 and §8
- Playwright coverage: not applicable — WebSocket push is verified by a dedicated integration test per `plan.md` D-21, not forced into E2E

---

## UC-07: User Browses the Explorer

**Goal:** Any local user inspects live blocks and transactions from either RPC node's perspective, including in-flight pending transactions.

**Trigger:** User opens the Explorer tab.

```mermaid
sequenceDiagram
  actor Viewer as Explorer viewer
  participant FE as frontend
  participant BE as backend-api ExplorerProxy
  participant RA as besu-rpc-anson
  participant RB as besu-rpc-beatrice
  participant MW as mock-middleware NonceTracker

  Viewer->>FE: Open Explorer tab, View as Anson
  FE->>BE: GET /explorer/blocks node=anson
  BE->>BE: allowlist check, node in anson or beatrice
  BE->>RA: eth_getBlockByNumber latest
  RA-->>BE: block list
  BE-->>FE: blocks
  FE-->>Viewer: block list rendered

  Viewer->>FE: Click a block, then a transaction
  FE->>BE: GET /explorer/tx/hash
  BE->>RA: eth_getTransactionByHash
  RA-->>BE: transaction detail
  BE-->>FE: transaction detail
  FE-->>Viewer: transaction detail rendered

  loop pending panel refresh
    FE->>BE: GET pending transactions
    BE->>MW: GET /admin/nonce-status
    MW-->>BE: per identity pending queue
    BE-->>FE: pending transactions
    FE-->>Viewer: pending panel updates
  end

  Viewer->>FE: Switch View as to Beatrice
  FE->>BE: GET /explorer/blocks node=beatrice
  BE->>RB: eth_getBlockByNumber latest
  RB-->>BE: block list, matches Anson view within 1 block
  BE-->>FE: blocks
  FE-->>Viewer: block list rendered from Beatrice perspective

  alt requested node not in allowlist
    FE->>BE: GET /explorer/blocks node=anything else
    BE-->>FE: 400 invalid node
    FE-->>Viewer: inline error
  end
```

**Notes:**
- References `plan.md` D-11/D-12/D-14, `prd.md` FR-11/FR-13, US-011
- Explorer bypasses `mock-middleware` entirely for raw block/tx reads — see `architecture.md` §6 `ExplorerProxy` rationale
- The allowlist-rejection branch is the SSRF mitigation from `plan.md` Phase 4 anti-gate — currently proven by a `backend-api` unit test, not yet in Playwright
- Playwright coverage: `tests/explorer-view-as.spec.ts` covers the View-as switch and block/tx rendering; the allowlist-rejection branch is flagged as test backlog
