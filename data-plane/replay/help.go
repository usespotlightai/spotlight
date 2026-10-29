package replay

import "usespotlight.ai/data-plane/help"

const docs = "replay-command"

var replayHelp = help.Command{
	Path:    "replay",
	Group:   true,
	Summary: "Check a changed station config against the station's replay set.",
	Usage:   []string{"spotlight replay <command> [flags]"},
	Examples: []help.Example{
		{Command: "terraform show -json plan.out | spotlight replay check -"},
	},
	Notes: []string{
		"Spotlight keeps one replay set for each station and refreshes it from the station's runs.",
	},
	Docs: docs,
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
	replayHelp, checkHelp,
}
