package agent

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

const causeUsage = `usage:
  spotlight cause --task <task> --cause config|task|judge|check|infra --evidence <text | @file> [--suggestion <text | @file>]`

func causeCmd(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("cause", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	task := flags.String("task", "", "the failing task the cause is for")
	cause := flags.String("cause", "", "what made it fail")
	evidence := flags.String("evidence", "", "what in the runs shows it, or @file that contains it")
	suggestion := flags.String("suggestion", "", "what to change, or @file that contains it")

	if err := flags.Parse(args); err != nil || flags.NArg() > 0 {
		return fmt.Errorf("%s", causeUsage)
	}
	if strings.TrimSpace(*task) == "" {
		return fmt.Errorf("--task is required\n%s", causeUsage)
	}
	if !protocol.IsSearchCause(*cause) {
		return fmt.Errorf("--cause is one of %s\n%s", strings.Join(protocol.SearchCauses, ", "), causeUsage)
	}
	if strings.TrimSpace(*evidence) == "" {
		return fmt.Errorf("--evidence is required\n%s", causeUsage)
	}

	shown, err := textOf(*evidence, "evidence")
	if err != nil {
		return err
	}
	suggested := ""
	if strings.TrimSpace(*suggestion) != "" {
		if suggested, err = textOf(*suggestion, "suggestion"); err != nil {
			return err
		}
	}

	endpoint, token := os.Getenv(protocol.AgentAPIURLVar), os.Getenv(protocol.AgentAPITokenVar)
	if endpoint == "" || token == "" {
		return fmt.Errorf("no run to record a cause from: spotlight runs inside a Spotlight workspace")
	}

	body, err := json.Marshal(protocol.CauseRecord{
		TaskID: strings.TrimSpace(*task), Cause: *cause, Evidence: shown, Suggestion: suggested,
	})
	if err != nil {
		return err
	}

	answered, err := proposeTo(strings.TrimSuffix(endpoint, "/")+protocol.AgentAPICausePath, token, body)
	if err != nil {
		return err
	}

	var recorded protocol.RecordedCause
	if err := json.Unmarshal(answered, &recorded); err != nil || recorded.TaskID == "" {
		return fmt.Errorf("Spotlight answered with %q", strings.TrimSpace(string(answered)))
	}

	fmt.Fprintf(out, "Recorded %s as the cause for task %s, whose replay run %s failed.\n", recorded.Cause, recorded.TaskID, recorded.ReplayRunID)
	fmt.Fprintln(out, "Recording another cause for the task replaces this one.")

	return nil
}

func textOf(given, what string) (string, error) {
	file, found := strings.CutPrefix(given, "@")
	if !found {
		return strings.TrimSpace(given), nil
	}

	read, err := os.ReadFile(file)
	if err != nil {
		return "", fmt.Errorf("read the %s: %w", what, err)
	}

	text := strings.TrimSpace(string(read))
	if text == "" {
		return "", fmt.Errorf("%s contains no %s", file, what)
	}

	return text, nil
}
