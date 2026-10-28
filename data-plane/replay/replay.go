package replay

import (
	"errors"
	"fmt"
	"io"
	"os"
	"time"

	"usespotlight.ai/data-plane/credentials"
)

const (
	urlVar       = "SPOTLIGHT_URL"
	tokenVar     = "SPOTLIGHT_API_TOKEN"
	workspaceVar = "SPOTLIGHT_WORKSPACE"

	regressedExit = 2
)

var errRegressed = errors.New("the candidate regressed against its reference replay")

type cli struct {
	api       *api
	out       io.Writer
	in        io.Reader
	sleep     func(time.Duration)
	workspace string
}

func Main(args []string, version string) int {
	if len(args) > 0 && args[0] == "check" {
		return check(args[1:], os.Stdin, os.Stdout, os.Stderr, os.Getenv, version, time.Sleep, time.Now)
	}

	err := run(args, os.Stdin, os.Stdout, version)

	switch {
	case err == nil:
		return 0
	case errors.Is(err, errRegressed):
		fmt.Fprintln(os.Stderr, "spotlight replay:", err)
		return regressedExit
	default:
		fmt.Fprintln(os.Stderr, "spotlight replay:", err)
		return 1
	}
}

func tokenFor(env func(string) string, base string) (string, error) {
	if token := env(tokenVar); token != "" {
		return token, nil
	}

	token, err := credentials.Stored(env, base)
	if err != nil {
		return "", fmt.Errorf("read the login for %s: %w", base, err)
	}
	if token == "" {
		return "", fmt.Errorf("no credentials for %s. Run spotlight login, or set %s\n%s", base, tokenVar, replayHelp.Synopsis())
	}

	return token, nil
}

func run(args []string, in io.Reader, out io.Writer, version string) error {
	if len(args) == 0 {
		return fmt.Errorf("say which command\n%s", replayHelp.Synopsis())
	}

	base := os.Getenv(urlVar)
	if base == "" {
		return fmt.Errorf("set %s to replay\n%s", urlVar, replayHelp.Synopsis())
	}

	token, err := tokenFor(os.Getenv, base)
	if err != nil {
		return err
	}

	c := &cli{api: newAPI(base, token, version), out: out, in: in, sleep: time.Sleep, workspace: os.Getenv(workspaceVar)}
	rest := args[1:]

	switch args[0] {
	case "propose":
		return c.propose(rest)
	case "candidates":
		return c.candidates(rest)
	case "show":
		return c.show(rest)
	case "set":
		return c.set(rest)
	case "start":
		return c.start(rest)
	case "status":
		return c.status(rest)
	case "watch":
		return c.watch(rest)
	case "stop":
		return c.stop(rest)
	default:
		return fmt.Errorf("no command %q\n%s", "replay "+args[0], replayHelp.Synopsis())
	}
}
