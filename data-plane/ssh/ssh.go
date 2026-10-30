package ssh

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/credentials"
	"usespotlight.ai/data-plane/help"
)

const stoppedExit = 130

var errStopped = errors.New("stopped")

type cli struct {
	env      func(string) string
	in       io.Reader
	out      io.Writer
	errs     io.Writer
	version  string
	binary   func() (string, error)
	system   string
	terminal func() *console.Terminal
	waitHint time.Duration
}

func Main(args []string, version string) int {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	c := cli{
		env:      os.Getenv,
		in:       os.Stdin,
		out:      os.Stdout,
		errs:     os.Stderr,
		version:  version,
		binary:   os.Executable,
		system:   runtime.GOOS,
		terminal: console.Open,
		waitHint: 10 * time.Second,
	}

	return c.main(ctx, args)
}

func (c cli) main(ctx context.Context, args []string) int {
	if len(args) == 0 {
		fmt.Fprintf(c.errs, "spotlight ssh: say which command\n%s\n", sshHelp.Synopsis())
		return 1
	}

	switch args[0] {
	case "setup":
		return c.exit(setupHelp.Path, c.setup(args[1:]))
	case "proxy":
		return c.exit(proxyHelp.Path, c.proxy(ctx, args[1:]))
	default:
		fmt.Fprintf(c.errs, "spotlight ssh: no command %q\n%s\n", "ssh "+args[0], sshHelp.Synopsis())
		return 1
	}
}

func (c cli) exit(command string, err error) int {
	switch {
	case err == nil:
		return 0
	case errors.Is(err, errStopped):
		return stoppedExit
	default:
		fmt.Fprintf(c.errs, "spotlight %s: %s\n", command, err)
		return 1
	}
}

func (c cli) parse(shown help.Command, args []string, flags func(*flag.FlagSet)) (string, []string, error) {
	set := flag.NewFlagSet(shown.Path, flag.ContinueOnError)
	set.SetOutput(io.Discard)
	given := set.String("url", "", "the Spotlight address")
	if flags != nil {
		flags(set)
	}

	var positional []string
	for {
		if err := set.Parse(args); err != nil {
			return "", nil, fmt.Errorf("%s", shown.Synopsis())
		}
		if set.NArg() == 0 {
			break
		}
		positional = append(positional, set.Arg(0))
		args = set.Args()[1:]
	}

	address, err := credentials.Choose(c.env, *given)
	if err != nil {
		return "", nil, err
	}

	return address, positional, nil
}

func loginCommand(address string) string {
	if address == credentials.DefaultAddress {
		return "spotlight login"
	}

	return "spotlight login --url " + address
}
