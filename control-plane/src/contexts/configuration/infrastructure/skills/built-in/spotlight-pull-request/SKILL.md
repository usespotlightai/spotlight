---
name: spotlight-pull-request
description: Open a pull request for the branch this task was worked on, through Spotlight. Use when the work at this station is ready for someone to review and merge.
---

## Opening a pull request

Run this, from anywhere in the workspace:

```
spotlight tools call pull-request --title "<what it does>" --body "<the detail>"
```

Spotlight opens it for the branch this task was worked on, and answers with
its address, as `{"url": "…"}`. You cannot reach the host yourself, and do
not need to: what it takes to open one never leaves Spotlight.

A long body is easier piped in, as `spotlight tools call pull-request --title "…" < body.md`.

Where the line works in several repositories, name the one the change is in
with `--repository <name>`.

One task has one pull request. Calling it again where one is already open answers
with the one that is there rather than opening another.
