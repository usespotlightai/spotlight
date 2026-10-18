package agent

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

const recallUsage = `usage:
  spotlight recall "<words>"
  spotlight recall M-12`

const rememberUsage = `usage:
  spotlight remember --kind <kind> --body "…" [--path <path>]... [--scope team|line|station] [--supersedes M-12]`

var handleShape = regexp.MustCompile(`^[Mm]-\d+$`)

var sourced = map[string]string{
	"run":     "a run",
	"person":  "notes by a person",
	"outside": "a run on input from outside the team",
}

type paths []string

func (p *paths) String() string { return strings.Join(*p, ", ") }

func (p *paths) Set(value string) error {
	*p = append(*p, value)
	return nil
}

func recall(args []string, out io.Writer) error {
	words := strings.TrimSpace(strings.Join(args, " "))
	if words == "" {
		return fmt.Errorf("say what to look for\n%s", recallUsage)
	}

	request := protocol.RecallRequest{Words: words}
	if handleShape.MatchString(words) {
		request = protocol.RecallRequest{Handle: strings.ToUpper(words)}
	}

	answered, err := memoryCall(protocol.AgentAPIRecallPath, request, "recall")
	if err != nil {
		return err
	}

	if request.Handle != "" {
		var memory protocol.RecalledMemory
		if err := json.Unmarshal([]byte(answered), &memory); err != nil {
			return fmt.Errorf("Spotlight answered with %q", answered)
		}

		fmt.Fprint(out, inFull(memory))
		return nil
	}

	var found []protocol.RecalledMemory
	if err := json.Unmarshal([]byte(answered), &found); err != nil {
		return fmt.Errorf("Spotlight answered with %q", answered)
	}

	if len(found) == 0 {
		fmt.Fprintf(out, "The team remembers nothing about %q. Try other words.\n", words)
		return nil
	}

	for at, memory := range found {
		if at > 0 {
			fmt.Fprintln(out)
		}
		fmt.Fprint(out, inBrief(memory))
	}

	return nil
}

func remember(args []string, in io.Reader, out io.Writer) error {
	flags := flag.NewFlagSet("remember", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	kind := flags.String("kind", "", "what kind of memory it is")
	body := flags.String("body", "", "what to remember")
	scope := flags.String("scope", "", "where it applies: team, line or station")
	supersedes := flags.String("supersedes", "", "the memory it corrects, like M-12")
	var about paths
	flags.Var(&about, "path", "a file or folder it is about")

	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("%s", rememberUsage)
	}
	if flags.NArg() > 0 {
		return fmt.Errorf("put everything in flags, not %q\n%s", flags.Arg(0), rememberUsage)
	}

	if strings.TrimSpace(*kind) == "" {
		return fmt.Errorf("--kind is required\n%s", rememberUsage)
	}

	memory, err := prose(*body, in)
	if err != nil {
		return fmt.Errorf("read the memory: %w", err)
	}
	if memory == "" {
		return fmt.Errorf("--body is required\n%s", rememberUsage)
	}

	absolute := make([]string, 0, len(about))
	for _, each := range about {
		resolved, err := filepath.Abs(each)
		if err != nil {
			return fmt.Errorf("find %s: %w", each, err)
		}
		absolute = append(absolute, resolved)
	}

	answered, err := memoryCall(protocol.AgentAPIRememberPath, protocol.Remembering{
		Kind:       strings.TrimSpace(*kind),
		Body:       memory,
		Scope:      strings.TrimSpace(*scope),
		Paths:      absolute,
		Supersedes: strings.TrimSpace(*supersedes),
	}, "remember")
	if err != nil {
		return err
	}

	var proposed protocol.ProposedMemory
	if err := json.Unmarshal([]byte(answered), &proposed); err != nil {
		return fmt.Errorf("Spotlight answered with %q", answered)
	}

	fmt.Fprintf(
		out,
		"Proposed %s for the %s: %s\nIt waits beside the task for a person to approve it; it goes into the team's memory only then.\n",
		strings.ReplaceAll(proposed.Kind, "-", " "), scopeOf(proposed.Scope, proposed.Repository, proposed.Paths), proposed.Body,
	)

	return nil
}

func memoryCall(path string, payload any, doing string) (string, error) {
	endpoint, token := os.Getenv(protocol.AgentAPIURLVar), os.Getenv(protocol.AgentAPITokenVar)
	if endpoint == "" || token == "" {
		return "", fmt.Errorf("no run to %s from: spotlight runs inside a Spotlight workspace", doing)
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	return post(strings.TrimSuffix(endpoint, "/")+path, token, body)
}

func inBrief(memory protocol.RecalledMemory) string {
	return fmt.Sprintf(
		"%s · %s · %s\n  %s\n  %s\n",
		memory.Handle, strings.ReplaceAll(memory.Kind, "-", " "),
		scopeOf(memory.Scope, memory.Repository, memory.Paths),
		flat(memory.Body), provenanceOf(memory),
	)
}

func inFull(memory protocol.RecalledMemory) string {
	var shown strings.Builder

	fmt.Fprintf(&shown, "%s · %s · %s\n\n%s\n\n", memory.Handle, strings.ReplaceAll(memory.Kind, "-", " "), memory.Status, memory.Body)
	fmt.Fprintf(&shown, "Applies to the %s.\n", scopeOf(memory.Scope, memory.Repository, memory.Paths))
	fmt.Fprintf(&shown, "%s.\n", provenanceOf(memory))

	if memory.Provenance != nil {
		fmt.Fprintf(&shown, "Read the whole task with: spotlight trace --task %s\n", memory.Provenance.TaskID)
	}

	if len(memory.Steps) > 0 || len(memory.Notes) > 0 {
		fmt.Fprintln(&shown, "\nIt cites:")
		for _, note := range memory.Notes {
			fmt.Fprintf(&shown, "- note %d, by a %s: %s\n", note.Position, note.By, flat(note.Text))
		}
		for _, step := range memory.Steps {
			fmt.Fprintf(&shown, "- step %d, %s: %s\n", step.Index, step.Kind, flat(step.Text))
		}
	}

	if memory.Superseded != nil {
		fmt.Fprintf(&shown, "\nIt replaced %s: %s\n", memory.Superseded.Handle, flat(memory.Superseded.Body))
	}

	if memory.Retirement != nil {
		fmt.Fprintf(&shown, "\nRetired on %s", day(memory.Retirement.At))
		if memory.Retirement.Reason != nil && *memory.Retirement.Reason != "" {
			fmt.Fprintf(&shown, ": %s", flat(*memory.Retirement.Reason))
		}
		fmt.Fprintln(&shown, ".")
	}

	if memory.Successor != nil {
		fmt.Fprintf(&shown, "It was replaced by %s: %s\n", memory.Successor.Handle, flat(memory.Successor.Body))
	}

	return shown.String()
}

func scopeOf(scope string, repository *string, about []string) string {
	where := scope
	if repository != nil && *repository != "" {
		where += ", in " + *repository
		if len(about) > 0 {
			where += " at " + strings.Join(about, ", ")
		}
	}

	return where
}

func provenanceOf(memory protocol.RecalledMemory) string {
	approved := "someone"
	if memory.ApprovedBy.Name != nil && *memory.ApprovedBy.Name != "" {
		approved = *memory.ApprovedBy.Name
	}

	if memory.Provenance == nil {
		return fmt.Sprintf("Written by %s on %s", approved, day(memory.ApprovedAt))
	}

	from, known := sourced[memory.Source]
	if !known {
		from = sourced["run"]
	}

	return fmt.Sprintf(
		"From %s on task %s, approved by %s on %s",
		from, memory.Provenance.TaskID, approved, day(memory.ApprovedAt),
	)
}

func day(at string) string {
	if len(at) >= 10 {
		return at[:10]
	}

	return at
}

func flat(text string) string {
	return strings.Join(strings.Fields(text), " ")
}
