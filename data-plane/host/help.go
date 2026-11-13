package host

import "usespotlight.ai/data-plane/help"

const docs = "spotlight-command"

var hostHelp = help.Command{
	Path:    "host",
	Summary: "Run sandboxes for your workspace's runs and checks on this machine.",
	Usage:   []string{"spotlight host <command> [flags]"},
	Examples: []help.Example{
		{Comment: "Connect this machine and install the host as a service", Command: "spotlight host init"},
		{Command: "spotlight host status"},
		{Comment: "Open the dashboard for the host and the login", Command: "spotlight"},
	},
	Notes: []string{
		"Without a command, it prints this help. The service runs spotlight host serve.",
	},
	Docs: docs + "#spotlight-host",
}

var serveHelp = help.Command{
	Path:    "host serve",
	Summary: "Serve in the foreground until SIGINT or SIGTERM. The service runs it this way.",
	Usage:   []string{"spotlight host serve"},
	Exits: []help.Exit{
		{Code: 0, Means: "Stopped on SIGINT or SIGTERM."},
		{Code: 1, Means: "A configuration or runtime error."},
		{Code: 3, Means: "Spotlight refused the host. The service does not restart it."},
	},
	Docs: docs + "#spotlight-host-serve",
}

var initHelp = help.Command{
	Path:    "host init",
	Summary: "Connect this machine to Spotlight, and install the host as a service.",
	Usage: []string{
		"spotlight host init [--url <address>] [--token <token>] [flags]",
		"spotlight host init --trust <id> --oidc-token-file <path> [flags]",
	},
	Flags: []help.Flag{
		{Name: "url", Value: "<address>", Usage: "The Spotlight address. Default: https://app.usespotlight.ai."},
		{Name: "token", Value: "<token>", Usage: "The pool's token, from the Runners page."},
		{Name: "trust", Value: "<id>", Usage: "A runner trust. Use it in place of --token."},
		{Name: "oidc-token-file", Value: "<path>", Usage: "The file with the OIDC token that the trust exchanges."},
		{Name: "capacity", Value: "<n>", Usage: "How many sandboxes can run at the same time. Default: 5."},
		{Name: "image", Value: "<image>", Usage: "The runner image for sandboxes."},
		{Name: "name", Value: "<name>", Usage: "The host's name on the Runners page."},
		{Name: "no-service", Usage: "Save the settings, but do not install the service."},
		{Name: "yes", Usage: "Ask nothing. Use the flags, the saved settings and the defaults."},
	},
	Examples: []help.Example{
		{Comment: "Answer each question in the terminal", Command: "spotlight host init"},
		{Command: "spotlight host init --token $POOL_TOKEN --capacity 8 --yes"},
	},
	Notes: []string{"If a terminal is attached and --yes is not set, init asks for each value that no flag gives."},
	Docs:  docs + "#spotlight-host-init",
}

var statusHelp = help.Command{
	Path:     "host status",
	Summary:  "Show the service, the sandboxes in use, the settings and the checks.",
	Usage:    []string{"spotlight host status [--json]"},
	Flags:    []help.Flag{{Name: "json", Usage: "Print the status as JSON."}},
	Examples: []help.Example{{Command: "spotlight host status"}},
	Docs:     docs + "#spotlight-host-status",
}

var configHelp = help.Command{
	Path:    "host config",
	Summary: "List and change the host's settings.",
	Usage:   []string{"spotlight host config [--json]", "spotlight host config <command> [flags]"},
	Flags:   []help.Flag{{Name: "json", Usage: "Print the settings as JSON."}},
	Examples: []help.Example{
		{Command: "spotlight host config"},
		{Command: "spotlight host config set capacity=8 --now"},
	},
	Notes: []string{"Without a command, it lists the settings in the file."},
	Docs:  docs + "#spotlight-host-config",
}

var configGetHelp = help.Command{
	Path:     "host config get",
	Summary:  "Print one setting.",
	Usage:    []string{"spotlight host config get <key>"},
	Examples: []help.Example{{Command: "spotlight host config get capacity"}},
	Docs:     docs + "#spotlight-host-config",
}

var configSetHelp = help.Command{
	Path:    "host config set",
	Summary: "Change settings, and apply them to the running host.",
	Usage:   []string{"spotlight host config set <key>=<value>... [--now]", "spotlight host config set <key> --stdin [--now]"},
	Flags: []help.Flag{
		{Name: "now", Usage: "Restart at once if a setting needs a restart. Default: restart when the sandboxes finish."},
		{Name: "stdin", Usage: "Read the value of the one key from stdin, so that a secret is not in the command line."},
	},
	Examples: []help.Example{
		{Command: "spotlight host config set capacity=8"},
		{Command: "spotlight host config set image=ghcr.io/acme/runner:2 --now"},
		{Command: "spotlight host config set token --stdin < token.txt"},
	},
	Docs: docs + "#spotlight-host-config",
}

var configUnsetHelp = help.Command{
	Path:     "host config unset",
	Summary:  "Remove settings, so that their defaults apply.",
	Usage:    []string{"spotlight host config unset <key>... [--now]"},
	Flags:    []help.Flag{{Name: "now", Usage: "Restart at once if a setting needs a restart."}},
	Examples: []help.Example{{Command: "spotlight host config unset image"}},
	Docs:     docs + "#spotlight-host-config",
}

var configKeysHelp = help.Command{
	Path:    "host config keys",
	Summary: "List every key, and if it applies at once or at a restart.",
	Usage:   []string{"spotlight host config keys"},
	Docs:    docs + "#spotlight-host-config",
}

var startHelp = help.Command{
	Path:    "host start",
	Summary: "Start the service.",
	Usage:   []string{"spotlight host start"},
	Docs:    docs + "#spotlight-host-start-stop-and-restart",
}

var stopHelp = help.Command{
	Path:    "host stop",
	Summary: "Stop the service.",
	Usage:   []string{"spotlight host stop"},
	Docs:    docs + "#spotlight-host-start-stop-and-restart",
}

var reloadHelp = help.Command{
	Path:    "host reload",
	Summary: "Apply host.env, sandbox.env and egress.env without a restart.",
	Usage:   []string{"spotlight host reload"},
	Docs:    docs + "#spotlight-host-reload",
}

var restartHelp = help.Command{
	Path:    "host restart",
	Summary: "Restart the service when its running sandboxes finish.",
	Usage:   []string{"spotlight host restart [--now]"},
	Flags:   []help.Flag{{Name: "now", Usage: "Restart at once. Running sandboxes stop."}},
	Docs:    docs + "#spotlight-host-start-stop-and-restart",
}

var logsHelp = help.Command{
	Path:    "host logs",
	Summary: "Show the service's log.",
	Usage:   []string{"spotlight host logs [-f] [-n <lines>]"},
	Flags: []help.Flag{
		{Name: "f", Usage: "Follow the log. --follow is the same."},
		{Name: "n", Value: "<lines>", Usage: "How many lines to show first. Default: 100."},
	},
	Examples: []help.Example{{Command: "spotlight host logs -f"}},
	Docs:     docs + "#spotlight-host-logs",
}

var uninstallHelp = help.Command{
	Path:    "host uninstall",
	Summary: "Remove the service.",
	Usage:   []string{"spotlight host uninstall [--purge] [--yes]"},
	Flags: []help.Flag{
		{Name: "purge", Usage: "Also delete the settings and the state."},
		{Name: "yes", Usage: "Ask nothing. Without --purge, keep the settings and the state."},
	},
	Docs: docs + "#spotlight-host-uninstall",
}

var updateHelp = help.Command{
	Path:    "update",
	Summary: "Replace this binary with a release.",
	Usage:   []string{"spotlight update [<release>]"},
	Examples: []help.Example{
		{Comment: "Update to the release of the control plane", Command: "spotlight update"},
		{Command: "spotlight update 20261020-01"},
	},
	Notes: []string{"Default release: the release of the Spotlight that this computer's host serves. Without a host, name a release. A running host restarts on the new binary when its sandboxes finish."},
	Docs:  docs + "#spotlight-update",
}

var Commands = []help.Command{
	hostHelp, serveHelp, initHelp, statusHelp, configHelp, configGetHelp, configSetHelp, configUnsetHelp, configKeysHelp,
	startHelp, stopHelp, reloadHelp, restartHelp, logsHelp, uninstallHelp, updateHelp, homeHelp,
}
