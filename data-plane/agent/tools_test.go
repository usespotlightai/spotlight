package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

var commenting = protocol.ToolManifest{
	Name:        "linear.comment",
	Description: "Comment on the Linear issue this task came from.",
	Inputs: []protocol.ToolInputManifest{
		{Name: "issue", Type: "string", Defaulted: true},
		{Name: "body", Type: "string", Description: "What to say", Required: true, Piped: true},
		{Name: "notify", Type: "boolean"},
	},
}

func withTools(t *testing.T, answer string) (*channel, *map[string]any) {
	t.Helper()

	server := inARun(t)
	carried := map[string]any{}
	server.Tools([]string{"linear.comment"}, func(_ context.Context, name string, input json.RawMessage) (json.RawMessage, error) {
		if name != "linear.comment" {
			t.Errorf("reached for %q", name)
		}
		if err := json.Unmarshal(input, &carried); err != nil {
			t.Errorf("carried %s: %v", input, err)
		}
		return json.RawMessage(answer), nil
	})
	server.Manifest([]protocol.ToolManifest{
		commenting,
		{Name: "linear.close", Description: "Close the issue."},
	})

	return server, &carried
}

func TestListsTheToolsTheRunWasGiven(t *testing.T) {
	withTools(t, `{}`)
	out := new(bytes.Buffer)

	if err := run([]string{"tools"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	listed := out.String()
	for _, want := range []string{
		"spotlight linear comment [--issue <string>] --body <string> (or piped in) [--notify]",
		"Comment on the Linear issue this task came from.",
		"--body  What to say",
	} {
		if !strings.Contains(listed, want) {
			t.Errorf("listed %q, want it to say %q", listed, want)
		}
	}
	if strings.Contains(listed, "linear close") {
		t.Errorf("listed a tool the run was not given: %q", listed)
	}
}

func TestUsesAToolTypedAsTwoWords(t *testing.T) {
	_, carried := withTools(t, `{"output":"https://linear.app/acme/issue/ENG-12#comment-1"}`)
	out := new(bytes.Buffer)

	args := []string{"linear", "comment", "--body", "Fixed in the queue worker.", "--notify"}
	if err := run(args, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["body"] != "Fixed in the queue worker." || (*carried)["notify"] != true {
		t.Errorf("carried %v", *carried)
	}
	if _, left := (*carried)["issue"]; left {
		t.Errorf("carried an issue nobody gave, which the task is left to say: %v", *carried)
	}
	if strings.TrimSpace(out.String()) != "https://linear.app/acme/issue/ENG-12#comment-1" {
		t.Errorf("said %q, want the tool's output", out.String())
	}
}

func TestUsesAToolByItsFullNameWithWhatIsPipedIn(t *testing.T) {
	_, carried := withTools(t, `{"output":{"id":"c_1","url":"https://linear.app/c/1"}}`)
	out := new(bytes.Buffer)

	if err := run([]string{"linear.comment"}, strings.NewReader("Split out in 4a1c2b0.\n"), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["body"] != "Split out in 4a1c2b0." {
		t.Errorf("carried %v", *carried)
	}
	if !strings.Contains(out.String(), `"url": "https://linear.app/c/1"`) {
		t.Errorf("said %q, want the answer as indented JSON", out.String())
	}
}

func TestRefusesAFlagTheToolDoesNotTake(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"linear", "comment", "--isue", "ENG-1"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "usage: spotlight linear comment [--issue <string>]") {
		t.Fatalf("err = %v, want how the tool is typed", err)
	}
}

func TestSaysWhichToolsThereAreForOneTheRunWasNotGiven(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"linear", "close"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "This run's tools:\nspotlight linear comment") {
		t.Fatalf("err = %v, want the tools it was given", err)
	}
}

func TestRefusesAToolUseMissingWhatItRequires(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"linear", "comment", "--notify"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "--body is required") {
		t.Fatalf("err = %v, want it to ask for the body", err)
	}
}

func TestReadsAPipedInputFromStandardInputWhenNamed(t *testing.T) {
	for _, named := range []string{"/dev/stdin", "-"} {
		t.Run(named, func(t *testing.T) {
			_, carried := withTools(t, `{}`)

			args := []string{"linear", "comment", "--body", named}
			if err := run(args, strings.NewReader("From the pipe.\n"), new(bytes.Buffer)); err != nil {
				t.Fatalf("run: %v", err)
			}

			if (*carried)["body"] != "From the pipe." {
				t.Errorf("carried %v", *carried)
			}
		})
	}
}
