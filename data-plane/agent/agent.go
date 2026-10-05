package agent

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

var client = &http.Client{Timeout: 2 * time.Minute}

func Main(args []string) int {
	if err := run(args, os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}

	return 0
}

const Usage = `  spotlight handover --next <where> [--note <text>]
  spotlight reply --to <handle> [--body <text>] [--resolve]
  spotlight trace --task <id> [--out <path>]
  spotlight history --station <key> [--line <key>] [--fingerprint <fp>] [--outcome <word>] [--since <date>] [--last <n>] [--out <dir>]
  spotlight recall "<words>" | M-12
  spotlight remember --kind <kind> --body "…" [--path <path>]... [--reach team|line|station] [--supersedes M-12]
  spotlight candidate --name <name> --hypothesis <text | @file> <station.json | ->
  spotlight cause --task <task> --cause config|task|judge|check|infra --evidence <text | @file> [--suggestion <text | @file>]
  spotlight tools
  spotlight <tool> [--<input> <value>...] [--json <object> | --json -]   as spotlight linear comment --body "..."`

const usage = "usage:\n" + Usage

func run(args []string, in io.Reader, out io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("%s", usage)
	}

	switch args[0] {
	case "handover":
		return handover(args[1:], in, out)
	case "reply":
		return reply(args[1:], in, out)
	case "trace":
		return traceCmd(args[1:], out)
	case "history":
		return historyCmd(args[1:], out)
	case "recall":
		return recall(args[1:], out)
	case "remember":
		return remember(args[1:], in, out)
	case "candidate":
		return candidateCmd(args[1:], in, out)
	case "cause":
		return causeCmd(args[1:], out)
	case "tools":
		return listTools(out)
	default:
		return useTool(args, in, out)
	}
}

func prose(value string, in io.Reader) (string, error) {
	if value != "" && value != "-" && value != "/dev/stdin" {
		return value, nil
	}

	piped, err := io.ReadAll(in)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(piped)), nil
}

func handover(args []string, in io.Reader, out io.Writer) error {
	flags := flag.NewFlagSet("handover", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	next := flags.String("next", "", "where the task goes now")
	note := flags.String("note", "", "what the next hands need to know")

	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%s", usage)
	}

	if strings.TrimSpace(*next) == "" {
		return fmt.Errorf("--next is required\n%s", usage)
	}

	noted, err := prose(*note, in)
	if err != nil {
		return fmt.Errorf("read the note: %w", err)
	}
	*note = noted

	endpoint, token := os.Getenv(protocol.HandoverURLVar), os.Getenv(protocol.HandoverTokenVar)
	if endpoint == "" || token == "" {
		return fmt.Errorf("no run to hand over: spotlight runs inside a Spotlight workspace")
	}

	said, err := say(endpoint, token, protocol.Outcome{Next: *next, Note: *note})
	if err != nil {
		return err
	}

	switch {
	case strings.EqualFold(said, protocol.HandoverReview):
		fmt.Fprintln(out, "Put to a person. The task waits here until someone answers.")
	case strings.EqualFold(said, protocol.HandoverDone):
		fmt.Fprintln(out, "Closed where it stands.")
	default:
		fmt.Fprintf(out, "Handed over to %s.\n", said)
	}

	return nil
}

func reply(args []string, in io.Reader, out io.Writer) error {
	flags := flag.NewFlagSet("reply", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	to := flags.String("to", "", "which remark, as the briefing named it")
	body := flags.String("body", "", "what to say back")
	resolve := flags.Bool("resolve", false, "resolve the thread as well")

	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%s", usage)
	}

	if strings.TrimSpace(*to) == "" {
		return fmt.Errorf("--to is required\n%s", usage)
	}

	answered, err := prose(*body, in)
	if err != nil {
		return fmt.Errorf("read the answer: %w", err)
	}
	*body = answered

	if *body == "" {
		return fmt.Errorf("--body is required\n%s", usage)
	}

	endpoint, token := os.Getenv(protocol.HandoverURLVar), os.Getenv(protocol.HandoverTokenVar)
	if endpoint == "" || token == "" {
		return fmt.Errorf("no run to answer for: spotlight runs inside a Spotlight workspace")
	}

	said, err := json.Marshal(protocol.Remark{
		Handle: *to, Body: *body, Resolve: *resolve,
	})
	if err != nil {
		return fmt.Errorf("say it: %w", err)
	}

	if _, err := post(
		strings.TrimSuffix(endpoint, "/")+protocol.HandoverRemarkPath, token, said,
	); err != nil {
		return err
	}

	if *resolve {
		fmt.Fprintf(out, "Answered %s, and resolved it.\n", *to)
	} else {
		fmt.Fprintf(out, "Answered %s.\n", *to)
	}

	return nil
}

func say(endpoint, token string, spoken protocol.Outcome) (string, error) {
	body, err := json.Marshal(spoken)
	if err != nil {
		return "", err
	}

	if _, err := post(endpoint, token, body); err != nil {
		return "", err
	}

	return spoken.Next, nil
}

func post(url, token string, body []byte) (string, error) {
	request, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")

	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("reach Spotlight: %w", err)
	}
	defer response.Body.Close()

	said, _ := io.ReadAll(response.Body)

	if response.StatusCode >= 300 {
		return "", fmt.Errorf("%s", strings.TrimSpace(string(said)))
	}

	return strings.TrimSpace(string(said)), nil
}
