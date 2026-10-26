package host

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"

	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/host/internal/install"
)

func restart(version string, args []string) error {
	flags := flag.NewFlagSet("restart", flag.ContinueOnError)
	now := flags.Bool("now", false, "")
	if rest, err := parse(flags, args); err != nil || len(rest) > 0 {
		return fmt.Errorf("%s", restartHelp.Synopsis())
	}

	cfg, err := config.Load(version)
	if err != nil {
		return fmt.Errorf("nothing restarted, because the host would not start: %w", config.Friendly(err))
	}
	pid, err := config.Serving(cfg.State)
	if err != nil {
		return err
	}
	if pid == 0 {
		return install.Start(os.Stdout)
	}

	return restartHost(os.Stdout, cfg, pid, *now)
}

func reload(version string, args []string) error {
	if len(args) > 0 {
		return fmt.Errorf("%s", reloadHelp.Synopsis())
	}

	cfg, err := config.Load(version)
	if err != nil {
		return fmt.Errorf("nothing reloaded, because %w", config.Friendly(err))
	}
	pid, err := config.Serving(cfg.State)
	if err != nil {
		return err
	}
	if pid == 0 {
		return fmt.Errorf("no host runs from %s", config.Path())
	}
	if err := syscall.Kill(pid, syscall.SIGHUP); err != nil {
		return fmt.Errorf("tell the host (process %d) to reload: %w", pid, err)
	}

	install.Step(os.Stdout, "The running host reloaded its settings, sandbox.env and egress.env")
	return nil
}

func logs(args []string) error {
	flags := flag.NewFlagSet("logs", flag.ContinueOnError)
	follow := flags.Bool("f", false, "")
	flags.BoolVar(follow, "follow", false, "")
	lines := flags.Int("n", 100, "")
	if rest, err := parse(flags, args); err != nil || len(rest) > 0 || *lines < 0 {
		return fmt.Errorf("%s", logsHelp.Synopsis())
	}

	read, err := install.Logs(*follow, *lines)
	if err != nil {
		return err
	}
	read.Stdin, read.Stdout, read.Stderr = os.Stdin, os.Stdout, os.Stderr

	var exited *exec.ExitError
	if err := read.Run(); errors.As(err, &exited) {
		return errReported
	} else if err != nil {
		return err
	}
	return nil
}

func uninstall(version string, args []string) error {
	flags := flag.NewFlagSet("uninstall", flag.ContinueOnError)
	purge := flags.Bool("purge", false, "")
	yes := flags.Bool("yes", false, "")
	if rest, err := parse(flags, args); err != nil || len(rest) > 0 {
		return fmt.Errorf("%s", uninstallHelp.Synopsis())
	}

	cfg, _ := config.Load(version)
	if _, installed := install.Installed(); installed {
		if err := install.Uninstall(os.Stdout); err != nil {
			return err
		}
	} else {
		fmt.Println("The host is not installed as a service.")
	}

	if !*purge && !*yes {
		if tty := openTerminal(); tty != nil {
			*purge = tty.confirm(fmt.Sprintf("Also delete the settings %s and the state %s?", config.Path(), cfg.State))
			tty.Close()
		}
	}
	if *purge {
		if err := os.Remove(config.Path()); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		install.Step(os.Stdout, "Deleted "+config.Path())
		if err := purgeState(cfg.State); err != nil {
			return err
		}
	} else {
		fmt.Printf("The settings stay in %s.\n", config.Path())
	}

	if binary, err := os.Executable(); err == nil {
		fmt.Printf("To remove the binary too: rm %s\n", binary)
	}
	return nil
}

// purgeState deletes only a directory a host made, so a mistaken state setting cannot take a home directory with it.
func purgeState(state string) error {
	if _, err := os.Stat(filepath.Join(state, "host-id")); err != nil {
		fmt.Printf("%s holds no host-id, so it stays.\n", state)
		return nil
	}
	if err := os.RemoveAll(state); err != nil {
		return err
	}
	install.Step(os.Stdout, "Deleted "+state)
	return nil
}
