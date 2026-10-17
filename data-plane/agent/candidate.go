package agent

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

const candidateUsage = `usage:
  spotlight candidate --name <name> --hypothesis <text | @file> <station.json | ->`

func candidateCmd(args []string, in io.Reader, out io.Writer) error {
	flags := flag.NewFlagSet("candidate", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	name := flags.String("name", "", "tells the candidate from the search's others")
	hypothesis := flags.String("hypothesis", "", "what you expect the change to do, or @file that contains it")

	var positional []string
	for {
		if err := flags.Parse(args); err != nil {
			return fmt.Errorf("%s", candidateUsage)
		}
		if flags.NArg() == 0 {
			break
		}
		positional = append(positional, flags.Arg(0))
		args = flags.Args()[1:]
	}

	if strings.TrimSpace(*name) == "" {
		return fmt.Errorf("--name is required\n%s", candidateUsage)
	}
	if !protocol.IsCandidateName(*name) {
		return fmt.Errorf("%q cannot name a candidate: a name is a slug of lowercase letters, digits and hyphens, starting with a letter or digit, at most 63 characters\n%s", *name, candidateUsage)
	}
	if strings.TrimSpace(*hypothesis) == "" {
		return fmt.Errorf("--hypothesis is required\n%s", candidateUsage)
	}
	if len(positional) != 1 {
		return fmt.Errorf("name one file that contains the station block, or - to read it from stdin\n%s", candidateUsage)
	}

	expected, err := hypothesisOf(*hypothesis)
	if err != nil {
		return err
	}

	block, err := stationBlock(positional[0], in)
	if err != nil {
		return err
	}

	endpoint, token := os.Getenv(protocol.AgentAPIURLVar), os.Getenv(protocol.AgentAPITokenVar)
	if endpoint == "" || token == "" {
		return fmt.Errorf("no run to propose a candidate from: spotlight runs inside a Spotlight workspace")
	}

	body, err := json.Marshal(protocol.CandidateProposal{
		Name: *name, Hypothesis: expected, Station: block,
	})
	if err != nil {
		return err
	}

	answered, err := proposeTo(strings.TrimSuffix(endpoint, "/")+protocol.AgentAPICandidatePath, token, body)
	if err != nil {
		return err
	}

	var proposed protocol.ProposedCandidate
	if err := json.Unmarshal(answered, &proposed); err != nil || proposed.CandidateID == "" {
		return fmt.Errorf("Spotlight answered with %q", strings.TrimSpace(string(answered)))
	}

	fmt.Fprintf(out, "Proposed %s as candidate %s.\n", proposed.Name, proposed.CandidateID)
	fmt.Fprintf(out, "Spotlight replays it as %s; its results show in spotlight history once the replay ends.\n", proposed.ReplayID)

	return nil
}

func hypothesisOf(given string) (string, error) {
	file, found := strings.CutPrefix(given, "@")
	if !found {
		return strings.TrimSpace(given), nil
	}

	read, err := os.ReadFile(file)
	if err != nil {
		return "", fmt.Errorf("read the hypothesis: %w", err)
	}

	text := strings.TrimSpace(string(read))
	if text == "" {
		return "", fmt.Errorf("%s contains no hypothesis; say what you expect the change to do", file)
	}

	return text, nil
}

func stationBlock(path string, in io.Reader) (json.RawMessage, error) {
	if ext := strings.ToLower(filepath.Ext(path)); ext == ".tf" || ext == ".hcl" {
		return nil, fmt.Errorf("%s is HCL; give the station block as JSON, as the line resource contains a station", path)
	}

	var read []byte
	var err error
	if path == "-" {
		read, err = io.ReadAll(in)
	} else {
		read, err = os.ReadFile(path)
	}
	if err != nil {
		return nil, fmt.Errorf("read the station block: %w", err)
	}

	var block map[string]json.RawMessage
	if err := json.Unmarshal(read, &block); err != nil || block == nil {
		return nil, fmt.Errorf("%s contains no JSON object; it must contain the station block, as the line resource contains a station", path)
	}

	return bytes.TrimSpace(read), nil
}

func proposeTo(url, token string, body []byte) ([]byte, error) {
	request, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")

	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("reach Spotlight: %w", err)
	}
	defer response.Body.Close()

	read, _ := io.ReadAll(response.Body)

	if response.StatusCode < 300 {
		return read, nil
	}

	var invalid protocol.FieldErrors
	if response.StatusCode == http.StatusUnprocessableEntity &&
		json.Unmarshal(read, &invalid) == nil && protocol.HasErrors(invalid.Errors) {
		return nil, errors.New(problemsOf(invalid.Errors))
	}

	return nil, fmt.Errorf("%s", strings.TrimSpace(string(read)))
}

func problemsOf(found []protocol.FieldError) string {
	var shown strings.Builder

	shown.WriteString("Spotlight rejected the candidate:\n")
	for _, each := range found {
		fmt.Fprintf(&shown, "%s: %s", each.Path, flat(each.Message))
		if each.Severity != protocol.SeverityError {
			shown.WriteString(" (" + each.Severity + ", not why it was rejected)")
		}
		shown.WriteString("\n")
	}
	shown.WriteString("Fix the station block and propose it again.")

	return shown.String()
}
