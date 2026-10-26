package agent

import (
	"strings"

	"usespotlight.ai/data-plane/help"
	"usespotlight.ai/data-plane/protocol"
)

const docs = "agent-commands"

var handoverHelp = help.Command{
	Path:    "handover",
	Summary: "Pass the task to the next station, put it to a person, or close it.",
	Usage:   []string{"spotlight handover --next <station | review | done> [--note <text>]"},
	Flags: []help.Flag{
		{Name: "next", Value: "<where>", Usage: "Where the task goes. The briefing lists the choices. Required."},
		{Name: "note", Value: "<text>", Usage: "What the next station or person must know. Use - to read standard input."},
	},
	Examples: []help.Example{
		{Comment: "Pass the task on", Command: `spotlight handover --next code-review --note "Added retries to the webhook client."`},
		{Comment: "Ask a person, with a long note", Command: "spotlight handover --next review < question.md"},
		{Comment: "Close the task at this station", Command: "spotlight handover --next done"},
	},
	Notes: []string{"The run continues until your turn ends. A second handover replaces the first."},
	Docs:  docs + "#spotlight-handover",
}

var replyHelp = help.Command{
	Path:    "reply",
	Summary: "Answer a review comment on the task's pull request.",
	Usage:   []string{"spotlight reply --to <handle> [--body <text>] [--resolve]"},
	Flags: []help.Flag{
		{Name: "to", Value: "<handle>", Usage: "The comment's handle, as c12. The briefing lists them. Required."},
		{Name: "body", Value: "<text>", Usage: "The reply. Without it, the reply is read from standard input."},
		{Name: "resolve", Usage: "Resolve the thread too."},
	},
	Examples: []help.Example{
		{Command: `spotlight reply --to c12 --body "Renamed, thanks." --resolve`},
		{Command: "spotlight reply --to c14 < answer.md"},
	},
	Docs: docs + "#spotlight-reply",
}

var traceHelp = help.Command{
	Path:    "trace",
	Summary: "Write a task's trace to a JSON file, and print a summary.",
	Usage:   []string{"spotlight trace --task <id> [--out <path>]"},
	Flags: []help.Flag{
		{Name: "task", Value: "<id>", Usage: "The task. Required."},
		{Name: "out", Value: "<path>", Usage: "The file to write. Default: a new file in the temporary directory."},
	},
	Examples: []help.Example{
		{Command: "spotlight trace --task T-142"},
		{Command: "spotlight trace --task T-142 --out trace.json"},
	},
	Notes: []string{"Search the file with your own tools. Do not read it whole."},
	Docs:  docs + "#spotlight-trace",
}

var historyHelp = help.Command{
	Path:    "history",
	Summary: "Write a station's recent runs to files: configs, journals, outcomes and diffs.",
	Usage:   []string{"spotlight history --station <key> [flags]"},
	Flags: []help.Flag{
		{Name: "station", Value: "<key>", Usage: "The station. Required."},
		{Name: "line", Value: "<key>", Usage: "The line. Required if more than one line has the station."},
		{Name: "fingerprint", Value: "<fingerprint>", Usage: "Only runs of this config."},
		{Name: "outcome", Value: "<word>", Usage: "Only runs whose outcome has this word, as failed, merged or checks-failed."},
		{Name: "since", Value: "<date>", Usage: "Only runs queued on or after this date, as 2026-09-01."},
		{Name: "last", Value: "<n>", Usage: "How many runs, newest first. Default: 30. Maximum: 50."},
		{Name: "out", Value: "<dir>", Usage: "The folder to write into. Default: .spotlight/history."},
	},
	Examples: []help.Example{
		{Command: "spotlight history --station code-review"},
		{Comment: "Failed runs since September, then search them", Command: "spotlight history --station code-review --outcome failed --since 2026-09-01"},
		{Command: `grep -r "timeout" .spotlight/history/code-review`},
	},
	Notes: []string{"The folder <out>/<station> is emptied first. Its index.md lists the runs."},
	Docs:  docs + "#spotlight-history",
}

var recallHelp = help.Command{
	Path:    "recall",
	Summary: "Find the team's memories by words, or print one memory in full.",
	Usage:   []string{`spotlight recall <words>`, "spotlight recall <handle>"},
	Examples: []help.Example{
		{Command: `spotlight recall "flaky webhook tests"`},
		{Comment: "Print one memory in full", Command: "spotlight recall M-12"},
	},
	Docs: docs + "#spotlight-recall",
}

var rememberHelp = help.Command{
	Path:    "remember",
	Summary: "Propose a memory for later runs. A person approves it first.",
	Usage:   []string{"spotlight remember --kind <kind> --body <text> [flags]"},
	Flags: []help.Flag{
		{Name: "kind", Value: "<kind>", Usage: "One of rationale, rejected-approach, failure, environment, preference or correction. Required."},
		{Name: "body", Value: "<text>", Usage: "What to remember. Use - to read standard input. Required."},
		{Name: "path", Value: "<path>", Usage: "A file or folder the memory is about. Repeat for more than one."},
		{Name: "scope", Value: "<scope>", Usage: "Where it applies: team, line or station."},
		{Name: "supersedes", Value: "<handle>", Usage: "The memory this one corrects, as M-12."},
	},
	Examples: []help.Example{
		{Command: `spotlight remember --kind environment --body "Integration tests need the queue container." --path test/integration`},
		{Comment: "Correct an earlier memory", Command: `spotlight remember --kind correction --body "The retry limit is 5, not 3." --supersedes M-12`},
	},
	Docs: docs + "#spotlight-remember",
}

var candidateHelp = help.Command{
	Path:    "candidate",
	Summary: "Propose a station config for the search to replay.",
	Usage:   []string{"spotlight candidate --name <name> --hypothesis <text | @file> <station.json | ->"},
	Flags: []help.Flag{
		{Name: "name", Value: "<name>", Usage: "A slug that is unique in the search, as shorter-prompt. Required."},
		{Name: "hypothesis", Value: "<text | @file>", Usage: "What you expect the change to improve. @file reads it from a file. Required."},
	},
	Examples: []help.Example{
		{Command: "spotlight candidate --name shorter-prompt --hypothesis @hypothesis.md station.json"},
		{Command: `jq '.prompt = "…"' current.json | spotlight candidate --name new-prompt --hypothesis "Fewer missed tests." -`},
	},
	Docs: docs + "#spotlight-candidate",
}

var causeHelp = help.Command{
	Path:    "cause",
	Summary: "Record why a task in the search fails.",
	Usage:   []string{"spotlight cause --task <id> --cause <cause> --evidence <text | @file> [--suggestion <text | @file>]"},
	Flags: []help.Flag{
		{Name: "task", Value: "<id>", Usage: "The failing task. Required."},
		{Name: "cause", Value: "<cause>", Usage: "One of " + strings.Join(protocol.FailureCauses, ", ") + ". Required."},
		{Name: "evidence", Value: "<text | @file>", Usage: "What in the runs shows the cause. @file reads it from a file. Required."},
		{Name: "suggestion", Value: "<text | @file>", Usage: "What to change."},
	},
	Examples: []help.Example{
		{Command: `spotlight cause --task T-142 --cause judge --evidence @evidence.md --suggestion "Accept a skipped flaky test."`},
	},
	Docs: docs + "#spotlight-cause",
}

var toolsHelp = help.Command{
	Path:    "tools",
	Summary: "List, find, read and call the tools of this run.",
	Usage:   []string{"spotlight tools", "spotlight tools <command> [flags]"},
	Notes:   []string{"Without a command, it lists the tools. If there are many, it counts them for each integration."},
	Docs:    docs + "#spotlight-tools",
}

var toolsSearchHelp = help.Command{
	Path:    "tools search",
	Summary: "Find a tool by what it does. The best match comes first.",
	Usage:   []string{"spotlight tools search <words> [--limit <n>]"},
	Flags:   []help.Flag{{Name: "limit", Value: "<n>", Usage: "How many tools to show. Default: 10."}},
	Examples: []help.Example{
		{Command: `spotlight tools search "create issue"`},
	},
	Docs: docs + "#spotlight-tools-search",
}

var toolsDescribeHelp = help.Command{
	Path:    "tools describe",
	Summary: "Show a tool's inputs, its approval, and one call to start from.",
	Usage:   []string{"spotlight tools describe <tool>"},
	Examples: []help.Example{
		{Command: "spotlight tools describe linear.issue-create"},
	},
	Docs: docs + "#spotlight-tools-describe",
}

var toolsCallHelp = help.Command{
	Path:    "tools call",
	Summary: "Call a tool, and print its answer as JSON.",
	Usage:   []string{"spotlight tools call <tool> [--<input> <value>...]", "spotlight tools call <tool> --json <object | ->"},
	Flags: []help.Flag{
		{Name: "<input>", Value: "<value>", Usage: "One input of the tool. tools describe lists them."},
		{Name: "json", Value: "<object | ->", Usage: "All inputs as one JSON object. Use - to read standard input."},
	},
	Examples: []help.Example{
		{Command: `spotlight tools call linear.issue-create --title "Drain the queue" --team-id ENG`},
		{Command: "spotlight tools call linear.issue-create --json - < input.json"},
		{Comment: "Give one answer to the next call", Command: `id=$(spotlight tools call linear.issue-create --title "…" --team-id ENG | jq -r .id)`},
	},
	Notes: []string{
		"A flag given with --json replaces the same field in the object.",
		"spotlight tools call <tool> --help describes that tool.",
	},
	Docs: docs + "#spotlight-tools-call",
}

var Commands = []help.Command{
	handoverHelp, replyHelp, traceHelp, historyHelp, recallHelp, rememberHelp,
	candidateHelp, causeHelp, toolsHelp, toolsSearchHelp, toolsDescribeHelp, toolsCallHelp,
}
