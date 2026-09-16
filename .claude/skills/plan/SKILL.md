---
name: plan
description: Generate docs/plan.md — the phase plan, locked decisions, KPI summary, risk register, and compliance notes. Invoke after /grill-me or when the user asks to generate or update the plan document.
---

# Phase Plan Generator

Generate `docs/plan.md` — the phase plan, locked decisions, exit gates, KPI summary, risk register, and compliance notes.

---

## Step 0: Load Context

1. If a grill-me interview summary exists in this conversation, use it as the primary input.
2. Read `PROJECT.md` and `docs/architecture.md` (if they exist) for confirmed decisions and service topology.
3. Read any existing `docs/plan.md` — update in place rather than overwriting decisions already locked.
4. Never invent decisions — only record what was explicitly decided in the grill-me interview or existing docs.

---

## Step 1: Generate `docs/plan.md`

Produce all sections below. If information for a section is not yet available, write `> TBD — requires grill-me input: [what is needed]`. Do not skip sections.

---

### §1 Vision

- **Long-term vision**: one to two sentences describing the platform at full scale.
- **Expansion axes**: name the dimensions the product grows along (e.g. width = more vendor verticals; depth = more functionality per transaction type).
- **v1 wedge**: one sentence — what is strictly in scope for MVP, nothing more.

---

### §2 Core Architecture Principles

A table showing hard-coded specific naming to avoid vs the generic internal abstraction to use. This enforces the day-1 generic model so future vertical expansion requires no schema rewrite.

| Hard-coded specific naming (avoid) | Generic abstraction (use) |
|---|---|
| e.g. `restaurant` | `vendor` (type discriminator) |

One row per concept. Add as many rows as the design requires.

---

### §3 Locked Decisions

A table: `| # | Decision | Lock |`

Lock status: `Locked`, `Partially locked`, or `Open`.

Number decisions D-01, D-02, etc. Cover every decision that was resolved in the grill-me interview. At minimum, address:

- Product scope and v1 wedge
- Delivery model (API surface: MCP, REST, OpenAPI, etc.)
- Marketplace / distribution rollout sequence
- Supply-side handling model (how vendors receive and confirm transactions)
- Identity and auth model (self-hosted vs third-party; JWT standard)
- Primary confirm channel (SMS, email, in-app, fallback priority)
- Transaction lifecycle scope (create, cancel, change, notes)
- Geography (launch region)
- Launch staging (closed alpha → open beta → public)
- Acquisition strategy (cold call, AI-driven inbound, paid ads, etc.)
- Business model (free / paid / commission; amounts; trial terms)
- End-user pricing (always free, freemium, etc.)
- Tech stack (language, framework, DB, cache, broker, hosting)
- Architecture style (microservices / monolith)
- Integration patterns (sync REST, async events, outbox, broker choice)
- Auth implementation detail (library/provider choice + reason for rejection of alternatives)
- Email provider (with reason for rejection of alternatives)
- Data residency requirement and timeline
- Data retention policy
- Designated privacy officer
- Generic data model adoption from day 1
- Platform naming (English + localized name, domain targets)

---

### §4 Phase Plan

One subsection per phase. Use this structure for each phase:

```
### Phase N — [Name] ([timeline estimate])

**Goal**: [one sentence]

**Scope**:
- [what is in scope]
- Out of scope: [explicit list]

**Steps**:

1. [Action — what specifically to do]
   > **Gate ✓** — [specific verifiable check: a command to run, an observable outcome, or a file/artifact that must exist]

2. [Next action]
   > **Gate ✓** — [specific check]

(continue for all steps in this phase)

**Exit gate**:
- [ ] [phase-level verifiable checklist item — something you can confirm exists or was observed]
- [ ] *(web projects)* `npx playwright test` passes for all flows confirmed in grill-me §5/§9 as phase exit criteria

**Anti-gate**: [what must NOT happen — kill-switch conditions that block the next phase]
```

Every step must have an inline gate. A step without a gate is incomplete. Gates must be specific and verifiable — not "confirm it works" but a concrete command, observable output, or named artifact that proves the step is done.

> **Web project rule**: any step or exit gate that involves a web UI flow MUST include a Playwright test gate. Format: `npx playwright test tests/<flow>.spec.ts` exits 0. A manual "open browser and check" is not an acceptable gate for a web UI step.

For **Phase 1 (Closed Alpha)** only: break down into vertical slice sub-milestones (M1.1, M1.2, etc.). For each sub-milestone:

```
#### M1.N — [Name] (Weeks X–Y)

**Services in scope**: [list]
**Out**: [what is explicitly excluded from this slice]
**Surface for demo**: [how the founder can demo this slice — curl, browser, real device, etc.]
**Vertical slice proven**: [the end-to-end capability this slice demonstrates]

**Steps**:

1. [Action]
   > **Gate ✓** — [specific check]

2. [Next action]
   > **Gate ✓** — [specific check]

(continue for all steps in this milestone)

**Exit gate**:
- [ ] [milestone-level verifiable checklist item]
```

End Phase 1 with a **rationale for this slicing** — why vertical slices over horizontal layers, and why this particular ordering.

Standard phases to cover:
- **Phase 0 — Pre-build**: legal, infra setup, PoC spike to prove the riskiest technical assumption
- **Phase 1 — Closed Alpha**: core product working with 5–10 vendors and internal/friend users
- **Phase 2 — Open Beta**: public distribution host, 30–50 vendors, HA, compliant data residency
- **Phase 3 — Vertical Width Expansion**: new transaction types or vendor verticals, multi-host distribution
- **Phase 4 — Functional Depth Expansion**: catalog, orders, payments, loyalty

For Phase 4 and beyond, exit gates are intentionally lighter — re-plan in a new grill-me pass when Phase 3 closes.

---

### §5 Architecture Snapshot

One-line topology description.

A table of phase-related architecture gates — what changes architecturally at each phase transition:

| Phase gate | Architecture change |
|---|---|
| MVP | e.g. Redis Streams broker, per-service schemas in shared Postgres, Docker secrets |
| Phase 2 open beta | e.g. re-evaluate broker, split high-load DB instances, enable mTLS, move to KMS |

Cross-reference `architecture.md` for detail. Do NOT duplicate architecture content here.

---

### §6 KPI Summary

A table: `| Phase | Gating metric | Target |`

Cover per phase: primary transaction volume (North Star), success rate, latency, active vendor/user rate, retention, compliance audit pass/fail, PII incident count. State the North Star metric explicitly at the top of the section.

**Anti-metric kill switch**: for closed alpha, state the minimum threshold below which the integration model is re-evaluated instead of continuing.

---

### §7 Risk Register

A table: `| # | Risk | L | I | Phase | Mitigation |`

Columns: Risk ID (R1, R2…), Description, Likelihood (Low/Med/High), Impact (Low/Med/High/Critical), Phase where the risk is most acute, Mitigation.

Cover at minimum:
- Founder bandwidth (solo eng + acquisition)
- Supply-side adoption (vendors refuse the tool)
- AI hallucination / wrong transaction
- Unattended supply side (SLA breach)
- CASL violation (no opt-in log, missing suppression)
- PII / sensitive data breach
- Infrastructure SPOF (single VPS)
- Distribution host policy change (AI platform bans integrations)
- Supply-side churn
- Unit economics (CAC > LTV at target commission)
- Abuse / prompt injection
- Bilingual UI delay
- Third-party cost spikes (SMS, email, infra)
- Data residency violation at open beta (PIPEDA)

For each MVP accepted risk from architecture.md §10 (plaintext intra-container traffic, Docker secrets, shared DB, no DLP), add a row that cross-references the architecture doc and states the Phase 2 mitigation gate explicitly.

---

### §8 Compliance Notes

One subsection per applicable regulation. Cover at minimum:

- **CASL** (if applicable): double opt-in requirement, audit log format (timestamp, IP, consent text version), STOP handling, suppression enforcement, unsolicited message prohibition
- **PIPEDA / provincial privacy** (if Canada): designated accountable person, encryption at rest for sensitive fields, breach notification SLA (72 hours), data residency hard gate, transitional disclosure requirement during pre-residency phase
- **Other regulations** (GDPR, HIPAA, PCI, etc.): add as applicable based on geography and data types

---

### §9 Open Questions

A table: `| # | Question | Owner | Deadline | Status |`

Any question with no owner or no deadline is automatically flagged as a **Risk** — add a note: "Unowned — escalate to risk register."

---

### §10 Out of Scope (MVP)

An explicit bullet list of what is NOT in MVP. This section is critical for scope management — be specific.

---

### §11 Related Artifacts

Links to: `architecture.md`, `prd.md`, `use-cases.md`, and any design decision or ADR files.

---

## Output

- **File**: `docs/plan.md`
- **Owner, Created, Status** metadata block at the top with a one-line slogan for the product
- **Format**: Markdown
- After saving, list which sections contain `TBD` placeholders and what additional grill-me input is needed to fill them.
