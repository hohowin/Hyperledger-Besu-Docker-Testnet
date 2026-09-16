---
name: architecture
description: Generate docs/architecture.md — the single source of truth for service architecture, integration patterns, tech stack, and security model. Invoke after /grill-me or when the user asks to generate or update the architecture document.
---

# Architecture Doc Generator

Generate `docs/architecture.md` — the single source of truth for service architecture, integration patterns, tech stack, and security model.

---

## Step 0: Load Context

1. If a grill-me interview summary exists in this conversation, use it as the primary input.
2. Read `PROJECT.md` and `docs/plan.md` (if they exist) for locked decisions and service topology.
3. Read any existing `docs/architecture.md` — update in place rather than overwriting decisions already locked.
4. Use service names, entity names, and event names exactly as established in existing docs. Never invent synonyms.

---

## Step 1: Choose Architecture Style

Before writing any section, determine the appropriate architecture style from the grill-me summary and existing docs. Do not default to microservices — choose based on the evidence.

| Signal | Favours |
|---|---|
| Solo or very small team (1–3 engineers) | Monolith or modular monolith |
| Tight delivery timeline, first product, greenfield | Monolith or modular monolith |
| Domains with very different scaling profiles or deployment cadences | Microservices or modular monolith |
| Strong compliance isolation requirement (e.g. audit service must be tamper-proof) | Extract only those services; keep the rest as a monolith |
| Team already running containers, has ops capacity | Microservices viable |
| Multiple frontend clients + an agentic API surface | Modular monolith with a dedicated API gateway service is often sufficient |

**Valid styles:**
- **Monolith** — single deployable unit, single DB. Simple to operate, easiest to evolve early. Extract modules as load and team grow.
- **Modular monolith** — single deployable unit internally structured into bounded modules with enforced ownership. Each module owns its DB schema; no cross-module DB access at the application layer. Deploy as one container; split into services when a module's scaling or compliance profile diverges.
- **Microservices** — independently deployable services, each owning its data. Justified when modules have materially different scaling, deployment cadence, compliance isolation, or team ownership requirements.
- **Hybrid** — a monolith or modular monolith with one or two extracted services where isolation is genuinely required (e.g. an auth service, a notification gateway, an audit service).

State the chosen style explicitly at the top of §1 and give a one-sentence rationale. If the style is undecided, recommend the simplest option that meets the stated NFRs and compliance requirements — do not recommend microservices by default.

---

## Step 2: Generate `docs/architecture.md`

Produce all sections below. Adapt each section's content to the chosen architecture style — guidance is provided per section. If information is not yet available, write `> TBD — requires grill-me input: [what is needed]` and continue. Do not skip sections.

---

### §1 Overview

- **Architecture style**: state the chosen style (monolith / modular monolith / microservices / hybrid) and a one-sentence rationale.
- **Deployment model**: how many deployable units, on what infrastructure (e.g. single container on VPS, multi-container Docker Compose, managed orchestrator).
- **Data tier**: list every data store with its role and ownership model (e.g. single shared DB, per-module schemas in one Postgres, per-service Postgres instances).
- **External services**: list every third-party dependency with its role.
- **Locked stack decisions**: reference plan.md D-codes where they exist. Do not duplicate decision rationale here — that belongs in §9.

---

### §2 Modules / Components / Services and Capability Mapping

> **Adapt to style**: use "module" for monolith/modular monolith, "service" for microservices, "component" if neither fits. The key question is the same regardless of style: what are the bounded areas of responsibility, and who owns what data?

A table with columns: `# | Name | Capabilities owned | Data owned | Depth`

- **Name**: the module, component, or service name.
- **Capabilities**: named interfaces or domain classes this unit exposes (e.g. `IntentOrchestrator`, `VendorService`, `NotificationGateway`).
- **Data owned**: tables or schemas owned exclusively by this unit. No other unit may write to another's data at the application layer (enforced by module boundaries in a monolith, by DB roles in microservices).
- **Depth**: `deep` (non-trivial domain logic, warrants heavy test investment) or `shallow` (thin adapter/gateway, stateless).

After the table, add an **MVP simplification block** — a nested table of components deferred to a later phase and what ships instead:

| Component | MVP (ship this) | Phase N upgrade |
|---|---|---|
| e.g. search module | vendor module owns search via tsvector + GIN | Extract dedicated search service + pgvector when volume justifies it |

State the net effect: what units are active in MVP.

Then include a **topology Mermaid diagram** (`graph TD`) adapted to the chosen style:
- For **monolith / modular monolith**: show modules as boxes within a single deployable boundary, external actors, and data stores
- For **microservices / hybrid**: show `subgraph` blocks for Public Zone, Internal Zone, Data Tier; all sync (solid) and async (dashed) connections with labels
- Always include: external actors, data stores, and third-party services

---

### §3 Integration Patterns Per Interaction

> **Adapt to style**: in a monolith, most internal interactions are direct function calls — only document patterns for interactions that cross a meaningful boundary (external API call, async job, webhook, outbound notification). In microservices, document every inter-service call.

Define the pattern names relevant to this design. Use only the ones that apply:

| Pattern | When to use |
|---|---|
| `Direct call` | In-process function call within a monolith module |
| `Sync REST` | HTTP request/response between deployable units or to/from external clients |
| `Sync MCP` | Model Context Protocol call from an AI host |
| `Async job / queue` | Background work that does not need an immediate response |
| `Async event` | Published to a broker; at-least-once; consumed by one or more subscribers |
| `Fire-and-forget` | Producer does not wait for consumer ack beyond broker durability |
| `Outbox` | Domain row and event row written in the same DB transaction before relay to broker |
| `Webhook (inbound)` | Third-party system posts to the platform; must ack fast |

A table with columns: `Interaction | From → To | Pattern | Why this pattern`

Cover every interaction that crosses a module/service boundary or touches an external system.

After the table, add two sub-sections:

**Failure handling on critical paths** — for each path where failure has a user-visible or compliance impact:

| Path | Failure mode | Behaviour |
|---|---|---|
| e.g. API → booking module | booking module throws | return 503 + Retry-After; never silently drop |

**Integration critical path diagram** — Mermaid `graph LR` showing the primary transaction confirm flow (or equivalent). Include all participants (modules, services, broker, external systems) and label all arrows with message or pattern name. Omit for trivial flows.

---

### §4 Event Catalog

> **Skip this section if the design has no async event broker** (e.g. a simple monolith with no background jobs and no Redis Streams / Kafka). Replace with: `> Not applicable — no event broker in this design.`
>
> For designs with a broker (even Redis Streams used as a simple queue), or with background jobs / webhooks that produce typed events, complete this section.

List all domain events grouped by producing module or service. Format: `EventName.v1`

For each group:
- Producer
- List of event names
- Which consumers subscribe in MVP

All events must carry: `event_id`, `event_type`, `occurred_at`, `producer`, `correlation_id`, `payload`. State how schema versioning works (e.g. event_type suffix `v1`, `v2`).

---

### §5 Event Sourcing and CQRS — Scope and Rationale

State explicitly for this design:
- What uses event sourcing (if anything), why, and what is deferred
- What uses CQRS (read/write separation), why, and what is deferred
- Why the decisions are correct for the current phase (not over/under-engineered)

Include a **state machine diagram** (Mermaid `stateDiagram-v2`) for the primary entity lifecycle (all valid transitions, terminal states, and inline notes for race rules and escalation).

Include a one-sentence decision rule: **"A flow is orchestrated when… A flow is choreographed when…"**

---

### §6 Per-Module / Component / Service Rationale

For each module, component, or service, three bullets:
- The forces that drove this boundary (why is this a distinct unit at all?)
- The main alternative considered (e.g. fold into another module, split further, use a different pattern)
- Why the alternative was rejected — be specific; name what was rejected and give a concrete reason

> For a monolith: focus on why each module is a separate bounded context rather than why it is a separate deployable. A boundary inside a monolith is still a meaningful design decision.
>
> For microservices: explain why this boundary justifies the operational cost of an independent deployable. "It has different domain concerns" is not sufficient — state the scaling, compliance, deployment cadence, or team ownership reason.

---

### §7 Integration Pattern Decisions and Rationale

Label each pattern decision A, B, C… matching the interactions in §3.

For each:
- **Pattern**: name
- **Forces**: what drove this choice
- **Alternative considered**: the specific alternative
- **Why rejected**: concrete reason (not "it would be too complex")

---

### §8 Orchestration vs Choreography Deep Dive

**Decision rule** — one paragraph: when to orchestrate, when to choreograph, and how to decide when both could fit.

**What we orchestrate** — for each orchestrated flow:
- Owner service (the single writer)
- Step-by-step sequence (numbered, concrete)
- Why orchestration is mandatory here (what invariants it enforces)
- Failure handling responsibility

**What we choreograph** — for each choreographed flow:
- The event chain (service → event → consumer → event → consumer…)
- Why choreography fits (no natural owner, loosely coupled, no hard invariants)
- Failure handling (independent retry per step, no compensating saga needed)

**Hybrid boundary** — one paragraph explaining how the orchestrator acts as an event source externally while remaining an orchestrator internally.

Mermaid `graph TD` diagram showing: orchestrator → outbox → broker → choreographed consumers.

**Failure modes table**:

| Pattern | Typical failure mode | Mitigation in this design |
|---|---|---|
| Orchestration | God-service coupling creep | Limited surface: orchestrator owns only X |
| Choreography | Lost event in the middle | Outbox + at-least-once + consumer-side idempotency |

**When to revisit** — criteria for promoting a choreographed flow to orchestration, and vice versa.

---

### §9 Tech Stack and Rationale

**Defaults** — state the baseline stack: language/runtime, HTTP framework, DB driver/ORM, schema validation, observability, container / deployment model, secrets management.

> For a **monolith**: one defaults table covers the whole application. Note any libraries used for module-boundary enforcement (e.g. TypeScript barrel file restrictions, import linting rules).
>
> For **microservices**: state the defaults first, then use the per-service table below for deviations only. A service that follows all defaults needs only a one-line row.

A table with columns: `# | Module / Service | Frontend | Backend | Data | Notable choices and rationale`

For each unit, explain non-obvious stack choices (why this DB, why this library, why this pattern). Use `n/a` for columns that don't apply. Do not re-state the defaults — only document deviations.

**Alternatives explicitly rejected** — a list at the end: each alternative with a one-line reason. Cover: architecture style alternatives (e.g. why not microservices, or why not a monolith), language alternatives, ORM alternatives, broker alternatives, DB alternatives, auth alternatives, frontend alternatives.

---

### §10 Security Measures

**Baseline controls** — a bullet list of controls that apply to the entire application: identity at the external boundary, internal authn/authz model, TLS, secrets management, input validation, output encoding, logging hygiene (PII filtering), container / process hardening, dependency hygiene, rate limiting, audit logging.

> For a **monolith**: focus on the external boundary (API auth, input validation, output encoding) and internal module-level controls (which modules may access sensitive data, how PII is tagged and filtered). Inter-module calls do not need JWT auth but do need authorization checks.
>
> For **microservices**: add service-to-service identity (short-lived JWTs, mTLS) and per-service DB roles.

A table with columns: `# | Module / Service | Authn (who calls it) | Authz (what they can do) | Data protection at rest | Boundary-specific threats and controls`

For each unit's threats column, name the most novel or high-risk threat specific to that boundary (not generic "SQL injection").

**Trust zones** — list the trust boundaries that exist in this design (e.g. public internet, application process, DB, third-party SaaS). State what belongs in each.

**Cross-cutting controls tied to FRs** — a bullet list linking each control to its functional requirement ID.

**Threats explicitly accepted as MVP risk** — a bullet list of accepted risks with the phase gate where each will be mitigated. These must also appear in plan.md risk register.

---

### §11 Tests to Invest In

A prioritized bullet list of the highest-ROI test areas. Focus on:
- Primary state machine: full coverage of happy path + every timeout/cancel/change branch
- Idempotency: duplicate command delivery + duplicate webhook delivery
- Outbox relay: committed state change always produces exactly one broker delivery per consumer group, even across restarts
- Consent/compliance evidence chains: every consent event correctly written, no message sent without verifiable consent
- **Web projects only — Playwright E2E**: one spec per critical user flow identified in the grill-me interview. Each spec must cover: happy path end-to-end (browser → API → DB round-trip), key error/rejection path, and any auth gate. A passing Playwright run proves the full stack is wired correctly across all layers — not just that individual units work.

For each area, state what a passing test proves — not just what it tests.

---

### §12 Diagrams

A reference list of all diagrams with file path and one-line description:
- PlantUML files (`.puml`) for system context and detailed sequence flows
- Mermaid diagrams embedded in this document

---

### §13 Related Artifacts

Links to: `prd.md`, `plan.md`, `use-cases.md`, and any ADRs or design decision files.

---

## Output

- **File**: `docs/architecture.md`
- **Owner, Created, Status** metadata block at the top
- **Format**: Markdown with embedded Mermaid diagrams
- After saving, report which sections contain `TBD` placeholders and what grill-me input is needed to fill them.
