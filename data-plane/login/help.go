package login

import "usespotlight.ai/data-plane/help"

var loginHelp = help.Command{
	Path:    "login",
	Summary: "Log in to Spotlight in the browser.",
	Usage:   []string{"spotlight login [--url <address>] [--no-browser]"},
	Flags: []help.Flag{
		{Name: "url", Value: "<address>", Usage: "The Spotlight address. Default: " + urlVar + ", else " + defaultAddress + "."},
		{Name: "no-browser", Usage: "Do not open the browser."},
	},
	Env: []help.Flag{
		{Name: urlVar, Usage: "The Spotlight address, if --url is not set."},
		{Name: "SPOTLIGHT_CONFIG_DIR", Usage: "The folder for credentials.json. Default: $XDG_CONFIG_HOME/spotlight, else ~/.config/spotlight."},
	},
	Examples: []help.Example{
		{Command: "spotlight login"},
		{Comment: "On a machine without a browser", Command: "spotlight login --no-browser"},
	},
	Notes: []string{"The CLI and the Terraform provider then act as you."},
	Docs:  "spotlight-command#spotlight-login",
}

var logoutHelp = help.Command{
	Path:     "logout",
	Summary:  "End the session, and remove the login for the address.",
	Usage:    []string{"spotlight logout [--url <address>]"},
	Flags:    []help.Flag{{Name: "url", Value: "<address>", Usage: "The Spotlight address. Default: " + urlVar + ", else " + defaultAddress + "."}},
	Examples: []help.Example{{Command: "spotlight logout"}},
	Docs:     "spotlight-command#spotlight-logout",
}

var Commands = []help.Command{loginHelp, logoutHelp}
