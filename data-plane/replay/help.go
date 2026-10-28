package replay

import "usespotlight.ai/data-plane/help"

const docs = "replay-command"

var credentialsEnv = []help.Flag{
	{Name: urlVar, Usage: "The Spotlight address. Required."},
	{Name: tokenVar, Usage: "A workspace token. Without it, the login from spotlight login is used."},
	{Name: workspaceVar, Usage: "The workspace slug, if the login has more than one workspace."},
}

var shared = []help.Flag{
	{Name: "json", Usage: "Print Spotlight's answer as JSON."},
	{Name: "workspace", Value: "<slug>", Usage: "The workspace, if the login has more than one."},
}

func withShared(flags ...help.Flag) []help.Flag {
	return append(flags, shared...)
}

var replayHelp = help.Command{
	Path:    "replay",
	Group:   true,
	Summary: "Replay a station's tasks under a changed config, and compare the results.",
	Usage:   []string{"spotlight replay <command> [flags]"},
	Env:     credentialsEnv,
	Examples: []help.Example{
		{Command: "spotlight replay propose --station core/delivery/build --name higher-effort station.json"},
		{Command: "spotlight replay start --station core/delivery/build --candidate higher-effort --ceiling 20"},
		{Command: "spotlight replay watch --team core <replay id>"},
	},
	Notes: []string{
		"Every command but check takes --json and --workspace <slug>.",
		"--station names a station as <team>/<line>/<station>. A candidate is named by its id or its exact name.",
		"Spotlight keeps one replay set for each station and refreshes it from the station's runs.",
	},
	Docs: docs,
}

var proposeHelp = help.Command{
	Path:    "replay propose",
	Summary: "Propose a candidate config for a station. Nothing is applied.",
	Usage:   []string{"spotlight replay propose --station <team/line/station> --name <name> <station.json | ->"},
	Flags: withShared(
		help.Flag{Name: "station", Value: "<team/line/station>", Usage: "The station. Required."},
		help.Flag{Name: "name", Value: "<name>", Usage: "The candidate's name. Required."},
	),
	Examples: []help.Example{
		{Command: `spotlight replay propose --station core/delivery/build --name "Higher effort" station.json`},
	},
	Notes: []string{"The file holds one station block as JSON, as one entry of a line's stations."},
	Docs:  docs + "#spotlight-replay-propose",
}

var candidatesHelp = help.Command{
	Path:     "replay candidates",
	Summary:  "List a station's candidates.",
	Usage:    []string{"spotlight replay candidates --station <team/line/station>"},
	Flags:    withShared(help.Flag{Name: "station", Value: "<team/line/station>", Usage: "The station. Required."}),
	Examples: []help.Example{{Command: "spotlight replay candidates --station core/delivery/build"}},
	Docs:     docs + "#spotlight-replay-candidates",
}

var showHelp = help.Command{
	Path:     "replay show",
	Summary:  "Show one candidate, and what it changes from the live config.",
	Usage:    []string{"spotlight replay show --station <team/line/station> <candidate>"},
	Flags:    withShared(help.Flag{Name: "station", Value: "<team/line/station>", Usage: "The station. Required."}),
	Examples: []help.Example{{Command: `spotlight replay show --station core/delivery/build "Higher effort"`}},
	Docs:     docs + "#spotlight-replay-show",
}

var setHelp = help.Command{
	Path:     "replay set",
	Summary:  "Show the replay set that Spotlight keeps for a station.",
	Usage:    []string{"spotlight replay set --station <team/line/station>"},
	Flags:    withShared(help.Flag{Name: "station", Value: "<team/line/station>", Usage: "The station. Required."}),
	Examples: []help.Example{{Command: "spotlight replay set --station core/delivery/build"}},
	Docs:     docs + "#spotlight-replay-set",
}

var startHelp = help.Command{
	Path:    "replay start",
	Summary: "Start a replay of a station's replay set under a candidate.",
	Usage:   []string{"spotlight replay start --station <team/line/station> --candidate <candidate | live> --ceiling <amount> [flags]"},
	Flags: withShared(
		help.Flag{Name: "station", Value: "<team/line/station>", Usage: "The station. Required."},
		help.Flag{Name: "candidate", Value: "<candidate>", Usage: "The candidate, by name or id, or live for the live config. Required."},
		help.Flag{Name: "ceiling", Value: "<amount>", Usage: "The most the replay can spend. Required."},
		help.Flag{Name: "currency", Value: "<code>", Usage: "The currency of the ceiling. Default: USD."},
		help.Flag{Name: "repeats", Value: "<n>", Usage: "How many times to replay each run, 1 to 5. Default: 1."},
	),
	Examples: []help.Example{
		{Command: `spotlight replay start --station core/delivery/build --candidate "Higher effort" --ceiling 20`},
		{Comment: "Rate each task by the share of 3 repeats that succeed", Command: "spotlight replay start --station core/delivery/build --candidate live --ceiling 60 --repeats 3"},
	},
	Notes: []string{"With --repeats above 1, each rate has a 95% interval."},
	Docs:  docs + "#spotlight-replay-start",
}

var replayExits = []help.Exit{
	{Code: 0, Means: "The candidate regressed on no task."},
	{Code: 1, Means: "A usage error, a refusal, or Spotlight is not reachable."},
	{Code: 2, Means: "The candidate regressed on a task that its reference replay did well."},
}

var statusHelp = help.Command{
	Path:     "replay status",
	Summary:  "Show a replay's progress and its results.",
	Usage:    []string{"spotlight replay status --team <key> <replay id>"},
	Flags:    withShared(help.Flag{Name: "team", Value: "<key>", Usage: "The team of the replay. Required."}),
	Examples: []help.Example{{Command: "spotlight replay status --team core <replay id>"}},
	Exits:    replayExits,
	Docs:     docs + "#spotlight-replay-status",
}

var watchHelp = help.Command{
	Path:    "replay watch",
	Summary: "Follow a replay until it ends, and show its results.",
	Usage:   []string{"spotlight replay watch --team <key> <replay id> [--every <duration>]"},
	Flags: withShared(
		help.Flag{Name: "team", Value: "<key>", Usage: "The team of the replay. Required."},
		help.Flag{Name: "every", Value: "<duration>", Usage: "How often to read the status. Default: 15s."},
	),
	Examples: []help.Example{{Command: "spotlight replay watch --team core <replay id>"}},
	Exits:    replayExits,
	Docs:     docs + "#spotlight-replay-watch",
}

var stopHelp = help.Command{
	Path:     "replay stop",
	Summary:  "Stop a replay.",
	Usage:    []string{"spotlight replay stop --team <key> <replay id>"},
	Flags:    withShared(help.Flag{Name: "team", Value: "<key>", Usage: "The team of the replay. Required."}),
	Examples: []help.Example{{Command: "spotlight replay stop --team core <replay id>"}},
	Docs:     docs + "#spotlight-replay-stop",
}

var checkHelp = help.Command{
	Path:    "replay check",
	Summary: "Check the stations that a Terraform plan changes against their replay sets.",
	Usage:   []string{"spotlight replay check <plan.json | -> [flags]"},
	Flags: []help.Flag{
		{Name: "commit", Value: "<sha>", Usage: "The commit that plans the change."},
		{Name: "pull-request", Value: "<n>", Usage: "The pull request that plans the change."},
		{Name: "repeats", Value: "<n>", Usage: "How many times to replay each run, 1 to 5. Default: 1."},
		{Name: "timeout", Value: "<duration>", Usage: "How long to wait for the checks. Default: 60m."},
		{Name: "every", Value: "<duration>", Usage: "How often to read the checks. Default: 15s."},
		{Name: "json", Usage: "Print the report as JSON."},
	},
	Env: []help.Flag{
		{Name: urlVar, Usage: "The Spotlight address. Required."},
		{Name: tokenVar, Usage: "A workspace token that can plan."},
		{Name: trustVar, Usage: "An OIDC trust. The command exchanges the CI job's OIDC token through it."},
		{Name: "SPOTLIGHT_OIDC_TOKEN", Usage: "The OIDC token to exchange. Default: a token from GitHub Actions."},
		{Name: "GITHUB_STEP_SUMMARY", Usage: "If set, the command appends a summary to this file."},
	},
	Examples: []help.Example{
		{Comment: "In CI, after terraform plan -out=plan.out", Command: "terraform show -json plan.out | spotlight replay check -"},
		{Command: "spotlight replay check plan.json --pull-request 42 --commit $GITHUB_SHA"},
		{Command: "spotlight replay check plan.json --repeats 3"},
	},
	Exits: []help.Exit{
		{Code: 0, Means: "Every station passed or is unchanged, or the plan changes no station."},
		{Code: 1, Means: "A check did not start or did not run."},
		{Code: 2, Means: "A change regressed past its threshold."},
		{Code: 3, Means: "A check is undecided, or still runs at the timeout."},
	},
	Notes: []string{
		"Each changed station is replayed on the replay set that Spotlight keeps for it.",
		"The line's replay_check sets the threshold and the ceiling.",
		"Without SPOTLIGHT_API_TOKEN or SPOTLIGHT_OIDC_TRUST, the login from spotlight login is used.",
	},
	Docs: docs + "#spotlight-replay-check",
}

var Commands = []help.Command{
	replayHelp, proposeHelp, candidatesHelp, showHelp, setHelp, startHelp, statusHelp, watchHelp, stopHelp, checkHelp,
}

func helpFor(name string) help.Command {
	for _, each := range Commands {
		if each.Path == "replay "+name {
			return each
		}
	}

	return replayHelp
}
