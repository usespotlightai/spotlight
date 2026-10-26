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

func run(args []string, in io.Reader, out io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("say which command")
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
		return toolsCmd(args[1:], in, out)
	default:
		return fmt.Errorf("no command %q", args[0])
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
		return fmt.Errorf("%v\n%s", err, handoverHelp.Synopsis())
	}

	if strings.TrimSpace(*next) == "" {
		return fmt.Errorf("--next is required\n%s", handoverHelp.Synopsis())
	}

	noted, err := prose(*note, in)
	if err != nil {
		return fmt.Errorf("read the note: %w", err)
	}
	*note = noted

	endpoint, token := os.Getenv(protocol.AgentAPIURLVar), os.Getenv(protocol.AgentAPITokenVar)
	if endpoint == "" || token == "" {
		return fmt.Errorf("no run to hand over: spotlight runs inside a Spotlight workspace")
	}

	handedTo, err := postHandover(endpoint, token, protocol.Handover{Next: *next, Note: *note})
	if err != nil {
		return err
	}

	switch {
	case strings.EqualFold(handedTo, protocol.HandoverReview):
		fmt.Fprintln(out, "Put to a person. The task waits here until someone answers.")
	case strings.EqualFold(handedTo, protocol.HandoverDone):
		fmt.Fprintln(out, "Closed at its current station.")
	default:
		fmt.Fprintf(out, "Passed to %s.\n", handedTo)
	}

	return nil
}

func reply(args []string, in io.Reader, out io.Writer) error {
	flags := flag.NewFlagSet("reply", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	to := flags.String("to", "", "which review comment, as the briefing named it")
	body := flags.String("body", "", "the reply")
	resolve := flags.Bool("resolve", false, "resolve the thread as well")

	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%v\n%s", err, replyHelp.Synopsis())
	}

	if strings.TrimSpace(*to) == "" {
		return fmt.Errorf("--to is required\n%s", replyHelp.Synopsis())
	}

	answered, err := prose(*body, in)
	if err != nil {
		return fmt.Errorf("read the reply: %w", err)
	}
	*body = answered

	if *body == "" {
		return fmt.Errorf("--body is required\n%s", replyHelp.Synopsis())
	}

	endpoint, token := os.Getenv(protocol.AgentAPIURLVar), os.Getenv(protocol.AgentAPITokenVar)
	if endpoint == "" || token == "" {
		return fmt.Errorf("no run to reply from: spotlight runs inside a Spotlight workspace")
	}

	encoded, err := json.Marshal(protocol.ReviewCommentReply{
		Handle: *to, Body: *body, Resolve: *resolve,
	})
	if err != nil {
		return fmt.Errorf("encode the reply: %w", err)
	}

	if _, err := post(
		strings.TrimSuffix(endpoint, "/")+protocol.AgentAPIReviewCommentReplyPath, token, encoded,
	); err != nil {
		return err
	}

	if *resolve {
		fmt.Fprintf(out, "Replied to %s, and resolved it.\n", *to)
	} else {
		fmt.Fprintf(out, "Replied to %s.\n", *to)
	}

	return nil
}

func postHandover(endpoint, token string, handedOver protocol.Handover) (string, error) {
	body, err := json.Marshal(handedOver)
	if err != nil {
		return "", err
	}

	if _, err := post(endpoint, token, body); err != nil {
		return "", err
	}

	return handedOver.Next, nil
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

	read, _ := io.ReadAll(response.Body)

	if response.StatusCode >= 300 {
		return "", fmt.Errorf("%s", strings.TrimSpace(string(read)))
	}

	return strings.TrimSpace(string(read)), nil
}
