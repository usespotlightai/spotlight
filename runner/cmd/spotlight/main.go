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

const usage = `usage:
  spotlight handover --next <where> [--note <text>]
  spotlight pull-request --title <text> [--body <text>] [--repository <name>]
  spotlight reply --to <handle> [--body <text>] [--resolve]
  spotlight trace --task <id> [--out <path>]`

func run(args []string, in io.Reader, out io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("%s", usage)
	}

	switch args[0] {
	case "handover":
		return handover(args[1:], in, out)
	case "pull-request":
		return pullRequest(args[1:], in, out)
	case "reply":
		return reply(args[1:], in, out)
	case "trace":
		return traceCmd(args[1:], out)
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

	// As with a note, an answer is prose and may be piped in.
	if *body == "" {
		piped, err := io.ReadAll(in)
		if err != nil {
			return fmt.Errorf("read the answer: %w", err)
		}
		*body = strings.TrimSpace(string(piped))
	}

	if *body == "" {
		return fmt.Errorf("--body is required\n%s", usage)
	}

	endpoint, token := os.Getenv(declare.URLVar), os.Getenv(declare.TokenVar)
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
		strings.TrimSuffix(endpoint, "/")+declare.RemarkPath, token, said,
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

func pullRequest(args []string, in io.Reader, out io.Writer) error {
	flags := flag.NewFlagSet("pull-request", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	title := flags.String("title", "", "what to call it")
	body := flags.String("body", "", "what it does, as markdown")
	repository := flags.String(
		"repository", "", "which repository, by name, where the line works several",
	)

	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%s", usage)
	}

	if strings.TrimSpace(*title) == "" {
		return fmt.Errorf("--title is required\n%s", usage)
	}

	// As with a note, the description is prose and may be piped in.
	if *body == "" {
		piped, err := io.ReadAll(in)
		if err != nil {
			return fmt.Errorf("read the description: %w", err)
		}
		*body = strings.TrimSpace(string(piped))
	}

	endpoint, token := os.Getenv(declare.URLVar), os.Getenv(declare.TokenVar)
	if endpoint == "" || token == "" {
		return fmt.Errorf("no run to open one for: spotlight runs inside a Spotlight workspace")
	}

	asked, err := json.Marshal(protocol.PullRequest{
		Title:      *title,
		Body:       *body,
		Repository: strings.TrimSpace(*repository),
	})
	if err != nil {
		return err
	}

	answered, err := post(
		strings.TrimSuffix(endpoint, "/")+declare.PullRequestPath, token, asked)
	if err != nil {
		return err
	}

	var opened protocol.Opened
	if err := json.Unmarshal([]byte(answered), &opened); err != nil {
		return fmt.Errorf("Spotlight answered with %q", answered)
	}

	fmt.Fprintf(out, "Opened %s\n", opened.URL)

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

// post carries one thing the agent said and answers with whatever Spotlight
// said back, which on a refusal is the reason.
func post(url, token string, body []byte) (string, error) {
	request, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
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

	said, _ := io.ReadAll(response.Body)

	if response.StatusCode >= 300 {
		return "", fmt.Errorf("%s", strings.TrimSpace(string(said)))
	}

	return strings.TrimSpace(string(said)), nil
}
