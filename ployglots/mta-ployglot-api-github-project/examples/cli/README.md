# CLI Examples

**Status: Not delivered.**

This repo ships a library (`@mta/github-projects`), not a CLI. The active plan deliberately scopes the deliverable to "library only" — see the plan README's *Scope → Out of scope* section.

## If you need a CLI today

Compose one from the SDK in a few lines. Example wrapper:

```js
#!/usr/bin/env node
import { createClient } from '@mta/github-projects';

const [, , verb, ...rest] = process.argv;
const client = createClient({ token: process.env.GITHUB_TOKEN });

switch (verb) {
  case 'project:get': {
    const [owner, number] = rest;
    console.log(JSON.stringify(await client.projects.get({ owner, number: Number(number) }), null, 2));
    break;
  }
  case 'item:list': {
    const [projectId] = rest;
    for await (const item of client.items.list(projectId)) {
      console.log(item.id, item.content?.title ?? '(draft)');
    }
    break;
  }
  default:
    console.error('usage: gh-projects {project:get <owner> <number> | item:list <projectId>}');
    process.exit(2);
}
```

Save as `gh-projects`, `chmod +x`, drop into `$PATH`.

## If you'd like a first-class CLI in the package

Open an issue or extend the plan with a new feature: `Feature 12 — CLI surface`. The pattern from existing features applies: stories for command groups (`project`, `item`, `field`, ...), tasks per command, examples per command in this folder.
