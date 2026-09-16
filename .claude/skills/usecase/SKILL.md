---
name: usecase
description: Generate docs/use-cases.md — end-to-end interaction flows with Mermaid sequence diagrams for every actor and scenario. Invoke after /grill-me or when the user asks to generate or update use cases.
---

# Use Cases Generator

Generate `docs/use-cases.md` — the single reference for end-to-end interaction flows, each with actors, trigger, Mermaid sequence diagram, and notes.

---

## Step 0: Load Context

1. If a grill-me interview summary exists in this conversation, use it as the primary input.
2. Read `docs/architecture.md` — use its service names, entity names, and event names exactly. Never invent synonyms.
3. Read `docs/prd.md` — every use case must trace to at least one user story (US-NNN) and reference relevant FR codes.
4. Read any existing `docs/use-cases.md` — update in place, preserving existing UC IDs.

---

## Step 1: Generate `docs/use-cases.md`

### File Header

Include: Owner, Created date, Status, and links to companion docs (`prd.md`, `architecture.md`).

One sentence: "This document is the single reference for end-to-end interaction flows."

---

### Actors Table

A table listing every actor with their role. Cover:
- Human actors (end user, vendor/business staff, founder/ops)
- AI hosts (the third-party assistant the user interacts with — list examples)
- Each relevant service (use names from architecture.md exactly)
- External systems (SMS provider, email provider, OAuth provider, etc.)

---

### Use Cases

For each use case, produce all five elements:

**1. ID and Title**
```
## UC-NN: [Title]
```
IDs are sequential: UC-01, UC-02, etc. Never reuse an ID.

**2. Goal** — one sentence: what success looks like for the primary actor.

**3. Trigger** — what event or action initiates this flow.

**4. Mermaid sequence diagram** — using `sequenceDiagram` syntax.

Diagram rules:
- Use `actor` for humans, `participant` for services and data stores, `queue` for brokers — **never `database`** in `sequenceDiagram` (only valid in ER/C4 types)
- Label every arrow with the API call, event name, or human action
- Use `Note over X,Y:` for inline context that cannot fit on an arrow
- Use `alt / else / end` blocks for every branching path (accept vs reject, success vs error, primary contact vs secondary)
- Use `loop` blocks for polling
- Use `Note over X,Y: [label]` to delineate phases of the flow (e.g. "One-time setup", "First booking attempt")
- Distinguish async fan-out with a `Note over` comment block rather than trying to represent broker topology inline — keep the diagram readable
- Never omit the happy path — always show the full sequence, not just the branching

**Mermaid safety rules — apply to every diagram before saving:**

- **`par` blocks must have `and`**: `par Label ... and Label ... end` — a `par` with no `and` is a parse error in most renderers.
- **No semicolons anywhere in diagram text**: Mermaid treats `;` as a statement separator (same as a newline). This applies to arrow labels (`A->>B: foo; bar`), `Note over` text, `loop`/`alt` condition text — everywhere. The second half becomes an orphan statement that fails with "got NEWLINE" on the *next* line, making the error appear to point at the wrong place. Replace `;` with `,` universally.
- **No Unicode arrows in labels or notes**: Replace `→` (U+2192) and similar with `--`, `=>`, or plain words. Non-ASCII characters break Mermaid's lexer in many environments.
- **No `<` / `>` in label text**: Angle brackets render as empty HTML tags. Use `PLACEHOLDER` or `YOUR_VALUE` instead (e.g. `https://DOMAIN:8443` not `https://<domain>:8443`).
- **Keep participant `as` aliases safe**: The display name after `as` must not contain `'` (apostrophe), `/` (slash), or `)` followed by `:` — all break the participant declaration parser. Use hyphens or spaces only (e.g. `participant ACME as LetsEncrypt duckdns` not `Let's Encrypt / duckdns`).
- **No parentheses+colon in aliases**: `(dedicated :8443)` breaks parsing — use `port-8443` instead.
- **No `database` keyword in `sequenceDiagram`**: Use `participant` for all data stores; `database` is only valid in ER and C4 diagram types, not sequence diagrams.
- **No Unicode punctuation in labels or notes**: Replace `·` (middle-dot), `—` (em-dash), `–` (en-dash, including ranges like `2–4`) with `,`, `-`, or words. A non-ASCII character mid-label breaks the lexer silently, causing the *next* line to fail with a spurious "Expecting arrow, got NEWLINE" error — the real culprit is always the Unicode character on the line above.
- **No apostrophes anywhere in diagram text**: `B's` → `B` or rephrase — applies to `Note over` text, arrow labels, and `alt/loop` condition text equally.

**5. Notes** — bullet list covering:
- Edge cases not shown in the diagram
- Key design decisions this flow depends on (reference architecture.md sections or plan.md D-codes)
- Cross-references to prd.md FR codes
- Phase designation if the use case is not in MVP
- **Web projects only**: reference the Playwright spec that covers this use case (e.g. `tests/uc-NN-<title>.spec.ts`). Note whether the spec covers the happy path, the alt/error paths shown in the diagram, or both. If no spec exists yet, flag it: `> Playwright coverage: pending — add to test backlog.`

---

### Which Use Cases to Generate

Derive the use cases entirely from the grill-me interview summary, the user stories in `prd.md`, and the flows described in `architecture.md`. Do not apply a fixed template or assume any particular set of scenarios.

**How to identify use cases:**

1. For each actor in the Actors Table, ask: what are the distinct goals this actor tries to achieve? Each meaningful goal is a candidate use case.
2. For each user story in `prd.md`, ask: does this story describe a multi-step interaction that benefits from a sequence diagram? If yes, it is a use case.
3. For each state machine or critical path in `architecture.md`, ask: is there a flow a reader would need to trace end-to-end to understand the system? If yes, it is a use case.
4. For each phase gate or risk in `plan.md`, ask: is there a flow that must work correctly for the gate to pass? If yes, it is a use case.

**Guidance on scope per use case:**

- One use case = one actor goal, one trigger, one end state. Split flows that have materially different actors, triggers, or outcomes into separate use cases.
- Do not split a flow solely because it branches — use `alt / else / end` blocks instead.
- Do not merge two flows solely because they share participants — keep them separate if the goal or trigger differs.
- Mark use cases that are out of MVP scope clearly at the top: `**Phase N+ — not in MVP.**`

**Typical categories to consider** (include only those relevant to this product — do not force any that do not apply):

- First-time setup or onboarding for each actor type
- Primary happy-path transaction or action
- Error, rejection, or fallback paths on the primary flow
- Cancellation or reversal
- Modification or amendment
- Timeout, expiry, or no-response escalation
- Notification or communication flows
- Compliance or opt-out flows (if the product sends messages or holds consent)
- Admin, ops, or support flows
- Phase 2+ flows that are documented but not yet built

The list above is a prompt for thinking — not a checklist. Omit any category that has no corresponding flow in the grill-me summary or prd.md.

---

## Output

- **File**: `docs/use-cases.md`
- **Format**: Markdown with embedded Mermaid `sequenceDiagram` blocks
- After saving, list:
  - Which use cases have placeholder diagrams and what detail is needed to complete them
  - Which use cases are Phase 2+ (marked in the document but flagged here for visibility)
  - Any UC not yet covered that was mentioned in the grill-me interview
