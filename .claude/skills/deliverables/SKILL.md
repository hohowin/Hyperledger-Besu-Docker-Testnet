---
name: deliverables
description: Generate docs/deliverables.md — phase-by-phase concrete deliverables with step-by-step "how to try it" guides for each artifact. Invoke after /grill-me or when the user asks to generate or update the deliverables document.
---

# Deliverables Guide Generator

Generate `docs/deliverables.md` — the complete, phase-by-phase catalogue of concrete, verifiable deliverables, each with a step-by-step "how to try it" guide that any developer or tester can follow from a cold start.

This document is NOT a spec. It is a demo and verification guide — the answer to: "What can I actually touch, run, or observe at the end of each phase?"

---

## Step 0: Load Context

1. If a grill-me interview summary exists in this conversation, use it as the primary input.
2. Read `docs/plan.md` — use its phase names, milestone codes (M1.1, M1.2…), and exit gates as the authoritative source of phases and scope.
3. Read `docs/prd.md` — cross-reference user stories (US-NNN) and functional requirements (FR-N) so every deliverable traces to at least one requirement.
4. Read `docs/architecture.md` — use exact service names, port numbers, and data store names. Never invent synonyms.
5. Read any existing `docs/deliverables.md` — update in place, preserving existing DL-IDs. Do not renumber.
6. If none of the above docs exist (pure greenfield, no grill-me), ask the user for the phase names and the highest-priority deliverable for each phase before proceeding.

---

## Step 1: Classify Deliverables

Before writing the document, enumerate every concrete artifact in scope across all phases. Group each by type:

| Type | Definition |
|---|---|
| `feature` | User-facing capability a real user can exercise end-to-end |
| `api` | REST, GraphQL, MCP, WebSocket, or webhook endpoint |
| `ui` | Screen, page, component, or CLI surface |
| `infra` | Running service, container, database, queue, or CI/CD pipeline |
| `integration` | Live connection to a third-party system (auth, messaging, storage, etc.) |
| `doc` | Design artifact: PRD, architecture doc, ADR, README, use-cases |
| `test` | Passing test suite, coverage gate, or automated smoke test |

Assign each deliverable a stable ID: `DL-N.M` where N = phase number and M = sequential within that phase (e.g. `DL-1.1`, `DL-1.2`, `DL-2.1`). IDs never change once assigned.

A deliverable is only valid if a reviewer can independently verify it exists. Reject any deliverable that:
- Cannot be demonstrated at a demo
- Cannot be checked by running a command
- Is a vague goal rather than a concrete artifact ("system is scalable" → not valid; "load test shows p95 < 200ms at 500 RPS" → valid)

If a deliverable from plan.md does not meet this bar, restate it as an acceptance criterion on the relevant user story instead.

---

## Step 2: Generate `docs/deliverables.md`

Produce all sections below. Write `> TBD — requires input: [what is needed]` for any section with insufficient context. Do not skip sections.

---

### File Header

```
Owner: [project lead or team]
Created: [date]
Status: [Draft / In Review / Approved]

Companion docs: [docs/plan.md] · [docs/prd.md] · [docs/architecture.md] · [docs/use-cases.md]
```

One sentence: "This document is the single reference for what is deliverable and verifiable at the end of each project phase, and how to try each deliverable from a cold start."

---

### §1 Overview Table

A single at-a-glance table spanning all phases:

| DL-ID | Phase | Milestone | Type | Deliverable | Status |
|---|---|---|---|---|---|
| DL-1.1 | Phase 1 — Closed Alpha | M1.1 | infra | … | Planned / In Progress / Done |

Status values: `Planned`, `In Progress`, `Done`, `Deferred`, `Dropped`.

Sort by DL-ID. Include all phases. This table is the executive summary of the entire document.

---

### §2–N Per-Phase Sections

One section per phase from plan.md. Use this structure for every phase:

---

#### Phase N — [Name]

**Goal**: [one sentence — what a user can do by the end of this phase that they could not do before]

**Prerequisites** — what must be true before any deliverable in this phase can be tried:

```
Checklist:
- [ ] [Runtime, e.g. Node 22+ installed]
- [ ] [Services running, e.g. docker compose up]
- [ ] [Config applied, e.g. .env.local populated with X, Y, Z]
- [ ] [Seed data loaded, if applicable — exact command]
- [ ] [Prior phase exit gate passed — cite the DL-ID or plan.md gate]
```

**Deliverables**:

For each deliverable in this phase, produce a block with the following structure:

---

##### DL-N.M — [Deliverable name]

| Field | Value |
|---|---|
| **Type** | [feature / api / ui / infra / integration / doc / test] |
| **Phase** | Phase N — [Name] |
| **Milestone** | [M1.1 or N/A if no milestones] |
| **Traces to** | [US-NNN, FR-N, or plan.md gate reference] |
| **Demo surface** | [browser at URL / curl command / CLI / Telegram / automated test] |

**What it is**: one sentence describing what this deliverable is and why it matters.

**How to try it**:

Numbered, concrete steps. Each step must be actionable from the terminal or browser — no abstract instructions.

```
1. [Exact command or browser action — e.g. `curl -X POST http://localhost:4820/api/tasks -H "Authorization: Bearer $DASHBOARD_TOKEN" -d '{"title":"test"}'`]
2. [What to observe — expected output, screen state, or file that must exist]
3. [Any follow-on action needed to complete the flow]
```

**Verification checklist** — what "done" looks like (specific, observable):
- [ ] [Specific observable outcome — e.g. `HTTP 201` returned with `{"id": ...}`]
- [ ] [Another check — e.g. card appears in Kanban board under "Planned"]
- [ ] [Typecheck / lint passes if code was written]
- [ ] *(web `ui` / `feature` deliverables only)* `npx playwright test tests/<flow>.spec.ts` exits 0 — covering the happy path and key error/alt paths for this deliverable

**Known limitations at this phase**: [what is intentionally incomplete or stubbed — links to the future DL-ID that resolves it]

---

End of each phase section:

**Phase exit gate summary** (link to plan.md — do not duplicate):
- [ ] All DL-N.x deliverables verified
- [ ] [Phase-level exit gate from plan.md — copied verbatim, not paraphrased]

---

### §(last) How to Run a Full End-to-End Demo

A single narrative section written for someone running a live demo or handoff review. It stitches together the key deliverables from the most recently completed phase into a coherent story.

Structure:

**1. Start the stack**
```bash
[exact commands to start all services]
```

**2. Walk through the primary flow**
Reference DL-IDs and link to their "How to try it" sections. Do not duplicate the steps here — narrate the journey and point to the detail.

**3. Show the key outputs**
What should a reviewer see when everything is working? (URLs, terminal output, notifications, reports.)

**4. Tear down**
```bash
[exact commands to stop services and clean up if needed]
```

---

## Output

- **File**: `docs/deliverables.md`
- **Owner, Created, Status** metadata block at the top
- **Format**: Markdown
- After saving, report:
  - Which deliverables have `TBD` placeholders and what input is needed to fill them
  - Which deliverables are `Deferred` and which phase they moved to
  - Any DL-IDs from a prior version that were dropped, and why

---

## Writing Standards

The reader of this document is a developer, tester, or technical reviewer who wants to verify the product works — not a product manager reading requirements.

- Every "How to try it" must work from a cold terminal with no assumed knowledge beyond the prerequisites.
- Use exact commands with real flag names, real environment variable names, and real URLs/ports.
- Never use abstract instructions like "configure the settings" — write "open `.env.local` and set `X=your-value`".
- If a deliverable has a UI component, include the exact URL and what element to interact with.
- If a deliverable produces output (file, JSON, notification, log line), show the expected output so the reader knows what "correct" looks like.
- **For web UI deliverables** (`type: ui` or `type: feature` with a browser surface): "How to try it" must include a Playwright step — the exact `npx playwright test` command and what the passing output looks like. The verification checklist must include the Playwright gate. Do not accept "open the browser and check" as verification.
- Mark Phase 2+ deliverables clearly at the top of their block: `**Phase N+ — not in current scope.**`
