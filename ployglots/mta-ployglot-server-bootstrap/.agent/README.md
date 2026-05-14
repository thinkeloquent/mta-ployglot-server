# `.agent/` — Root agent index generator

This directory holds a small, zero-dependency Node script that scans the repo for per-package agent instruction files and emits a **root-level getting-started index** that an LLM can read before touching code.

## What it produces

Running the scanner writes two files to the repo root:

| File            | Audience               | Contents |
| --------------- | ---------------------- | -------- |
| `.agent.md`     | LLM + humans           | A narrated index of every per-package skill: name, scope, description, triggers, and source path. |
| `.agent.json`   | Tooling / automation   | The same data as a machine-readable model. |

Both files are **generated**. Do not edit them by hand — edit the source `.md` files under each package's `.agents/` directory and regenerate.

## What it scans

For every first-level subdirectory of the repo root (e.g. `fastify_server/`, `fastapi_server/`), the scanner looks for:

- A `.agent/` or `.agents/` directory → every `*.md` inside is a skill.
- A stray `.agent.md` (or `.agents.md`) file → treated as a single skill.

Skill files are expected to start with YAML frontmatter:

```markdown
---
name: addon-author
scope: fastify_server
description: One-liner about when this skill applies.
triggers:
  - "write an addon"
  - "new bootstrap addon"
---

# Skill body goes here...
```

Fields consumed: `name`, `scope`, `description`, `triggers`. Everything else is ignored. If frontmatter is missing, the filename stem becomes `name` and the first `# heading` becomes `description`.

## Usage

```bash
# Regenerate .agent.md and .agent.json at repo root
node .agent/scan.mjs

# CI check: non-zero exit if outputs are stale
node .agent/scan.mjs --check

# Print the markdown to stdout without writing files
node .agent/scan.mjs --stdout
```

No dependencies, no build step — just Node ≥ 18.

## LLM getting-started flow

An assistant landing in this repo should:

1. Open `README.md` for layout and package roles.
2. Open `.agent.md` at the repo root (this is the generated index).
3. Match the user request against the `triggers` of each indexed skill.
4. Open the matching skill `.md` under its package for detailed guidance.

## Adding or updating a skill

1. Create or edit a `*.md` under `<package>/.agents/`.
2. Make sure the frontmatter has `name`, `scope`, `description`, and `triggers`.
3. Run `node .agent/scan.mjs`.
4. Commit the skill file **and** the regenerated `.agent.md` / `.agent.json`.
