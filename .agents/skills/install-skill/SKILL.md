---
name: install-skill
description: Install a skill into the current project folder using the skills CLI. Trigger this skill whenever the user wants to install, add, or get a skill — whether they say "install skill X", "add the X skill", "get me a skill for X", "find and install a skill for X", or anything similar. Also trigger when the user provides an exact skill path like "owner/repo@skill-name" or a GitHub URL pointing to a skill directory.
---

# Install Skill

Install skills from the open agent skills ecosystem into the current project folder.

## Three modes: exact path, GitHub URL, or keyword search

### Mode 1: Exact path provided

If the user gives a full skill path in the format `owner/repo@skill-name` (e.g. `anthropics/skills@pdf`), install it immediately:

```bash
npx skills add <path>
```

No need to search or confirm — just run it and report the result.

### Mode 2: GitHub URL provided

If the user gives a GitHub URL pointing to a skill directory (e.g. `https://github.com/kepano/obsidian-skills/tree/main/skills/obsidian-markdown`), derive the path and install immediately:

- Extract `owner/repo` from the URL (e.g. `kepano/obsidian-skills`)
- Extract the skill name from the last path segment (e.g. `obsidian-markdown`)
- Combine as `owner/repo@skill-name` and run:

```bash
npx skills add <owner/repo@skill-name>
```

No need to fetch or manually write files — the CLI handles everything.

### Mode 2: Keyword only

If the user gives a topic or keyword (not a full path), do the following:

**Step 1 — Search:**

```bash
npx skills find <keyword>
```

**Step 2 — Parse and present options.**

From the search output, extract the top results. Each result appears in this format:
```
owner/repo@skill-name  <N> installs
└ https://skills.sh/...
```

Present up to 4 options to the user in a clean list, showing:
- The full skill path
- Install count
- The skills.sh URL

Example presentation:
```
Found these skills for "pdf":

1. anthropics/skills@pdf — 180K installs
   https://skills.sh/anthropics/skills/pdf

2. vercel-labs/agent-skills@pdf-handler — 12K installs
   https://skills.sh/vercel-labs/agent-skills/pdf-handler

Which one would you like to install? (reply with 1, 2, or the full path)
```

**Step 3 — Install the chosen skill:**

Once the user picks an option, run:

```bash
npx skills add <chosen-path>
```

## After installing

Report back:
- What was installed and where (the local path shown in the CLI output)
- Any security assessment results from the output (Safe / alerts / risk level)
- That the skill is ready to use

## Important notes

- Always install locally (no `-g` flag) so the skill lands in the current project folder, not globally.
- If the search returns no results, tell the user and suggest they try a different keyword or browse https://skills.sh/
- If the install fails, show the error output and suggest checking the path or network connection.
- Prefer skills with higher install counts from reputable sources (`anthropics`, `vercel-labs`, `microsoft`, etc.) when helping the user choose.
