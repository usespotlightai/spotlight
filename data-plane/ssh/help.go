package ssh

import (
	"usespotlight.ai/data-plane/credentials"
	"usespotlight.ai/data-plane/help"
)

const docs = "spotlight-command"

var urlFlag = help.Flag{Name: "url", Value: "<address>", Usage: "The Spotlight address. Default: " + credentials.URLVar + ", else " + credentials.DefaultAddress + "."}

var sshHelp = help.Command{
	Path:    "ssh",
	Group:   true,
	Summary: "Open the workspace of a task or chat in VS Code, Cursor or ssh.",
	Usage:   []string{"spotlight ssh <command> [flags]"},
	Examples: []help.Example{
		{Comment: "One time, after spotlight login", Command: "spotlight ssh setup"},
		{Comment: "Then open the workspace of a task", Command: "ssh task-<id>.<workspace>.spotlight"},
	},
	Docs: docs + "#spotlight-ssh",
}

var setupHelp = help.Command{
	Path:    "ssh setup",
	Summary: "Configure ssh to reach Spotlight sandboxes at <task-or-chat>.<workspace>.spotlight.",
	Usage:   []string{"spotlight ssh setup [--url <address>] [--print]"},
	Flags: []help.Flag{
		urlFlag,
		{Name: "print", Usage: "Show the configuration. Write nothing."},
	},
	Env: []help.Flag{{Name: credentials.URLVar, Usage: "The Spotlight address, if --url is not set."}},
	Examples: []help.Example{
		{Command: "spotlight ssh setup"},
		{Comment: "Show the configuration first", Command: "spotlight ssh setup --print"},
	},
	Notes: []string{
		"Writes " + managedShown + " with a Host *.spotlight block, and adds Include " + managedShown + " to the top of ~/.ssh/config. Other lines in ~/.ssh/config do not change.",
		"Run it again after you move the spotlight binary. It changes nothing when the configuration is current.",
	},
	Docs: docs + "#spotlight-ssh-setup",
}

var proxyHelp = help.Command{
	Path:    "ssh proxy",
	Summary: "Connect stdin and stdout to the SSH server of a sandbox. ssh runs it as the ProxyCommand.",
	Usage:   []string{"spotlight ssh proxy [--url <address>] <task-or-chat>.<workspace>.spotlight"},
	Flags:   []help.Flag{urlFlag},
	Env:     []help.Flag{{Name: credentials.URLVar, Usage: "The Spotlight address, if --url is not set."}},
	Examples: []help.Example{
		{Command: "spotlight ssh proxy task-0d6c1f9e-1b7e-4c55-9a51-1f0f6b8d2c3a.acme.spotlight"},
	},
	Notes: []string{
		"Uses the login from spotlight login. If the sandbox is not running, Spotlight starts it, and the command waits until it is ready.",
		"Writes one line to stderr if the connection fails.",
	},
	Exits: []help.Exit{
		{Code: 0, Means: "The connection closed normally."},
		{Code: 1, Means: "Spotlight refused the connection, or it closed with an error."},
		{Code: 130, Means: "Stopped on SIGINT or SIGTERM."},
	},
	Docs: docs + "#spotlight-ssh-proxy",
}

var Commands = []help.Command{sshHelp, setupHelp, proxyHelp}
