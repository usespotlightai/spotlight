---
name: spotlight-review
description: Review a pull request through Spotlight, leaving comments on its lines and submitting them as one review. Use when this task reviews a pull request somebody opened.
---

## Reviewing a pull request

Leave each comment on the line it is about, from anywhere in the workspace:

```
spotlight review-comment --path "<file>" --line <line> --body "<what is wrong and what would fix it>"
```

- `--path` is the file from the root of the repository, as `git diff` names it.
- `--line` is the line in the file as the pull request leaves it. For a comment
  on several lines, `--line` is the last of them and `--start-line` the first.
- A comment on a line the pull request removes takes `--side old`, and its
  line is the one it had before.
- A body of more than one line is piped in, never quoted: `\n` inside quotes
  reaches GitHub as a backslash and an n, not a new line.

  ```
  spotlight review-comment --path "<file>" --line <line> <<'EOF'
  What is wrong.

  What would fix it.
  EOF
  ```

A comment can only sit on a line the diff shows: one the pull request changes,
or near one. A comment on any other line is folded into the review's body
instead, so say anything about the change as a whole, or about a file it does
not touch, in the body.

Comments stay pending until you submit them, all together, as one review:

```
spotlight review --verdict comment --body "<what it comes down to>"
```

Pipe a body of more than one line in the same way.

`--verdict` is `comment`, `approve` or `request-changes`. Request changes only
for something that must not be merged as it is. The review goes onto the pull
request on GitHub, and every comment shows in Spotlight beside the change it
is about.

Submit once, when you have said everything: a review submitted is on GitHub
for everyone to read, and cannot be taken back.
