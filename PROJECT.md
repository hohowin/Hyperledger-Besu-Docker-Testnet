# PROJECT.md — Hyperledger-Besu-Docker-Testnet

> Architecture, conventions, and commands for this repo. Full rationale lives in `docs/`; this file is the quick-reference layer `CLAUDE.md` points to.

## What This Is

A multi-validator, multi-RPC-node Hyperledger Besu network (QBFT, zero-gas) running a permissioned ERC-3643 token (`COIN`), fronted end-to-end by `mock-middleware` — a generic ABI-driven gateway providing exactly-once idempotent delivery, nonce/confirmation tracking, and WebSocket event subscriptions. Forked from the `my-besu-net` reference project's tech stack, skills, and token specification (`_knowledge/my-besu-net/`); topology (4 validators, 2 RPC nodes) and the middleware are new. Not audit-grade, no real PII, localhost-only. Full context: [README.md](README.md), [docs/prd.md](docs/prd.md).

## Current Status

**Planning complete — no application code written yet.** The `/grill-me` interview (2026-09-15) resolved all design decisions (`docs/plan.md` D-01–D-29), and all six planning documents are generated: `README.md`, `docs/prd.md`, `docs/architecture.md`, `docs/plan.md`, `docs/use-cases.md`, `docs/deliverables.md`, `docs/skills-required.md`.

**Phase 1 (Network) — not started.** Next up: `network-config/genesis.json` (4-validator QBFT) and `docker-compose.yml` (`besu-validator-1..4`, `besu-rpc-anson`, `besu-rpc-beatrice`). See `docs/plan.md` §4 Phase 1 / M1.1–M1.3 for the exact steps and gates, `docs/deliverables.md` §2 for the "how to try it" walkthroughs.

**Phases 2–5 (Contracts, `mock-middleware`, `backend-api`, Frontend+Explorer+E2E) — not started.** See `docs/plan.md` §4 for full detail.

Skill audit already run: 10 irrelevant visual-design skills removed, `ethereum`/`express-production` installed, `dlt-security-review` copied from `my-besu-net` — see `docs/skills-required.md`.

## Repo Layout (current)

```
docs/
  prd.md                  # product requirements, user stories, functional requirements
  architecture.md          # service architecture, integration patterns, security model
  plan.md                  # phase plan, locked decisions D-01..D-29, risk register
  use-cases.md             # end-to-end flows, sequence diagrams
  deliverables.md          # phase-by-phase deliverables, "how to try it" guides
  skills-required.md       # skill audit + actions taken
_knowledge/
  my-besu-net/             # reference project — separate repo, do not mix into this one
.claude/skills/            # Claude Code skills (pruned + extended per docs/skills-required.md)
.agents/skills/            # agent-harness mirror of the above
skills-lock.json           # skill provenance (source, hash) for installed skills
CLAUDE.md / PERSONA.md / PROJECT.md   # agent operating instructions
```

**Not yet created** (Phase 1–5 work, see `docs/plan.md`/`docs/deliverables.md`):
```
network-config/            # Phase 1: genesis.json (4-validator QBFT), validator keys
docker-compose.yml          # Phase 1-5: besu-validator-1..4, besu-rpc-anson/beatrice,
                             #            mock-middleware, backend-api, frontend
contracts/                  # Phase 2: Hardhat + TS strict, forked from my-besu-net,
                             #          Token.sol renamed to Coin/COIN
mock-middleware/            # Phase 3: ContractRegistryService, IdempotencyStore,
                             #          NonceTracker, EventSubscriptionService
backend-api/                # Phase 4: MockMiddlewareChainService, ComplianceAdminService,
                             #          TransferService, AuditLogRepository, ExplorerProxy
frontend/                   # Phase 5: React + Vite, Admin/Transfer/Explorer tabs
tests/                      # Phase 5: Playwright specs (6 total)
.env.example                # placeholder template — copy to .env.local (gitignored)
```

## Architecture (summary)

Hybrid: a modular monolith (`backend-api`) plus one deliberately extracted service (`mock-middleware`, isolated because it is the sole holder of every signing key) + a thin SPA frontend (`frontend`) + a blockchain infra tier (4 validators + 2 RPC nodes) — 9 Docker Compose services total. No internal domain-event broker; business orchestration is sync REST, WebSocket is used only for the choreographed, best-effort on-chain event relay. Full detail, diagrams, and per-module rationale: [docs/architecture.md](docs/architecture.md).

| Layer | Owns | Talks to |
|---|---|---|
| T-REX Contract Suite (on-chain) | Identity/claim/balance state, compliance enforcement | `besu-rpc-anson`/`besu-rpc-beatrice` |
| `mock-middleware` | All signing keys, contract registry, idempotency/nonce state, event relay | `besu-rpc-anson`/`besu-rpc-beatrice` (JSON-RPC) |
| `backend-api` (Express monolith) | Business orchestration, audit log, read-only Explorer proxy | `mock-middleware` (REST, sole transport), `besu-rpc-*` (read-only, Explorer only) |
| `frontend` (React SPA) | UI only, no secrets — Admin / Transfer / Explorer tabs | `backend-api` (REST), `mock-middleware` (WebSocket, event feed) |

**Hard boundary:** the contract layer is the real authorization boundary — `backend-api` cannot bypass compliance checks even if it wanted to. Keys live only in `mock-middleware`, never in `backend-api` or the browser (`docs/architecture.md` §10).

## Conventions

- **Language/runtime:** TypeScript strict. No JS. Node 24 (required by `node:sqlite` usage in `backend-api` and `mock-middleware`) — `contracts/` and `frontend/` follow suit for consistency.
- **Contracts:** Solidity + Hardhat, forked unchanged in logic from `my-besu-net`; only `Token.sol`'s `ERC20` name/symbol changed to `"Coin"`/`"COIN"`.
- **Chain client:** ethers.js (inside `mock-middleware` only — `backend-api` never imports it).
- **DB:** SQLite, no ORM, `node:sqlite` (`DatabaseSync`) — both `backend-api` (`transfers` table) and `mock-middleware` (`contracts`, `idempotency_keys` tables).
- **Naming:** avoid hardcoding `anson`/`beatrice`/`COIN` into logic — model as generic `identity`/`asset`/`rpc node` records even though only fixed instances exist in v1 (`docs/plan.md` §2). Never name the commercial BaaS product `mock-middleware` is patterned on, anywhere in code or docs (`docs/plan.md` D-05).
- **Layering:** `backend-api`'s Express routes stay thin adapters — no chain calls, no SQL, no business invariants directly in route handlers; those live in `ComplianceAdminService`/`TransferService`. `mock-middleware` stays a generic ABI gateway — it must never learn what "registering an identity" means.
- **Chain transport:** `mock-middleware` is the *only* path to chain for business logic — no direct-connect fallback (`docs/plan.md` D-06). Explorer reads are the one exception (raw JSON-RPC via `backend-api`'s `ExplorerProxy`, bypassing `mock-middleware` — `docs/plan.md` D-12).
- **Secrets:** `.env.local`, gitignored, never logged or returned in API responses. All signing keys live only in `mock-middleware`.
- **No auth layer in MVP** — accepted risk, mitigated only by localhost/Docker-internal-network binding (`docs/plan.md` D-17, R6). Do not add production auth speculatively; do not deploy this beyond localhost.
- **Git:** solo repo, commit directly to `main`, no CI (`docs/plan.md` D-19).

## Commands

No commands are runnable yet — Phase 1 hasn't started. Once built, the expected commands per phase (see `docs/plan.md` §4 for exact gate commands, `docs/deliverables.md` for full walkthroughs):

**Phase 1 (Network):**
```bash
docker compose up -d besu-validator-1 besu-validator-2 besu-validator-3 besu-validator-4
docker compose up -d besu-rpc-anson besu-rpc-beatrice
docker compose ps
curl -X POST http://localhost:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
curl -X POST http://localhost:8555 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
docker compose down -v
```

**Phase 2 (Contracts, run inside `contracts/`):**
```bash
npm install && npm run compile && npm run test && npm run typecheck
npx hardhat run scripts/deploy.ts --network besu
```

**Phase 3 (`mock-middleware`, run inside `mock-middleware/`):**
```bash
npm install && npm run typecheck && npm run test
docker compose up -d --build mock-middleware
curl -X POST http://localhost:5001/admin/contracts -H "Content-Type: application/json" -d '{"name":"token","address":"...","abi":[...]}'
```

**Phase 4 (`backend-api`, run inside `backend-api/`):**
```bash
npm install && npm run typecheck && npm run test -- --testPathPattern=services
docker compose up -d --build backend-api
curl -X POST http://localhost:4000/admin/register-identity -H "Content-Type: application/json" -d '{"who":"anson"}'
```

**Phase 5 (Frontend + E2E):**
```bash
npm install && npx playwright install chromium
docker compose down -v && docker compose up -d --build && npm run seed
npx playwright test   # 6 specs
```

## Verification Before Calling a Phase Done

Each phase has an explicit exit gate in `docs/plan.md` §4 — check it literally, don't eyeball it:
- Phase 1: 4 validators peered and tolerate 1 dying without halting; both RPC nodes healthy and consistent; `eth_gasPrice = 0x0` on both
- Phase 2: `npx hardhat test` green including compliance-rejection; Admin CLI register→claim→mint→transfer works end to end
- Phase 3: ABI upload → immediately callable, durable across restart; idempotent-delivery unit test proves exactly one tx per key; nonce-reset-on-revert regression test passes; WS subscription by address and by template both proven
- Phase 4: all REST endpoints (original 6 + Explorer proxy) manually verified; Explorer allowlist rejects arbitrary node values; zero key leakage
- Phase 5: 6/6 Playwright specs green across 3 consecutive fresh-stack runs (non-flaky)

## Related Artifacts

- [docs/prd.md](docs/prd.md) — requirements, user stories
- [docs/architecture.md](docs/architecture.md) — full architecture, integration patterns, security model
- [docs/plan.md](docs/plan.md) — phase plan, locked decisions D-01–D-29, risk register
- [docs/use-cases.md](docs/use-cases.md) — sequence diagrams per flow
- [docs/deliverables.md](docs/deliverables.md) — phase-by-phase "how to try it" guides
- [docs/skills-required.md](docs/skills-required.md) — skill audit and actions taken
- [_knowledge/my-besu-net/](_knowledge/my-besu-net/) — reference project (separate repo, tech stack/skills/token spec source)
