# CLAUDE.md

## 0. Operating Order

Apply guidance in this order:

1. Direct user request
2. This file
3. `PERSONA.md` — persona, tone, and language
4. `PROJECT.md` — architecture, conventions, and commands
5. Task-specific skills, workflows, or playbooks when the request matches
6. Personal preferences when they don't conflict with higher-priority instructions

If instructions conflict, say so briefly and follow the higher-priority source.

At the start of every session, read `PERSONA.md` and `PROJECT.md` before responding.

## 1. Think Before Acting

Don't assume. Surface tradeoffs and ambiguity before proceeding.

- State assumptions when they materially affect the result.
- If multiple interpretations exist, present them instead of choosing silently.
- If something is unclear enough to risk wrong work, stop and ask.
- Treat conclusions as evidence-based. Don't invent requirements, behavior, or design detail.
- For binary files (PDFs, images, Office files): don't infer contents — ask for extracted text or quoted excerpts.

## 2. Minimum Viable Change

Do the least work that solves the problem. Touch only what the task requires.

- No features beyond the request.
- No abstractions for one-off use.
- No refactoring of unrelated content.
- No reformatting adjacent sections unless the change requires it.
- Match local style, naming, and folder conventions.
- Remove only what your own change made obsolete.

The test: every changed line traces directly to the task.

## 3. Goal-Driven Execution

Define success criteria. Verify before reporting done.

For complex tasks:
- Break into steps with clear verification per step.
- Call out dependencies and decision points that affect success.

Translate requests into checks you can prove:
- Bug fix: reproduce → change → verify.
- New endpoint: schema defined → core logic tested → endpoint tested → CLI adapter works.
- Refactor: mypy + ruff clean → pytest green → CLI and API both still behave correctly.
- Diagram: validate syntax before finalizing.

## 4. Work With This Project

Read `PROJECT.md` for project structure, conventions, and commands before making changes.

- Follow the architecture and layer boundaries defined in `PROJECT.md` — don't cross them.
- Match existing naming, formatting, and language conventions.
- Prefer updating an existing file over creating a parallel one.
- Check for a relevant skill or playbook before proceeding ad hoc.

## 5. Place Work Where It Belongs

Follow the directory layout in `PROJECT.md`. When in doubt:
- Pure logic belongs in the core/domain layer — no I/O, no side effects.
- I/O, formatting, and user interaction belong in adapter layers (CLI, API, MCP).
- Tests mirror the structure of the code they cover.

Keep drafts and scratch work separate from canonical files unless asked otherwise.

## 6. Reviews And Standards

- Prioritize concrete findings: risks, gaps, inconsistencies, missing decisions.
- Keep summaries brief unless depth is requested.
- Tie findings to the relevant risk or requirement when possible.
- If no checklist exists, say so and review against the most relevant observable expectations.
- For API changes: verify schema, endpoint behaviour, CLI adapter parity, and mypy + ruff cleanliness.

## 7. Diagram Expectations

- Use the project's preferred format unless asked otherwise.
- Clear titles, concise labels, only necessary notes.
- Validate syntax before finalizing.

## 8. Output Style

Short and direct by default. Expand only when the task is complex or the user asks.

- Prefer conclusions over explanations.
- Avoid filler.
- Act first on clear requests; ask only when the answer would materially change the work.
- After edits: one sentence on what changed and why, nothing more.

## 9. Capture Repeatable Lessons

If the same gap or correction appears more than once in a session:
- Propose the smallest change to shared guidance (this file, `PROJECT.md`, a checklist) that would prevent it next time.
- Don't leave the lesson implicit.
