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

var tokenHelp = help.Command{
	Path:    "token",
	Summary: "Print a token for Spotlight, as for Terraform's http backend.",
	Usage:   []string{"spotlight token [--url <address>]"},
	Flags:   []help.Flag{{Name: "url", Value: "<address>", Usage: "The Spotlight address. Default: " + urlVar + ", else " + defaultAddress + "."}},
	Env: []help.Flag{
		{Name: tokenVar, Usage: "A workspace token. Printed as it is."},
		{Name: trustVar, Usage: "An OIDC trust's id. The CI job's OIDC token is exchanged through it for a short-lived token."},
		{Name: workloadVar, Usage: "The CI job's OIDC token, outside GitHub Actions."},
		{Name: audienceVar, Usage: "The audience of the GitHub Actions OIDC token. Default: " + defaultAudience + "."},
	},
	Examples: []help.Example{
		{Comment: "Give Terraform's http backend the token", Command: "export TF_HTTP_PASSWORD=$(spotlight token)"},
	},
	Notes: []string{"Picks the first that is set: " + tokenVar + ", then " + trustVar + ", then the login from spotlight login."},
	Docs:  "spotlight-command#spotlight-token",
}

var Commands = []help.Command{loginHelp, logoutHelp, tokenHelp}
