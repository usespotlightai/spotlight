package agent

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

func decideCmd(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("decide", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	kind := flags.String("kind", "", "what kind of decision it is")
	title := flags.String("title", "", "the decision in a few words")
	why := flags.String("why", "", "why you decided it, or @file that contains it")
	var alternatives, about paths
	flags.Var(&alternatives, "alternative", "another way you weighed")
	flags.Var(&about, "path", "a file the decision bears on")

	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%v\n%s", err, decideHelp.Synopsis())
	}
	if flags.NArg() > 0 {
		return fmt.Errorf("put everything in flags, not %q\n%s", flags.Arg(0), decideHelp.Synopsis())
	}
	if !protocol.IsDecisionKind(strings.TrimSpace(*kind)) {
		return fmt.Errorf("--kind is one of %s\n%s", strings.Join(protocol.DecisionKinds, ", "), decideHelp.Synopsis())
	}
	if strings.TrimSpace(*title) == "" {
		return fmt.Errorf("--title is required\n%s", decideHelp.Synopsis())
	}
	if strings.TrimSpace(*why) == "" {
		return fmt.Errorf("--why is required\n%s", decideHelp.Synopsis())
	}
	if len(about) == 0 {
		return fmt.Errorf("--path is required; name each changed file the decision bears on\n%s", decideHelp.Synopsis())
	}

	reason, err := textOf(*why, "reason")
	if err != nil {
		return err
	}

	weighed := make([]string, 0, len(alternatives))
	for _, each := range alternatives {
		if strings.TrimSpace(each) == "" {
			return fmt.Errorf("--alternative is empty; say what else you weighed\n%s", decideHelp.Synopsis())
		}
		weighed = append(weighed, strings.TrimSpace(each))
	}

	absolute := make([]string, 0, len(about))
	for _, each := range about {
		resolved, err := filepath.Abs(each)
		if err != nil {
			return fmt.Errorf("find %s: %w", each, err)
		}
		absolute = append(absolute, resolved)
	}

	endpoint, token := os.Getenv(protocol.AgentAPIURLVar), os.Getenv(protocol.AgentAPITokenVar)
	if endpoint == "" || token == "" {
		return fmt.Errorf("no run to record a decision from: spotlight runs inside a Spotlight workspace")
	}

	body, err := json.Marshal(protocol.ProposedDecision{
		Kind: strings.TrimSpace(*kind), Title: strings.TrimSpace(*title), Why: reason,
		Alternatives: weighed, Paths: absolute,
	})
	if err != nil {
		return err
	}

	if _, err := checkedBy(strings.TrimSuffix(endpoint, "/")+protocol.AgentAPIDecisionPath, token, body, func(found []protocol.FieldError) string {
		return problemsOf("Spotlight rejected the decision:", found, "Fix the decision and record it again.")
	}); err != nil {
		return err
	}

	fmt.Fprintf(out, "Recorded the decision (%s): %s\n", strings.TrimSpace(*kind), strings.TrimSpace(*title))
	fmt.Fprintln(out, "Reviewers read it next to the change. Record each other decision with its own spotlight decide.")

	return nil
}
