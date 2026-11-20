package secret

import "usespotlight.ai/data-plane/help"

const docs = "spotlight-command"

var urlFlag = help.Flag{Name: "url", Value: "<address>", Usage: "The Spotlight address. Default: " + urlVar + ", else the address of your one login."}

var workspaceFlag = help.Flag{Name: "workspace", Value: "<slug>", Usage: "The workspace. Default: " + workspaceVar + ", else your one workspace."}

var env = []help.Flag{
	{Name: urlVar, Usage: "The Spotlight address, if --url is not set."},
	{Name: workspaceVar, Usage: "The workspace slug, if --workspace is not set."},
	{Name: tokenVar, Usage: "A workspace token with the secrets scope. Default: your login."},
}

var secretHelp = help.Command{
	Path:    "secret",
	Group:   true,
	Summary: "See your workspace's secrets, and set the values that Terraform does not set.",
	Usage:   []string{"spotlight secret <command> [flags]"},
	Examples: []help.Example{
		{Command: "spotlight secret list"},
		{Command: "spotlight secret set STAGING_LOGIN_PASSWORD"},
	},
	Docs: docs + "#spotlight-secret",
}

var listHelp = help.Command{
	Path:    "secret list",
	Summary: "List the workspace's secrets: the hosts each one is sent to, and where its value comes from.",
	Usage:   []string{"spotlight secret list [--workspace <slug>] [--url <address>]"},
	Flags:   []help.Flag{workspaceFlag, urlFlag},
	Env:     env,
	Examples: []help.Example{
		{Command: "spotlight secret list"},
	},
	Notes: []string{"It never shows a value. A run that needs a secret without a value fails. Start the run again after you set the value."},
	Docs:  docs + "#spotlight-secret-list",
}

var setHelp = help.Command{
	Path:    "secret set",
	Summary: "Set the value of a secret. Spotlight encrypts it and sends it only to the secret's hosts.",
	Usage:   []string{"spotlight secret set <NAME> [--workspace <slug>] [--url <address>]"},
	Flags:   []help.Flag{workspaceFlag, urlFlag},
	Env:     env,
	Examples: []help.Example{
		{Comment: "Type the value. The terminal does not show it", Command: "spotlight secret set STAGING_LOGIN_PASSWORD"},
		{Comment: "Read the value from another command", Command: "op read op://staging/login/password | spotlight secret set STAGING_LOGIN_PASSWORD"},
	},
	Exits: []help.Exit{
		{Code: 0, Means: "Spotlight stores the new value."},
		{Code: 1, Means: "Spotlight did not store the value. The error says why."},
	},
	Notes: []string{
		"The value comes from stdin, never from an argument, so it stays out of your shell history. One newline at its end is removed.",
		"Terraform defines the secret first. Spotlight refuses a value while Terraform sets it with value_wo_version.",
	},
	Docs: docs + "#spotlight-secret-set",
}

var Commands = []help.Command{secretHelp, listHelp, setHelp}
