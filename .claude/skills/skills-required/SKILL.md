---
name: skills-required
description: Audit installed skills for tech-stack relevance and suggest missing skills. Use when the user asks to review, audit, or recommend skills for this project.
---

# Skills Required — Audit & Recommendation

Two jobs, run in order:

1. **Prune** — scan installed skills, flag ones irrelevant to this project's tech stack, ask the user to confirm deletion.
2. **Suggest** — based on the project's requirements and tech stack, recommend globally available skills not yet installed, ranked by fit.

---

## Step 0: Load Context

1. Read `PROJECT.md` — extract the confirmed tech stack table (§3), service topology (§4), and domain model (§7). This is the reference for what is relevant.
2. Read `CLAUDE.md` — note any stack defaults or hard constraints that broaden or narrow relevance.
3. Glob `.claude/skills/*/SKILL.md` — inventory every installed skill. Read the `name` and `description` frontmatter and the first 40 lines of each file to understand its purpose. Do not skip any.
4. If `docs/architecture.md` or `docs/plan.md` exist, skim their tech stack sections for additional signal (e.g. deferred services, phase-specific tools).

---

## Step 1: Prune — Identify Irrelevant Skills

For each installed skill, assess relevance against the tech stack from Step 0.

**Relevance test** — a skill is **irrelevant** if ALL of the following are true:

- Its primary purpose targets a technology, framework, or domain that this project does not use (neither now nor in any planned phase).
- Its purpose cannot be repurposed for a technology this project does use.
- Its removal would not break any other installed skill or workflow.

A skill is **borderline** if it targets a technology adjacent to the stack (e.g. a generic Node skill when the project uses Node but the skill is not specifically about the project's framework choices). Flag borderline skills separately with a note — do not propose deletion.

**Output format for this step:**

Present a table:

| Skill | Installed path | Assessment | Reason |
|-------|---------------|------------|--------|
| `skill-name` | `.claude/skills/skill-name/` | Irrelevant / Borderline / Relevant | One sentence |

After the table, for each skill marked **Irrelevant**:

> **Delete `.claude/skills/<name>/`?**
> Reason: [why it does not fit this stack]
> Reply Y to delete, N to keep, or type a note if you want to clarify.

Wait for the user's response before deleting anything. Delete only skills the user explicitly approves. After deletions, confirm what was removed.

---

## Step 2: Suggest — Identify Missing Skills

Use `/find-skills` to discover what skills are currently available in the registry. Do not rely on a hardcoded list — the available skill set changes over time as skills are added and removed.

Search the registry with queries derived from the confirmed tech stack. For each technology or concern in the stack, run a targeted search. Examples based on common concerns:

- Each framework, library, or runtime in the tech stack (e.g. search for the ORM name, the HTTP framework name, the DB name)
- Each cross-cutting concern in the project (e.g. security, observability, CI/CD, containerisation)
- Each frontend framework or UI library in use
- Each compliance or regulatory concern (e.g. audit, privacy, OWASP)

**Before scoring anything**, build the full list of already-available skills by combining two sources:

1. The local project skills — everything found in `.claude/skills/*/SKILL.md` (from Step 0).
2. The globally available skills — the full list of skills accessible in the current Claude Code session. This list is surfaced in the session context at runtime; read it directly rather than inferring it. It includes skills installed at the user level that are usable without being copied into `.claude/skills/`.

A skill is considered **already available** if it appears in either source. Skip it from suggestions entirely — it does not need to be installed.

Only surface skills that are genuinely absent from both lists. For each one, score it:

**Fit scoring** — for each skill not already installed:

- **High fit**: directly covers a technology in the confirmed tech stack (e.g. `fastify-best-practices` for a Fastify project)
- **Medium fit**: covers an adjacent concern relevant to the project phase (e.g. `security-review` for a project with CASL/PIPEDA obligations)
- **Low fit**: general utility; useful but not stack-specific

**Output format for this step:**

Present a ranked table — High fit first, then Medium, then Low:

| Priority | Skill | Why this project needs it | Install command |
|----------|-------|--------------------------|-----------------|
| High | `skill-name` | Specific reason tied to stack or phase | `/find-skills skill-name` |

After the table, ask:

> Which of these would you like to install? Reply with the skill names or "all high fit" and I'll run `/find-skills` for each.

If the user confirms, invoke `/find-skills <skill-name>` for each selected skill in sequence.

---

## Step 3: Summary

After both steps are complete, output a one-paragraph summary:

- How many skills were audited
- How many were removed (if any)
- How many new skills were suggested and installed
- What the repo's skill coverage looks like now vs the project's tech stack

If any high-fit skills were not installed, flag them as a gap the user should revisit before starting implementation.

---

## Output

After completing both steps, write the results to `docs/skills-required.md`. Overwrite the file entirely with:

1. A header block: skill name, date run, and project name (from PROJECT.md).
2. The **Prune table** from Step 1 — all installed skills with their assessment and reason.
3. The **Suggestion table** from Step 2 — all suggested skills ranked by fit, with reason and install command.
4. The **Summary paragraph** from Step 3.

Then present the suggestion table to the user in the chat and ask which skills to install.

Skill files are deleted only with explicit user confirmation per skill.
