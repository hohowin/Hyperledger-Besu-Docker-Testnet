# PRD Generator

Create detailed Product Requirements Documents that are clear, actionable, and suitable for implementation.

---

## The Job

1. Detect context: existing codebase or greenfield product
2. Receive a feature/product description from the user
3. Consume any prior grill-me summary; skip re-asking resolved questions
4. Sketch the major modules to build or modify; confirm with the user
5. Generate a structured PRD based on answers and module sketch
6. Save to `tasks/prd-[feature-name].md` and publish to the project issue tracker

**Important:** Do NOT start implementing. Just create the PRD.

---

## Step 0: Context Detection

**If an existing codebase is present:**
- Read `CLAUDE.md`, `PROJECT.md`, and any ADRs in `docs/architecture/` relevant to the feature area
- If a separate `architecture.md` (or equivalent) exists, include a **Service Architecture** section in the PRD that maps the feature to relevant services and links to that doc — do not duplicate architecture content into the PRD
- Identify the domain glossary: use the project's existing vocabulary throughout the PRD (never invent synonyms for established terms)
- Understand existing patterns, conventions, and constraints — respect any ADRs that apply
- Note current module boundaries so the module sketch reflects reality, not a greenfield design
- If a risk register exists (`plan.md` or equivalent), cross-reference it in the PRD Risks section rather than duplicating risk content

**If no codebase exists (greenfield product):**
- Skip repo exploration
- Ask the user for a one-paragraph product context if not already provided: what it is, who it's for, and what platform/stack is intended
- Derive the domain vocabulary from the user's description; establish it explicitly in the PRD Introduction

---

## Step 1: Clarifying Questions (conditional)

**If the user ran `/grill-me` beforehand**, use the grill-me interview summary as the source of truth for problem, scope, decisions, and constraints. Do not re-ask questions already resolved in that session. Jump directly to the module sketch.

Otherwise, assess whether sufficient context exists to proceed. Only ask questions when the answer would materially change the PRD. Focus on genuine ambiguities:

- **Problem/Goal:** What problem does this solve?
- **Core Functionality:** What are the key actions?
- **Scope/Boundaries:** What should it NOT do?
- **Success Criteria:** How do we know it's done?
- **Business Model:** What's free? What's paid? What triggers the paywall?

If you do ask, use lettered options so the user can reply with "1A, 2C, 3B":

```
1. What is the primary goal of this feature?
   A. Improve user onboarding experience
   B. Increase user retention
   C. Reduce support burden
   D. Other: [please specify]

2. Who is the target user?
   A. New users only
   B. Existing users only
   C. All users
   D. Admin users only

3. What is the scope?
   A. Minimal viable version
   B. Full-featured implementation
   C. Just the backend/API
   D. Just the UI
```

---

## Step 1b: Module Sketch

After the user answers the clarifying questions, sketch the major modules you will need to build or modify. Present this before drafting the PRD and confirm it with the user.

**Actively look for deep modules** — a module that encapsulates significant functionality behind a simple, stable, testable interface. Prefer deep modules over shallow ones (thin wrappers that just delegate). Deep modules are worth extracting because they can be tested in isolation and their interface rarely needs to change.

Present the sketch like this:

```
Modules to build/modify:

NEW:
- PriorityService — assigns and validates priority levels; exposes setPriority(taskId, level) and getPriority(taskId) [deep — encapsulates validation rules, defaults, and persistence logic]

MODIFY:
- TaskRepository — add priority column to schema and query filters
- TaskCard (UI) — render priority badge; no business logic here [shallow — thin render wrapper]

Do these match your expectations?
Which of these modules would you like tests written for?
```

Wait for the user's confirmation before proceeding to the PRD.

---

## Step 2: PRD Structure

Generate the PRD with these sections:

### 1. Introduction/Overview
Brief description of the feature and the problem it solves.

### 2. Goals
Specific, measurable objectives (bullet list).

### 3. Business Model (include when the feature involves monetization, subscriptions, or free/paid tiers)
- What is free vs. paid?
- What triggers the paywall or conversion?
- What happens to user data if they downgrade or cancel?
- Expected price point and revenue model

### 4. User Stories
Each story needs:
- **Title:** Short descriptive name
- **Description:** "As a [user], I want [feature] so that [benefit]"
- **Acceptance Criteria:** Verifiable checklist of what "done" means

Each story should be small enough to implement in one focused session.

**Format:**
```markdown
### US-001: [Title]
**Description:** As a [user], I want [feature] so that [benefit].

**Acceptance Criteria:**
- [ ] Specific verifiable criterion
- [ ] Another criterion
- [ ] Typecheck/lint passes
- [ ] **[UI stories only]** Verify in browser using dev-browser skill
```

**Important:** 
- Acceptance criteria must be verifiable, not vague. "Works correctly" is bad. "Button shows confirmation dialog before deleting" is good.
- **For any story with UI changes:** Always include "Verify in browser using dev-browser skill" as acceptance criteria. This ensures visual verification of frontend work.

### 5. Functional Requirements
Group requirements into release phases — do not use a flat list:

**MVP (must ship for GA):**
- FR-1: The system must allow users to...
- FR-2: When a user clicks X, the system must...

**Post-MVP (important but not blocking launch):**
- FR-N: ...

**Future (nice-to-have, explicitly deferred):**
- FR-N: ...

Be explicit and unambiguous. Every FR must be traceable to a user story.

### 6. Non-Goals (Out of Scope)
What this feature will NOT include. Critical for managing scope.

### 7. Design Considerations (Optional)
- UI/UX requirements
- Link to mockups if available
- Relevant existing components to reuse

### 8. Technical Considerations (Optional)
- Known constraints or dependencies
- Integration points with existing systems
- Offline behavior (if applicable)

**Non-Functional Requirements (required when the feature has measurable quality expectations):**

Use a table with four columns so each NFR is traceable to an architectural decision and its tradeoff is explicit:

| NFR | MVP target | How the architecture supports it | Tradeoff / phase gate |
|---|---|---|---|
| Latency | p95 < X ms | ... | ... |
| Availability | ≥ X% | ... | ... |

Cover: Availability, Latency, Throughput, Scalability, Consistency, Reliability, Security, Privacy, Observability, Operability, Cost. Omit rows that don't apply.

**Privacy & Data (required when the feature collects, stores, or transmits personal data):**
- What data is collected and why
- Retention policy and deletion behavior
- Compliance requirements (GDPR, COPPA, HIPAA, CASL, PIPEDA, etc.)
- Access control and sharing rules

### 9. Success Metrics
Every metric must include a baseline, a target, and a timeframe. Include at least one retention or engagement metric — not just acquisition.

**Format:**
- [Metric name]: [Baseline] → [Target] by [Timeframe]
- Example: D30 retention: unknown (new product) → >40% by Month 3
- Example: Subscription conversion: 0% → >5% of MAU by Month 6

Weak metrics ("able to support server costs", ">1000 users") are not acceptable — replace with specific, measurable, time-bound targets.

### 10. Open Questions
Every open question must have an owner and a resolution deadline. Unowned questions are silent blockers.

**Format:**
```
| # | Question | Owner | Deadline | Status |
|---|----------|-------|----------|--------|
| 1 | Should data export be P0 or P2? | PM | 2025-06-01 | Open |
```

If a question has no owner or deadline, mark it explicitly as a **Risk** — it may block the build.

### 11. Risks (required when the feature has non-trivial failure modes or compliance exposure)

Do not duplicate a project-level risk register — cross-reference it. List only risks that are PRD-relevant (i.e. a specific FR or user story depends on the risk being mitigated).

**Format:**
```
| Risk ID | Description | Mitigated by |
|---------|-------------|--------------|
| R3 | AI hallucinates wrong booking | FR-6 (user confirm gate), FR-13 (AI prompt audit) |
```

If no project risk register exists, use a local table with columns: `# | Risk | Likelihood | Impact | Mitigation`.

### 12. Phase Deliverables (required for multi-phase products)

List the concrete shippable artifacts per phase and milestone. Each row must be something a reviewer can verify exists — not a vague goal.

**Format:**
```
#### Phase N — [Name]

| # | Deliverable | Notes |
|---|-------------|-------|
| PD-N.1 | Specific artifact (e.g. service, schema, screen, doc) | Notes on scope or constraints |
```

Group by milestone when a phase has multiple milestones (e.g. M1.1, M1.2). A deliverable that cannot be verified at demo time is not a deliverable — rewrite it as an acceptance criterion on a user story instead.

---

## Writing for Junior Developers

The PRD reader may be a junior developer or AI agent. Therefore:

- Be explicit and unambiguous
- Avoid jargon or explain it
- Provide enough detail to understand purpose and core logic
- Number requirements for easy reference
- Use concrete examples where helpful

---

## Output

- **Format:** Markdown (`.md`)
- **Location:** `docs/`
- **Filename:** `prd.md` (single canonical PRD per project)

After saving the file, publish the PRD to the project issue tracker if one exists:
- Create an issue with the PRD title and the full markdown body
- Apply the label **`ready-for-agent`** — no additional triage needed

---

## Example PRD

```markdown
# PRD: Task Priority System

## Introduction

Add priority levels to tasks so users can focus on what matters most. Tasks can be marked as high, medium, or low priority, with visual indicators and filtering to help users manage their workload effectively.

## Goals

- Allow assigning priority (high/medium/low) to any task
- Provide clear visual differentiation between priority levels
- Enable filtering and sorting by priority
- Default new tasks to medium priority

## User Stories

### US-001: Add priority field to database
**Description:** As a developer, I need to store task priority so it persists across sessions.

**Acceptance Criteria:**
- [ ] Add priority column to tasks table: 'high' | 'medium' | 'low' (default 'medium')
- [ ] Generate and run migration successfully
- [ ] Typecheck passes

### US-002: Display priority indicator on task cards
**Description:** As a user, I want to see task priority at a glance so I know what needs attention first.

**Acceptance Criteria:**
- [ ] Each task card shows colored priority badge (red=high, yellow=medium, gray=low)
- [ ] Priority visible without hovering or clicking
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Add priority selector to task edit
**Description:** As a user, I want to change a task's priority when editing it.

**Acceptance Criteria:**
- [ ] Priority dropdown in task edit modal
- [ ] Shows current priority as selected
- [ ] Saves immediately on selection change
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Filter tasks by priority
**Description:** As a user, I want to filter the task list to see only high-priority items when I'm focused.

**Acceptance Criteria:**
- [ ] Filter dropdown with options: All | High | Medium | Low
- [ ] Filter persists in URL params
- [ ] Empty state message when no tasks match filter
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

**MVP:**
- FR-1: Add `priority` field to tasks table ('high' | 'medium' | 'low', default 'medium')
- FR-2: Display colored priority badge on each task card
- FR-3: Include priority selector in task edit modal
- FR-4: Add priority filter dropdown to task list header

**Post-MVP:**
- FR-5: Sort by priority within each status column (high to medium to low)

## Non-Goals

- No priority-based notifications or reminders
- No automatic priority assignment based on due date
- No priority inheritance for subtasks

## Technical Considerations

- Reuse existing badge component with color variants
- Filter state managed via URL search params
- Priority stored in database, not computed

## Success Metrics

- Task filter usage: 0 → >30% of DAU use priority filter within 30 days of launch
- Time to set priority: new task → priority set in under 2 clicks
- No regression in task list load time (p95 < 200ms)

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|----------|-------|----------|--------|
| 1 | Should priority affect task ordering within a column? | PM | 2025-06-01 | Open |
| 2 | Add keyboard shortcuts for priority changes? | Design | 2025-06-01 | Open |
```

---

## Checklist

- [ ] Detected context: existing repo or greenfield — handled appropriately
- [ ] Consumed grill-me summary if available; no questions re-asked
- [ ] Explored repo (if exists); read relevant ADRs and identified domain vocabulary
- [ ] If separate architecture doc exists, included Service Architecture section pointing to it (no duplication)
- [ ] Presented module sketch; user confirmed modules and test coverage scope
- [ ] PRD uses project domain vocabulary throughout
- [ ] Business model section included if feature involves monetization
- [ ] User stories are small and specific with verifiable acceptance criteria
- [ ] Functional requirements grouped by MVP / Post-MVP / Future; sub-numbered (FR-16A style) for related requirements
- [ ] NFR table included with 4 columns (NFR, MVP target, architecture support, tradeoff/phase gate)
- [ ] Privacy & Data section included if feature handles personal data
- [ ] Success metrics have baseline, target, and timeframe
- [ ] Open questions have owners and deadlines, or are marked as risks
- [ ] Risks section cross-references project risk register (or uses local table if none exists)
- [ ] Phase Deliverables section included for multi-phase products; each row is verifiable at demo time
- [ ] Non-goals section defines clear boundaries
- [ ] Saved to `docs/prd.md`
