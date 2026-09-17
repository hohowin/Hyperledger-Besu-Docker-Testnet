# Hyperledger-Besu-Docker-Testnet

A multi-validator, multi-RPC-node Hyperledger Besu network (QBFT, zero-gas) running a permissioned ERC-3643 (T-REX) fungible token, `COIN`, fronted end-to-end by a generic ABI-driven mock middleware — exactly-once idempotent transaction delivery, nonce sequencing, confirmation tracking, and live event subscriptions (see `docs/plan.md` decision log D-01–D-21).

> **Personal learning project.** Anson and Beatrice are fictional demo identities. Private keys live in `mock-middleware`'s local server-side config for demo convenience only — this is not a production key-management model. No real PII is processed; no compliance framework (CASL / PIPEDA / GDPR / PCI) applies.

---

## What It Does

- Stands up a private, permissioned Ethereum network with **4 Besu validators** (QBFT, real `f=1` Byzantine fault tolerance — kill one validator container and the chain keeps producing blocks) and **2 RPC nodes**, one operated on behalf of each investor identity (`besu-rpc-anson`, `besu-rpc-beatrice`).
- Deploys a trimmed ERC-3643 contract suite: transfers only succeed between wallets registered in the Identity Registry with a valid KYC claim from a Trusted Issuer.
- Fronts the chain with **`mock-middleware`** — a generic, ABI-driven REST + WebSocket gateway and the network's *only* chain transport (no direct-connect fallback). It converts any uploaded contract ABI into REST endpoints, guarantees exactly-once delivery via client-supplied `Idempotency-Key`s, tracks nonce sequencing and confirmation status per identity, and pushes on-chain events over WebSocket, filterable by contract address or contract template.
- Lets an **Admin** onboard identities, issue claims, mint `COIN`, and upload new contract ABIs; lets **Anson** and **Beatrice** transfer `COIN` to each other through a dashboard; lets anyone inspect live chain state — blocks, transactions, pending queue — through an **Explorer** tab that can view either RPC node's perspective.

## Who It Serves

| Actor | Role | Interacts via |
|---|---|---|
| **Admin** | Token Agent + Trusted Issuer — registers identities, issues KYC claims, mints `COIN`, uploads contract ABIs | Web dashboard (Admin panel) |
| **Anson** | Verified investor; nominal operator of `besu-rpc-anson` | Web dashboard (Transfer tab, demo-mode identity switch) |
| **Beatrice** | Verified investor; nominal operator of `besu-rpc-beatrice` | Web dashboard (Transfer tab, demo-mode identity switch) |
| **Any local user** | Chain observer | Explorer tab ("View as: Anson / Beatrice") |

There is no real wallet software involved — the dashboard has a "currently acting as" selector instead of a MetaMask connection; `backend-api` orchestrates business rules and `mock-middleware` signs and submits every transaction.

## Key Capabilities

- Permissioned transfer enforcement (ERC-3643 compliance check reverts transfers to/from unverified addresses)
- 4-validator QBFT network with genuine `f=1` fault tolerance (not just a topology label — see `docs/architecture.md`)
- Two independently addressable RPC nodes exposing identical chain state, each nominally "owned" by an investor identity
- `mock-middleware`: ABI upload → auto-generated REST surface, `Idempotency-Key`-based exactly-once delivery, nonce-sequencing + confirmation tracking (`GET /admin/nonce-status`), WebSocket event subscriptions by address or contract template
- Admin onboarding flow: register identity → issue claim → mint
- Zero-gas transfers (no native currency needed)
- Transfer history / audit log (SQLite, in `backend-api`)
- Explorer tab: live blocks + transactions, pending-transaction panel, switchable RPC-node viewpoint
- Playwright E2E coverage: onboarding, happy-path transfer, compliance rejection, ABI upload, idempotent retry, explorer view-as (6 specs)

## Architecture At a Glance

| Service | Container | Exposed Port(s) | Purpose |
|---|---|---|---|
| Besu validators (×4) | `besu-validator-1`…`besu-validator-4` | — (internal only) | Propose/sign QBFT blocks; real `f=1` fault tolerance |
| Besu RPC — Anson | `besu-rpc-anson` | `8545` (HTTP-RPC) | JSON-RPC endpoint nominally owned by Anson |
| Besu RPC — Beatrice | `besu-rpc-beatrice` | `8555` (HTTP-RPC) | JSON-RPC endpoint nominally owned by Beatrice |
| `mock-middleware` | `mock-middleware` | `5001` (REST + WS) | Generic ABI-driven gateway — the network's sole chain transport; holds signing keys |
| Backend API | `backend-api` | `4000` | Node/Express + TS — business orchestration (`ComplianceAdminService`, `TransferService`), audit log; talks to chain only via `mock-middleware` |
| Frontend | `frontend` | `3000` | React dashboard — Admin panel, Transfer tab, Explorer tab |

Token: `Coin` (`COIN`) — trimmed T-REX contract suite: `Token`, `IdentityRegistry`, `IdentityRegistryStorage`, `ClaimTopicsRegistry`, `TrustedIssuersRegistry`, `ModularCompliance`. Per-investor OnchainID proxy contracts are omitted — wallet address is used directly as the identity key.

## Prerequisites

- Docker + Docker Compose
- Node.js 24 (required by `backend-api` and `mock-middleware`'s use of `node:sqlite`)
- npm

## Getting Started

### Step 1 — Clone and configure

```bash
git clone <this-repo>
cd Hyperledger-Besu-Docker-Testnet
cp .env.example .env.local
```

Open `.env.local` and fill in three throwaway private keys / addresses (Admin, Anson, Beatrice) — see `docs/deliverables.md` for the key-generation one-liner. Never reuse a key that holds real funds anywhere else.

### Step 2 — Install dependencies

```bash
cd contracts && npm install && cd ..
npm install                            # root — Playwright E2E suite
npx playwright install chromium
```

`backend-api/`, `mock-middleware/`, and `frontend/` install their dependencies inside their Docker image builds.

### Step 3 — Start the stack

```bash
docker compose up -d --build
```

Builds and starts all 9 containers: 4 validators, 2 RPC nodes, `mock-middleware`, `backend-api`, `frontend`.

```bash
docker compose ps
```

### Step 4 — Deploy contracts and onboard the demo identities

```bash
npm run seed
```

Deploys the trimmed T-REX suite, uploads its ABI to `mock-middleware`, registers + verifies Anson and Beatrice, and mints Anson a starting `COIN` balance. No persistent Besu volume — every `docker compose down` resets the chain to genesis, so `npm run seed` always redeploys fresh rather than trusting a stale `deployed-addresses.json`.

### Step 5 — Open the dashboard

Go to **http://localhost:3000**.

### Tearing down

```bash
docker compose down -v
```

## Running the Demo, Step by Step

Quick checklist version of the flow above — pick whichever applies.

### First time

You've never run this repo before: no `.env.local`, no `node_modules`, no Docker images built yet.

1. ```bash
   cp .env.example .env.local
   ```
   Fill in three throwaway private keys / addresses (Admin, Anson, Beatrice) — see `docs/deliverables.md` for the key-generation one-liner.
2. ```bash
   cd contracts && npm install && cd ..
   npm install
   npx playwright install chromium
   ```
3. ```bash
   docker compose up -d --build
   ```
   `--build` is required this time — the images don't exist yet.
4. ```bash
   docker compose ps
   ```
   Wait until `besu-rpc-anson`, `besu-rpc-beatrice`, `mock-middleware`, and `backend-api` all show `(healthy)` — usually 30–40s.
5. ```bash
   npm run seed
   ```
6. Open **http://localhost:3000**.

### Not first time

`.env.local` exists, dependencies are installed, and the Docker images were already built at least once (they persist locally across `docker compose down -v` — that command only removes containers/volumes/networks, never images).

1. ```bash
   docker compose up -d
   ```
   No `--build` needed unless you changed `mock-middleware/`, `backend-api/`, or `frontend/` source since the last build.
2. ```bash
   docker compose ps
   ```
   Same health check as above.
3. ```bash
   npm run seed
   ```
   **Always required, every time** — D-15 means there's no persistent Besu volume, so `docker compose down -v` resets the chain to genesis. Contracts, `mock-middleware`'s registry, and identity onboarding all need to be redone from scratch.
4. Open **http://localhost:3000**.

## Accessing the Application

| What | URL |
|---|---|
| Frontend dashboard (Admin / Transfer / Explorer) | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| `mock-middleware` REST + WS | http://localhost:5001 |
| Besu JSON-RPC — Anson | http://localhost:8545 |
| Besu JSON-RPC — Beatrice | http://localhost:8555 |

Quick API test:

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

curl -X POST http://localhost:8555 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
# Both RPC nodes should report the same (or near-same) block number.
```

## Key Documents

| Document | Purpose |
|---|---|
| [docs/user-manual.md](docs/user-manual.md) | What every tab/button/field on the dashboard does |
| [docs/playbook.md](docs/playbook.md) | Step-by-step scenario walkthroughs — what to click and what it proves |
| [docs/seeding.md](docs/seeding.md) | What `npm run seed` does, step by step, plus troubleshooting |
| [docs/FAQ.md](docs/FAQ.md) | "Why does this work like that?" — specific questions answered in depth |
| [docs/Besu-config.md](docs/Besu-config.md) | Complete Besu CLI/genesis configuration reference — where each setting lives, what's expected, production hardening notes |
| [docs/prd.md](docs/prd.md) | Product requirements |
| [docs/architecture.md](docs/architecture.md) | Service architecture, integration patterns, security model |
| [docs/mock-middleware-technical.md](docs/mock-middleware-technical.md) | mock-middleware internals — module-by-module logic, idempotency/nonce sequence diagrams, event relay, schema |
| [docs/plan.md](docs/plan.md) | Phase plan, locked decisions, risk register |
| [docs/use-cases.md](docs/use-cases.md) | End-to-end flows with sequence diagrams |
| [docs/deliverables.md](docs/deliverables.md) | Phase-by-phase deliverables and "how to try it" guides |
| [docs/skills-required.md](docs/skills-required.md) | Skill-vs-tech-stack audit |

## Development Notes

- Solo repo — commits go directly to `main`, no CI workflow.
- Run `npm run typecheck` and `npm run test` locally (inside each of `contracts/`, `mock-middleware/`, `backend-api/`, `frontend/`) before considering a phase done.
- `mock-middleware` is the **only** chain transport in this project — there is no direct-connect fallback or toggle to bypass it.
- End-to-end tests: `npx playwright test` from the repo root (needs the full stack already running).

## Compliance Notes

This project simulates the shape of a regulated digital asset (ERC-3643 permissioned transfers) and a BaaS-style middleware pattern for learning purposes only. It is **not** audit-grade compliance tooling, implements no production authentication (any local caller can act as Admin), and must not be pointed at real user data or deployed beyond localhost.

## License

[MIT](LICENSE)
