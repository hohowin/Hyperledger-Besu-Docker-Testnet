# repo-boilerplate

A starter template with a curated set of Claude Code skills and plugins pre-installed. Copy this repo as the foundation for new projects so every session starts with the right tooling already in place.

---

## Skills

Skills live in `.claude/skills/` (Claude Code) and `.agents/skills/` (agent harness) and are invoked with `/skill-name`.

### Planning & Discovery

| Skill | Invoke | Description |
|-------|--------|-------------|
| **grill-me** | `/grill-me` | Stress-tests a plan by interviewing you relentlessly until every decision branch is resolved. Run before generating any doc. |
| **prd** | `/prd` | Generates a detailed Product Requirements Document — clear, actionable, and ready for implementation. |
| **plan** | `/plan` | Generates `docs/plan.md` — phase plan, locked decisions, KPI summary, risk register, and compliance notes. |
| **architecture** | `/architecture` | Generates `docs/architecture.md` — service architecture, integration patterns, tech stack, and security model. |
| **usecase** | `/usecase` | Generates `docs/use-cases.md` — end-to-end interaction flows with Mermaid sequence diagrams for every actor. |
| **deliverables** | `/deliverables` | Generates `docs/deliverables.md` — phase-by-phase deliverables with step-by-step "how to try it" guides. |
| **design-doc-mermaid** | `/design-doc-mermaid` | Generates Mermaid diagrams (activity, deployment, sequence, architecture) from text descriptions or source code, with code-to-diagram conversion. |

> Typical flow: `/grill-me` → `/prd` → `/plan` → `/architecture` → `/usecase` → `/deliverables`

### UI & Frontend

| Skill | Invoke | Description |
|-------|--------|-------------|
| **impeccable** | `/impeccable [command] [target]` | Full-spectrum frontend design skill (v3.5.0, Apache 2.0). Covers design, redesign, audit, polish, animate, colorize, harden, optimize, and live browser iteration. Commands: `craft`, `shape`, `audit`, `critique`, `animate`, `bolder`, `colorize`, `delight`, `layout`, `overdrive`, `quieter`, `typeset`, `adapt`, `clarify`, `distill`, `harden`, `onboard`, `optimize`, `polish`, `init`, `document`, `extract`, `live`. |
| **ui-ux-pro-max** | `/ui-ux-pro-max` | UI/UX design intelligence database — 67 styles, 96 palettes, 57 font pairings, 25 chart types across 13 stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui, and more). |
| **redesign-existing-projects** | `/redesign-existing-projects` | Audits an existing site/app for generic AI patterns and upgrades it to premium quality in place, without breaking functionality. |

### Design Taste & Visual Direction

Opinionated aesthetic overlays — pick the one that matches the desired art direction; avoid stacking conflicting ones on the same build.

| Skill | Invoke | Description |
|-------|--------|-------------|
| **design-taste-frontend** | `/design-taste-frontend` | Anti-slop frontend skill (v2) for landing pages, portfolios, and redesigns — reads the brief, infers design direction, ships non-templated interfaces. |
| **design-taste-frontend-v1** | `/design-taste-frontend-v1` | Original v1 of the anti-slop taste skill, kept for projects that depend on its exact behavior. |
| **high-end-visual-design** | `/high-end-visual-design` | Agency-tier ($150k+ feel) UI/UX directive — exact fonts, spacing, shadows, card structures, and motion that make a site feel expensive; bans generic AI defaults. |
| **gpt-taste** | `/gpt-taste` | Awwwards-level design engineering: Python-driven randomization for layout variance, strict AIDA structure, editorial typography, gapless bento grids, GSAP ScrollTrigger motion. |
| **industrial-brutalist-ui** | `/industrial-brutalist-ui` | Raw mechanical interfaces fusing Swiss typographic print with military terminal aesthetics — rigid grids, extreme type contrast, analog degradation effects. |
| **minimalist-ui** | `/minimalist-ui` | Clean editorial interfaces — warm monochrome palette, typographic contrast, flat bento grids, muted pastels, no gradients or heavy shadows. |
| **stitch-design-taste** | `/stitch-design-taste` | Generates `DESIGN.md` files that encode anti-generic UI standards as semantic rules for Google Stitch screen generation. |
| **emil-design-eng** | `/emil-design-eng` | Encodes Emil Kowalski's design-engineering philosophy — UI polish, component design, and animation decisions. |

### Image Generation & Visual Assets

| Skill | Invoke | Description |
|-------|--------|-------------|
| **brandkit** | `/brandkit` | Generates premium brand-kit images — logo systems, identity decks, brand-guideline boards — across minimalist, luxury, dark-tech, and other brand styles. |
| **image-to-code** | `/image-to-code` | Generates design reference images first, analyzes them, then implements the website to match — avoids lazy under-generation and cards-in-cards UI. |
| **imagegen-frontend-web** | `/imagegen-frontend-web` | Generates one premium, conversion-aware reference image per landing-page section (never compresses multiple sections into one image). |
| **imagegen-frontend-mobile** | `/imagegen-frontend-mobile` | Generates premium, app-native mobile screen concepts and flows (iOS/Android), framed in clean phone mockups. Images only, no code. |

### Testing & QA

| Skill | Invoke | Description |
|-------|--------|-------------|
| **playwright-e2e** | `/playwright-e2e` | Playwright end-to-end testing patterns with Page Object Model, fixtures, and best practices. |
| **agent-browser** | `/agent-browser` | Fast browser automation CLI for AI agents (CDP-based) — navigate, click, fill forms, screenshot, scrape, and test web or Electron apps. |

### Tooling & Meta

| Skill | Invoke | Description |
|-------|--------|-------------|
| **q** | `/q` | Quick-loads all core project context files at the start of a session or when context needs refreshing. |
| **skills-required** | `/skills-required` | Audits installed skills against the project tech stack and suggests what's missing. |
| **skill-creator** | `/skill-creator` | Creates new skills from scratch, modifies existing ones, runs evals, benchmarks performance, and optimizes trigger descriptions. |
| **install-skill** | `/install-skill` | Installs skills from the open agent-skills ecosystem via the `skills` CLI — by exact `owner/repo@skill-name` path, GitHub URL, or keyword search. |
| **claude-api** | `/claude-api` | Builds, debugs, and optimizes Claude API / Anthropic SDK apps. Handles prompt caching, tool use, streaming, batch, and model migration. |
| **security-review** | `/security-review` | Runs a complete security review of pending changes on the current branch. |
| **pr-review** | `/pr-review` | Reviews code changes (PR URL, diff, or file path) for security, performance, correctness, and maintainability. Renamed from SnapAI's `code-review` to avoid colliding with the built-in `/code-review` skill. |
| **full-output-enforcement** | `/full-output-enforcement` | Overrides default LLM truncation behavior — enforces complete, unabridged code generation and bans placeholder patterns. |

---

## Plugins

Plugins are installed globally at user scope via `claude plugin install`. They extend Claude Code with additional slash commands and integrations.

| Plugin | Invoke | Description |
|--------|--------|-------------|
| **frontend-design** | `/frontend-design` | Generates distinctive, production-grade frontend interfaces — avoids generic AI aesthetics. For websites, landing pages, dashboards, and React/HTML components. |
| **code-simplifier** | `/simplify` | Reviews changed code for reuse, simplification, efficiency, and altitude cleanups, then applies fixes. Quality-focused; use `/code-review` for bug hunting. |
| **skill-creator** | `/skill-creator` | Plugin-level skill creation and optimization (complements the `.agents/skills/skill-creator` skill). |
| **claude-md-management** | `/revise-claude-md` · `/claude-md-improver` | Updates `CLAUDE.md` with session learnings and improves CLAUDE.md quality across projects. |
| **telegram** | — | Telegram bot integration for notifications and messaging within automation workflows. |

---

## Installed via

```bash
# Skills (project-local, via impeccable)
npx impeccable skills install

# Individual skills from the open skills ecosystem (project-local)
npx skills add owner/repo@skill-name

# Plugins (user-global)
claude plugin install frontend-design@claude-plugins-official
claude plugin install code-simplifier@claude-plugins-official
claude plugin install skill-creator@claude-plugins-official
claude plugin install claude-md-management@claude-plugins-official
claude plugin install telegram@claude-plugins-official
```

---

## Usage

1. Copy this repo as the starting point for a new project.
2. Run `/q` at the start of each session to load project context.
3. Run `/skills-required` to check if the project needs additional skills.
4. Use `/grill-me` before generating any planning or architecture document.
