# Skills Required — Audit

**Run:** 2026-09-15 · **Project:** Hyperledger-Besu-Docker-Testnet

Reference tech stack (from `docs/architecture.md` §9 / `docs/plan.md` §3): TypeScript strict, Node 24, Express, ethers.js, SQLite (`node:sqlite`), React + Vite, Solidity + Hardhat, Docker Compose, WebSocket (`ws`), Hyperledger Besu / QBFT, Playwright E2E.

---

## Prune Table

| Skill | Installed path | Assessment | Reason |
|---|---|---|---|
| `agent-browser` | `.claude/skills/agent-browser/` | Relevant | Browser automation useful for driving/testing the Admin/Transfer/Explorer dashboard; also installed in `my-besu-net` |
| `architecture` | `.claude/skills/architecture/` | Relevant | Core grill-me workflow skill, just used to generate `docs/architecture.md` |
| `brandkit` | `.claude/skills/brandkit/` | Irrelevant | Logo/brand-kit image generation — no branding need for a personal infra PoC; not installed in `my-besu-net` |
| `deliverables` | `.claude/skills/deliverables/` | Relevant | Core grill-me workflow skill, just used |
| `design-doc-mermaid` | `.claude/skills/design-doc-mermaid/` | Relevant | Used throughout `architecture.md`/`use-cases.md` for Mermaid diagrams; also installed in `my-besu-net` |
| `design-taste-frontend` | `.claude/skills/design-taste-frontend/` | Borderline | Anti-slop landing-page/portfolio skill — this project's frontend is a functional 3-tab dashboard, not a landing page; repurposable but not a strong fit |
| `design-taste-frontend-v1` | `.claude/skills/design-taste-frontend-v1/` | Borderline | Same as above, older version kept for compatibility |
| `emil-design-eng` | `.claude/skills/emil-design-eng/` | Borderline | General UI-polish/animation philosophy — could lightly inform the dashboard but not core to this project |
| `full-output-enforcement` | `.claude/skills/full-output-enforcement/` | Relevant | General codegen-completeness skill, applicable to all implementation work here; also installed in `my-besu-net` |
| `gpt-taste` | `.claude/skills/gpt-taste/` | Irrelevant | Awwwards-level landing-page/GSAP design engineering — explicitly for marketing pages, not a technical admin dashboard |
| `grill-me` | `.claude/skills/grill-me/` | Relevant | Core workflow skill, currently in use |
| `high-end-visual-design` | `.claude/skills/high-end-visual-design/` | Irrelevant | "$150k+ agency feel" directive for marketing sites — not applicable here |
| `image-to-code` | `.claude/skills/image-to-code/` | Irrelevant | Converts design reference images into code — no design images exist or are planned |
| `imagegen-frontend-mobile` | `.claude/skills/imagegen-frontend-mobile/` | Irrelevant | Mobile app screen image generation — this project has no mobile app |
| `imagegen-frontend-web` | `.claude/skills/imagegen-frontend-web/` | Irrelevant | Landing-page reference image generation — no landing page in this project |
| `impeccable` | `.claude/skills/impeccable/` | Borderline | Full-spectrum frontend design/audit skill — general enough to lightly polish the dashboard, but not stack-specific |
| `industrial-brutalist-ui` | `.claude/skills/industrial-brutalist-ui/` | Irrelevant | Specific aesthetic overlay, not requested and not generically useful for this project |
| `minimalist-ui` | `.claude/skills/minimalist-ui/` | Irrelevant | Specific aesthetic overlay, not requested |
| `plan` | `.claude/skills/plan/` | Relevant | Core workflow skill, just used |
| `playwright-e2e` | `.claude/skills/playwright-e2e/` | Relevant | Project requires 6 Playwright specs (`plan.md` D-21); also installed in `my-besu-net` |
| `pr-review` | `.claude/skills/pr-review/` | Relevant | General code-review skill for this repo; also installed in `my-besu-net` |
| `prd` | `.claude/skills/prd/` | Relevant | Core workflow skill, just used |
| `q` | `.claude/skills/q/` | Relevant | Quick-context-load skill, general utility; also installed in `my-besu-net` |
| `redesign-existing-projects` | `.claude/skills/redesign-existing-projects/` | Irrelevant | Audits/upgrades an existing site to premium quality — this project is greenfield, not a redesign |
| `skills-required` | `.claude/skills/skills-required/` | Relevant | This skill, currently running |
| `stitch-design-taste` | `.claude/skills/stitch-design-taste/` | Irrelevant | Google Stitch-specific screen generation — no Stitch usage anywhere in this project |
| `ui-ux-pro-max` | `.claude/skills/ui-ux-pro-max/` | Borderline | Broad UI/UX design database (React/Tailwind/shadcn) — could help build the 3-tab dashboard, general utility, not stack-specific |
| `usecase` | `.claude/skills/usecase/` | Relevant | Core workflow skill, just used |

**Irrelevant — proposed for deletion (10):** `brandkit`, `gpt-taste`, `high-end-visual-design`, `image-to-code`, `imagegen-frontend-mobile`, `imagegen-frontend-web`, `industrial-brutalist-ui`, `minimalist-ui`, `redesign-existing-projects`, `stitch-design-taste`

**Borderline — flagged, not proposed for deletion (5):** `design-taste-frontend`, `design-taste-frontend-v1`, `emil-design-eng`, `impeccable`, `ui-ux-pro-max`

---

## Suggestion Table

| Priority | Skill | Why this project needs it | Install command |
|---|---|---|---|
| High | `ethereum` | Directly covers the Solidity/ethers.js/Hardhat work spanning `contracts/`, `mock-middleware/`, and `backend-api/`. Installed in `my-besu-net` (source `mindrally/skills`), not yet in this repo. | `/find-skills mindrally/skills@ethereum` |
| High | `express-production` | Directly covers the Express framework usage in both `backend-api` and `mock-middleware`. Installed in `my-besu-net` (source `bobmatnyc/claude-mpm-skills`), not yet in this repo. | `/find-skills bobmatnyc/claude-mpm-skills@express-production` |
| High | `dlt-security-review` | Reviews Solidity contracts and any code that signs/submits transactions against a DLT-specific attack taxonomy (consensus, smart-contract, P2P, key-management, economic layers) — explicitly calls out validator-count fault-tolerance math, directly relevant to this project's 4-validator QBFT decision (D-04) and its larger key-custody surface (`mock-middleware` holds every signing key). This is a project-local skill in `my-besu-net`, **not published to a public registry** — it must be copied directly rather than installed via `/find-skills`. | Copy `my-besu-net/.claude/skills/dlt-security-review/` into this repo |

No additional Medium- or Low-fit gaps identified — generic security review is already covered by the globally available `security-review` skill (distinct from `dlt-security-review`'s DLT-specific taxonomy).

---

## Summary

Audited all 28 locally installed skills against this project's confirmed tech stack (TypeScript/Node 24/Express/ethers.js/SQLite/React+Vite/Solidity+Hardhat/Docker Compose/WebSocket/Besu-QBFT/Playwright). 10 skills were flagged irrelevant (all from the visual-design/image-generation family — this project is a functional blockchain-infra dashboard, not a marketing site, and `my-besu-net` itself installs none of them), 5 were flagged borderline (general-purpose UI/design skills that are repurposable but not stack-specific), and none were deleted without explicit confirmation. 3 high-fit gaps were identified, all present in `my-besu-net` but missing here: `ethereum`, `express-production` (both installable via `/find-skills` from their original GitHub sources), and `dlt-security-review` (a project-local skill with no public registry source, requiring a direct file copy). Once those 3 are added, this repo's skill coverage will match `my-besu-net`'s domain-relevant set exactly, plus the extra workflow skills (`architecture`/`plan`/`usecase`/`deliverables`) this repo already has that `my-besu-net` does not.

## Actions Taken (2026-09-15)

- **Deleted** (user-confirmed): `brandkit`, `gpt-taste`, `high-end-visual-design`, `image-to-code`, `imagegen-frontend-mobile`, `imagegen-frontend-web`, `industrial-brutalist-ui`, `minimalist-ui`, `redesign-existing-projects`, `stitch-design-taste` — removed from `.claude/skills/` and their entries dropped from `skills-lock.json`
- **Installed** (user-confirmed): `ethereum` (via `npx skills add mindrally/skills@ethereum`), `express-production` (via `npx skills add bobmatnyc/claude-mpm-skills@express-production`) — both auto-recorded in `skills-lock.json`
- **Copied**: `dlt-security-review` from `my-besu-net/.claude/skills/dlt-security-review/` — no public registry source, so not tracked in `skills-lock.json`
- **Kept as-is**: all `Relevant` and `Borderline` skills from the Prune Table above
