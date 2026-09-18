---
name: spotlight-handover
description: How to write the note you hand a task on with, using `spotlight handover`. Use when finishing the work at a station, or when handing a question to a person.
---

`--note` is what the next station, or the person, needs to know. Keep it short: it is read as instructions, not as a log. A long one is easier piped in, as `spotlight handover --next "…" < note.md`.

Some tools cannot run until a person approves them; their listing says so. Using one asks the person and sends nothing. Do not try it again with the same inputs, and do not work around it: hand over with `--next review`, saying what you were about to do and why. You will be taken up again with their answer, and the tool will run then.
