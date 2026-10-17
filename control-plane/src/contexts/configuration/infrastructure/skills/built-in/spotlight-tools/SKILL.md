---
name: spotlight-tools
description: Find, read and call the tools enabled for this run from its integrations, through `spotlight tools`. Use when the work needs something from another service, such as an issue tracker or an API the team connected.
---

## Finding a tool

Search for one by what it does, from anywhere in the workspace:

```
spotlight tools search "create issue"
```

The best match comes first, with how it is called and what it is for. Add
`--limit <n>` to see more than ten. `spotlight tools` lists every tool where
there are few of them, and names the integrations and how many tools each
offers where there are many.

## Reading one

Before calling a tool, read what it takes:

```
spotlight tools describe linear.issue-create
```

It prints what the tool does, its inputs as a TypeScript type, whether a
person has to approve it, and one call to start from. An input marked `?` can
be left out. Where the tool answered an earlier call, it also prints what it
answers with, as a type learned from those answers: a field it did not always
answer with is marked `?`, and a field it never answered with may be missing.

## Calling one

Where every input is text, a number or a switch, give each as a flag:

```
spotlight linear issue-create --title "Drain the queue" --team-id ENG
```

Where an input is an object or a list, hand the whole input over as one JSON
object instead. A large one is easier piped in:

```
spotlight linear issue-create --json '{"title": "Drain the queue", "labels": ["bug"]}'
spotlight linear issue-create --json - < input.json
```

A flag given beside `--json` takes the place of the same field in it.

## Reading what it answers

Every tool answers in JSON, so read a field out with `jq` and hand it to the
next call:

```
id=$(spotlight linear issue-create --title "…" --team-id ENG | jq -r '.id')
spotlight linear comment --issue "$id" --body "…"
```

When a tool fails, it says why on standard error and exits with a failure:
read what it says, fix the inputs, and call it again.

## Tools a person approves

Some tools cannot run until a person approves them; `describe` says so, and
why. Say what you want to do with `--intent "<what and why>"`: the person
reads it first. Using one asks the person and sends nothing. Do not try it
again with the same inputs, and do not work around it: hand over with
`--next review`, saying what you were about to do and why. You will be taken
up again with their answer, and the tool will run then.

## Tools that act as a person

Some tools act as the person who started the task. Where that person has not
connected the service, the call sends nothing, asks them in their inbox, and
says so. Stop there and end your turn: you are taken up again once they
connect.
