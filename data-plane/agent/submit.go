package agent

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

func submitCmd(args []string, in io.Reader, out io.Writer) error {
	if len(args) != 1 || strings.HasPrefix(args[0], "--") {
		return fmt.Errorf("name one file that contains the result, or - to read it from stdin\n%s", submitHelp.Synopsis())
	}

	result, err := resultOf(args[0], in)
	if err != nil {
		return err
	}

	endpoint, token := os.Getenv(protocol.AgentAPIURLVar), os.Getenv(protocol.AgentAPITokenVar)
	if endpoint == "" || token == "" {
		return fmt.Errorf("no run to submit a result from: spotlight runs inside a Spotlight workspace")
	}

	body, err := json.Marshal(protocol.AssistSubmission{Result: result})
	if err != nil {
		return err
	}

	answered, err := checkedBy(strings.TrimSuffix(endpoint, "/")+protocol.AgentAPISubmitPath, token, body, func(found []protocol.FieldError) string {
		return problemsOf("Spotlight did not accept the result:", found, "Fix the result and submit it again.")
	})
	if err != nil {
		return err
	}

	var answer protocol.AssistAnswer
	if len(bytes.TrimSpace(answered)) > 0 && json.Unmarshal(answered, &answer) == nil && !answer.Accepted {
		return fmt.Errorf("Spotlight did not accept the result: it answered with %q", strings.TrimSpace(string(answered)))
	}

	fmt.Fprintln(out, "Spotlight accepted the result.")

	return nil
}

func resultOf(path string, in io.Reader) (json.RawMessage, error) {
	var read []byte
	var err error
	if path == "-" {
		read, err = io.ReadAll(in)
	} else {
		read, err = os.ReadFile(path)
	}
	if err != nil {
		return nil, fmt.Errorf("read the result: %w", err)
	}

	decoder := json.NewDecoder(bytes.NewReader(read))
	var result json.RawMessage
	if err := decoder.Decode(&result); err != nil {
		return nil, fmt.Errorf("%s contains no JSON value: %v", sourceOf(path), err)
	}
	if _, err := decoder.Token(); !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("%s contains more than one JSON value; submit one", sourceOf(path))
	}
	if string(result) == "null" {
		return nil, fmt.Errorf("%s contains null; submit the result the briefing asks for", sourceOf(path))
	}

	return result, nil
}

func sourceOf(path string) string {
	if path == "-" {
		return "standard input"
	}

	return path
}
