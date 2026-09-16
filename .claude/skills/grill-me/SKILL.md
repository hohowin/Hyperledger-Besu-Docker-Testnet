---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

---

## Question Coverage

The interview MUST cover the following topic areas with enough depth to generate all downstream documents (README, architecture, plan, PRD, use-cases). Do not skip a topic area.

### 1. Product & Vision
- What does the product do? Who is it for? What core problem does it solve?
- What is the v1 scope (wedge)? What are the long-term expansion axes (width / depth)?
- What is the product name? What user-facing terminology is used vs internal model terminology?

### 2. Actors & Interaction Surfaces
- Who are the actors? (e.g. end user, vendor/business, admin/ops, AI host, third-party system)
- How does each actor interact with the system? (web, mobile, API, MCP, SMS, email, dashboard)
- What channels and surfaces does the system expose publicly vs internally?

### 3. Core Flows & Use Cases
- What are the primary end-to-end flows? Walk through each: trigger → sequence → outcome
- What are the key state machines? What are the valid transitions and terminal states?
- What are the race conditions or conflict rules? (e.g. cancel wins over change)
- What are the escalation and fallback paths when a party does not respond?
- What are the key error paths and how does the system recover?

### 4. Business Model
- What is free? What is paid? What triggers the paywall or conversion?
- What happens to data and active records if a user or vendor downgrades or cancels?
- What is the launch staging strategy? (e.g. closed alpha → open beta → public)
- What is the acquisition strategy for the supply and demand sides?

### 5. Tech Stack
- Language / runtime? HTTP framework? DB and ORM? Cache? Event broker?
- Auth implementation (self-hosted vs third-party)? JWT standard? JWKS endpoint?
- SMS / voice provider? Email provider? Any other external services?
- Hosting model (self-hosted VPS, managed containers, serverless)?
- Frontend framework (if applicable)? Bilingual / i18n requirements?
- **If a web frontend exists**: E2E testing strategy — which user flows will be covered by Playwright tests? What are the critical paths that must pass before a phase can exit?

### 6. Service Topology & Domain Model
- How many services are in scope for MVP? What does each service own (capabilities + data)?
- What are the key domain entities? Which service owns each?
- Which services are deep (non-trivial domain logic) vs shallow (thin adapters)?
- Which services are deferred to a later phase, and why?

### 7. Integration Patterns
- Which interactions are synchronous (request/response)? Which are asynchronous (events)?
- Which paths require strong consistency? Which can tolerate eventual consistency?
- What event broker is used? At-least-once or exactly-once delivery?
- Is the outbox pattern used? How are domain writes and outbox rows kept atomic?
- Where is orchestration used vs choreography? What is the decision rule?
- What is the circuit-breaker / degradation policy for each critical sync path?

### 8. Security & Compliance
- How are services authenticated to each other? (e.g. short-lived JWTs, shared secrets)
- What is the per-service authorization model? (scopes, roles, row-level)
- Which fields contain PII or sensitive data? How are they protected at rest and in transit?
- What compliance obligations apply? (CASL, PIPEDA, GDPR, HIPAA, PCI, etc.)
- Data residency requirements? Data retention and deletion policy?
- What are the most novel or high-risk threat surfaces? (e.g. prompt injection, webhook spoofing)

### 9. Phase Plan & Risks
- What are the phases? What is in scope for each? What are the exit gates and KPIs?
- What is the sub-milestone slicing strategy within Phase 1 (vertical slices vs horizontal layers)?
- What are the top risks? (likelihood, impact, mitigation per risk)
- What are the open questions that must be resolved before each phase starts?
- What are the hard compliance or infrastructure gates (e.g. data residency before open beta)?
- **If a web frontend exists**: which Playwright test files or suites must be green before each phase exit? Name the flows (e.g. sign-up, checkout, primary happy path).

### 10. Infrastructure & Observability
- Containerisation and orchestration strategy per phase?
- CI/CD pipeline (lint, typecheck, test, build, deploy)?
- Observability: structured logging, distributed tracing, metrics, alerting?
- Backup, disaster recovery, and hot-standby strategy per phase?
- Secrets management approach per phase?

---

## When the Interview Is Complete

Summarize all key decisions in a structured decision log:

```
| # | Decision | Lock |
|---|----------|------|
| D-01 | ... | Locked / Partially locked / Open |
```

Then ask the user which documents to generate:

```
1. README
2. PRD (`/prd`)
3. Architecture doc (`/architecture`)
4. Phase plan (`/plan`)
5. Use-cases (`/usecase`)
6. Deliverables guide (`/deliverables`)
7. All of the above (1–6)
8. Nothing — interview was enough
```

When the user selects documents, invoke the corresponding skills in this order — each skill reads the grill-me summary from this conversation.

> **Web project flag**: if the grill-me interview confirmed a web frontend, pass this context to every downstream skill so that plan gates, deliverable checklists, architecture test priorities, and use-case notes all include Playwright E2E cases for the critical flows identified in §5 and §9.

- **README**: generate directly (no separate skill). Write `README.md` in the project root with sections: what it is, who it serves + how they interact (table), key capabilities, architecture at a glance (services + ports table), prerequisites, getting started (clone → configure env → start → seed), accessing the application (URLs table + quick API test), key documents (table linking to docs/), development notes, compliance notes.
- **PRD**: invoke `/prd`
- **Architecture**: invoke `/architecture`
- **Phase plan**: invoke `/plan`
- **Use-cases**: invoke `/usecase`
- **Deliverables guide**: invoke `/deliverables`

After all selected documents have been generated, always invoke `/skills-required` as the final step. This audits the installed skills against the confirmed tech stack and flags any gaps before implementation begins.

Do NOT proceed to generate any document unless the user explicitly selects an option.
