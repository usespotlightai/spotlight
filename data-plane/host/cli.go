package host

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"syscall"
	"time"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/help"
	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/host/internal/install"
	"usespotlight.ai/data-plane/host/internal/sandbox/docker"
	"usespotlight.ai/data-plane/host/internal/serve"
)

// errReported is an error the command already told the person about.
var errReported = errors.New("reported")

func noArgs(args []string, shown help.Command, do func() error) error {
	if len(args) > 0 {
		return fmt.Errorf("%s", shown.Synopsis())
	}
	return do()
}

// parse lets flags come after the arguments, as in `config set capacity=8 --now`. Everything after `--` is an argument.
func parse(flags *flag.FlagSet, args []string) ([]string, error) {
	flags.SetOutput(io.Discard)
	var rest []string
	if at := slices.Index(args, "--"); at >= 0 {
		args, rest = args[:at], args[at+1:]
	}

	var positional []string
	for {
		if err := flags.Parse(args); err != nil {
			return nil, err
		}
		if flags.NArg() == 0 {
			return append(positional, rest...), nil
		}
		positional = append(positional, flags.Arg(0))
		args = flags.Args()[1:]
	}
}

const (
	passed  = console.Passed
	warned  = console.Warned
	failed  = console.Failed
	green   = console.Green
	yellow  = console.Yellow
	red     = console.Red
	bold    = console.Bold
	timeout = 10 * time.Second
)

func paint(color, text string) string {
	return console.Paint(os.Stdout, color, text)
}

func mark(level string) string {
	return console.Mark(os.Stdout, level)
}

func readHostID(state string) string {
	raw, err := os.ReadFile(filepath.Join(state, "host-id"))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(raw))
}

// runningSandboxes counts the runs whose sandboxes run on this host.
func runningSandboxes(ctx context.Context, cfg config.Config) (int, error) {
	id := readHostID(cfg.State)
	if id == "" {
		return 0, nil
	}
	engine, err := docker.Connect(cfg.DockerHost)
	if err != nil {
		return 0, err
	}
	runners, err := engine.Running(ctx, serve.LabelHost, id, serve.LabelRunner)
	return len(runners), err
}

// apply has a running host take changed settings: a reload when every one is live, else a restart.
func apply(out io.Writer, version string, changed []config.Setting, now bool) error {
	cfg, _ := config.Load(version)
	pid, err := config.Serving(cfg.State)
	if err != nil {
		return err
	}

	if pid == 0 {
		if _, installed := install.Installed(); installed {
			fmt.Fprintln(out, "The host is stopped. The change applies when it starts: spotlight host start")
		} else {
			fmt.Fprintln(out, "No host runs from these settings. The change applies when it starts.")
		}
		return nil
	}

	restart := now
	for _, setting := range changed {
		restart = restart || !setting.Live
	}

	if !restart {
		if err := syscall.Kill(pid, syscall.SIGHUP); err != nil {
			return fmt.Errorf("tell the host (process %d) to reload: %w", pid, err)
		}
		console.Step(out, "The running host applied the change")
		return nil
	}

	return restartHost(out, cfg, pid, now)
}

func restartHost(out io.Writer, cfg config.Config, pid int, now bool) error {
	if now {
		if _, installed := install.Installed(); installed {
			return install.Restart(out)
		}
		if err := syscall.Kill(pid, syscall.SIGTERM); err != nil {
			return fmt.Errorf("stop the host (process %d): %w", pid, err)
		}
		fmt.Fprintln(out, "Stopped the host. It is not a service, so start it again yourself: spotlight host")
		return nil
	}

	if err := syscall.Kill(pid, syscall.SIGUSR1); err != nil {
		return fmt.Errorf("tell the host (process %d) to restart: %w", pid, err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	running, err := runningSandboxes(ctx, cfg)
	switch {
	case err != nil || running == 0:
		console.Step(out, "The host restarts with the change")
	case running == 1:
		console.Step(out, "The host restarts with the change when its running sandbox finishes. To restart at once and stop it: spotlight host restart --now")
	default:
		console.Step(out, fmt.Sprintf("The host restarts with the change when its %d running sandboxes finish. To restart at once and stop them: spotlight host restart --now", running))
	}
	return nil
}
