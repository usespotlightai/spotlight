package replay

import (
	"errors"
	"fmt"
	"io"
	"os"
	"time"

	"usespotlight.ai/data-plane/credentials"
)

const Usage = `  spotlight replay propose --station <team/line/station> --name <name> <station.json>
  spotlight replay candidates --station <team/line/station>
  spotlight replay show --station <team/line/station> <candidate name or id>
  spotlight replay sets --station <team/line/station>
  spotlight replay start --station <team/line/station> --set <name or id> --candidate <name, id or live> --ceiling <amount> [--currency USD] [--repeats 1]
  spotlight replay status --team <key> <replay id>
  spotlight replay watch --team <key> <replay id> [--every 15s]
  spotlight replay stop --team <key> <replay id>
      each takes --json and --workspace <slug>; reads SPOTLIGHT_URL and
      SPOTLIGHT_API_TOKEN, a workspace token that may plan (read is enough to
      list, show and follow), else the login from spotlight login for
      SPOTLIGHT_URL; a login in more than one workspace needs --workspace or
      SPOTLIGHT_WORKSPACE; status and watch exit 2
      when the candidate regresses on a task its reference replay did well;
      --repeats replays each run up to 5 times, so each task is rated by
      the share of its repeats that succeeded and every rate carries a 95%
      interval
` + CheckUsage

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
		return "", fmt.Errorf("no credentials for %s. Run spotlight login, or set %s\nusage:\n%s", base, tokenVar, Usage)
	}

	return token, nil
}

func run(args []string, in io.Reader, out io.Writer, version string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage:\n%s", Usage)
	}

	base := os.Getenv(urlVar)
	if base == "" {
		return fmt.Errorf("set %s to replay\nusage:\n%s", urlVar, Usage)
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
	case "sets":
		return c.sets(rest)
	case "start":
		return c.start(rest)
	case "status":
		return c.status(rest)
	case "watch":
		return c.watch(rest)
	case "stop":
		return c.stop(rest)
	default:
		return fmt.Errorf("no such replay command as %q\nusage:\n%s", args[0], Usage)
	}
}
