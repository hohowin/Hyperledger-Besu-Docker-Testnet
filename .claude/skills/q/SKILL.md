# Skill: q — Quick Context Load

## Purpose
Quick-load all core project context files at the start of a session or when context needs refreshing.

## When to Trigger
- User says "q" or "@q"
- User says "load context" or "refresh context"
- User joins a new session and needs full context

## What to Do
1. Run `/clear` to reset conversation context before loading any files.
2. Read and summarize all three foundational files:
   1. [CLAUDE.md](../../../CLAUDE.md) — Operating order, thinking principles, minimum viable change, output style
   2. [PROJECT.md](../../../PROJECT.md) — Project structure, MCP servers, n8n skills, workflow methodology
   3. [PERSONA.md](../../../PERSONA.md) — Identity (小喬), tone/language, relationship dynamics, technical behavior

## Output
Brief summary of key sections from each file, focusing on:
- **CLAUDE.md:** Current operating principles
- **PROJECT.md:** MCP tools available, installed skills, n8n workflow methodology
- **PERSONA.md:** Tone guidelines, relationship dynamics, technical approach

Then ask: "Context loaded. What are we building, 主公? 😏"
