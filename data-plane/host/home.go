package host

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"runtime"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/credentials"
	"usespotlight.ai/data-plane/help"
	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/ssh"
)

var homeHelp = help.Command{
	Path:    "status",
	Summary: "Show what is set up on this computer: your logins, editors, host and version.",
	Usage:   []string{"spotlight status [--json]"},
	Flags:   []help.Flag{{Name: "json", Usage: "Print JSON."}},
	Notes: []string{
		"spotlight without a command shows the same. In a terminal, it opens them in a dashboard.",
		"Run as root, it shows only the host, because the login and the editors belong to a person.",
	},
	Docs: docs + "#spotlight-status",
}

type homeLogin struct {
	Address string `json:"address"`
	User    string `json:"user,omitempty"`
}

type homeReport struct {
	Version    string      `json:"version"`
	Logins     []homeLogin `json:"logins"`
	Editors    *ssh.Setup  `json:"editors"`
	Host       *report     `json:"host"`
	HostAsRoot bool        `json:"host_as_root"`
}

// Home prints what is set up on this computer: spotlight status.
func Home(args []string, version string) int {
	flags := flag.NewFlagSet("status", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	asJSON := flags.Bool("json", false, "")
	if err := flags.Parse(args); err != nil || flags.NArg() > 0 {
		fmt.Fprintln(os.Stderr, homeHelp.Synopsis())
		return 1
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*timeout)
	defer cancel()

	home, err := inspectHome(ctx, version, true)
	if err == nil && *asJSON {
		err = json.NewEncoder(os.Stdout).Encode(home)
	} else if err == nil {
		home.print(os.Stdout)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "spotlight status:", err)
		return 1
	}
	return 0
}

// Overview prints what is set up on this computer, for spotlight without a command outside a terminal.
// It reads only this computer, so it answers at once: spotlight status also asks Spotlight and the container runtime.
func Overview(out io.Writer, version string) error {
	home, err := inspectHome(context.Background(), version, false)
	if err != nil {
		return err
	}
	home.print(out)
	return nil
}

func personal() bool {
	return os.Geteuid() != 0
}

func inspectHome(ctx context.Context, version string, reach bool) (homeReport, error) {
	home := homeReport{Version: version}
	if personal() {
		logins, err := savedLogins()
		if err != nil {
			return home, err
		}
		home.Logins = logins
		editors := ssh.Inspect(os.Getenv, runtime.GOOS)
		home.Editors = &editors
	}

	r := inspected(ctx, version, reach)
	if hostSetUp(r) {
		home.Host = &r
	} else {
		home.HostAsRoot = config.RootHost()
	}
	return home, nil
}

func hostSetUp(r report) bool {
	_, err := os.Stat(r.Config)
	return err == nil || r.Service.Installed || r.Service.Running
}

func savedLogins() ([]homeLogin, error) {
	file, err := credentials.Saved(os.Getenv)
	if err != nil {
		return nil, err
	}
	logins := []homeLogin{}
	for _, address := range file.Addresses() {
		login, _ := file.Login(address)
		logins = append(logins, homeLogin{Address: address, User: login.User})
	}
	return logins, nil
}

func (h homeReport) print(out io.Writer) {
	line := func(level, text, fix string) {
		mark := "○"
		if level != "" {
			mark = console.Mark(out, level)
		}
		fmt.Fprintf(out, "  %s %s\n", mark, text)
		if fix != "" {
			fmt.Fprintf(out, "      %s\n", fix)
		}
	}

	fmt.Fprintln(out, console.Paint(out, console.Bold, "This computer"))
	if h.Editors != nil {
		if len(h.Logins) == 0 {
			line("", "Not logged in.", "spotlight login")
		}
		for _, each := range h.Logins {
			who := ""
			if each.User != "" {
				who = " as " + each.User
			}
			line(console.Passed, "Logged in to "+each.Address+who+".", "")
		}

		if !h.Editors.Configured {
			line("", "ssh is not set up for VS Code or Cursor.", "spotlight ssh setup")
		} else {
			line(console.Passed, "ssh reaches Spotlight sandboxes.", "")
			for _, each := range h.Editors.Editors {
				if each.Ready {
					line(console.Passed, each.Message, "")
				} else {
					line(console.Warned, each.Message, "spotlight ssh setup")
				}
			}
		}
	}

	switch r := h.Host; {
	case r != nil:
		level := console.Passed
		for _, each := range r.Checks {
			if each.Level == failed {
				level = console.Failed
			}
		}
		text := "The host"
		if r.Name != "" {
			text += " " + r.Name
		}
		if url := r.setting("url"); url != "" {
			text += " for " + url
		}
		text += " is " + r.service() + "."
		if r.Sandboxes.Running != nil {
			text += fmt.Sprintf(" %d of %d sandboxes run.", *r.Sandboxes.Running, r.Sandboxes.Capacity)
		}
		line(level, text, "for its checks: spotlight host status")
	case h.HostAsRoot:
		line("", "The host on this computer belongs to root.", "to manage it: sudo spotlight")
	default:
		line("", "This computer has no host.", "to run agents here: spotlight host init")
	}

	if h.Version != "" {
		line(console.Passed, "spotlight "+h.Version+" is installed.", "")
	}
}

func (r report) setting(key string) string {
	for _, each := range r.Settings {
		if each.Key == key {
			return each.Value
		}
	}
	return ""
}
