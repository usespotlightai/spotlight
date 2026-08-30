// Command spotlight is what an agent working a run uses to talk back to
// Spotlight. It runs in the agent's own terminal, so anything it has to say is
// said where the agent will read it.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"usespotlight.ai/runner/internal/declare"
	"usespotlight.ai/runner/internal/protocol"
)

func main() {
	if err := run(os.Args[1:], os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

const usage = `usage: spotlight handover --next <where> [--note <text>]`

func run(args []string, in io.Reader, out io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("%s", usage)
	}

	switch args[0] {
	case "handover":
		return handover(args[1:], in, out)
	default:
		return fmt.Errorf("no such command %q\n%s", args[0], usage)
	}
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

	// A note is prose and often long, so it may be piped in rather than
	// fought through shell quoting.
	if *note == "" {
		piped, err := io.ReadAll(in)
		if err != nil {
			return fmt.Errorf("read the note: %w", err)
		}
		*note = strings.TrimSpace(string(piped))
	}

	endpoint, token := os.Getenv(declare.URLVar), os.Getenv(declare.TokenVar)
	if endpoint == "" || token == "" {
		return fmt.Errorf("no run to hand over: spotlight runs inside a Spotlight workspace")
	}

	said, err := say(endpoint, token, protocol.Outcome{Next: *next, Note: *note})
	if err != nil {
		return err
	}

	// "Handed over to review" reads as a station on a line that has one.
	if strings.EqualFold(said, declare.Review) {
		fmt.Fprintln(out, "Put to a person. The task waits here until someone answers.")
	} else {
		fmt.Fprintf(out, "Handed over to %s.\n", said)
	}

	return nil
}

func say(endpoint, token string, spoken protocol.Outcome) (string, error) {
	body, err := json.Marshal(spoken)
	if err != nil {
		return "", err
	}

	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", fmt.Errorf("reach Spotlight: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		said, _ := io.ReadAll(response.Body)

		return "", fmt.Errorf("%s", strings.TrimSpace(string(said)))
	}

	return spoken.Next, nil
}
