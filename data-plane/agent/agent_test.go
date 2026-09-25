package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func inARun(t *testing.T) *channel {
	t.Helper()

	server, err := serveHandover([]string{"spec", "review", "done"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	t.Setenv(protocol.HandoverURLVar, server.URL())
	t.Setenv(protocol.HandoverTokenVar, server.Token())

	return server
}

func TestHandsOver(t *testing.T) {
	server := inARun(t)
	out := new(bytes.Buffer)

	args := []string{"handover", "--next", "spec", "--note", "the queue drains twice"}
	if err := run(args, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	declared := server.Declared()
	if declared == nil || declared.Next != "spec" || declared.Note != "the queue drains twice" {
		t.Fatalf("got %+v", declared)
	}

	if !strings.Contains(out.String(), "spec") {
		t.Fatalf("said nothing useful: %q", out)
	}
}

func TestTakesTheNoteFromStandardInput(t *testing.T) {
	server := inARun(t)

	piped := strings.NewReader("first line\nsecond line\n")
	if err := run([]string{"handover", "--next", "review"}, piped, new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	if note := server.Declared().Note; note != "first line\nsecond line" {
		t.Fatalf("got %q", note)
	}
}

func TestReadsNoteFromStandardInputWhenNamed(t *testing.T) {
	for _, named := range []string{"/dev/stdin", "-"} {
		t.Run(named, func(t *testing.T) {
			server := inARun(t)

			piped := strings.NewReader("the real note\n")
			args := []string{"handover", "--next", "review", "--note", named}
			if err := run(args, piped, new(bytes.Buffer)); err != nil {
				t.Fatalf("run: %v", err)
			}

			if note := server.Declared().Note; note != "the real note" {
				t.Fatalf("got %q", note)
			}
		})
	}
}

func TestSaysWhatWouldHaveWorked(t *testing.T) {
	inARun(t)

	err := run([]string{"handover", "--next", "Deployment"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil {
		t.Fatal("expected a refusal")
	}

	for _, wanted := range []string{"Deployment", "spec", "review"} {
		if !strings.Contains(err.Error(), wanted) {
			t.Fatalf("refusal %q never mentions %q", err, wanted)
		}
	}
}

func TestNextIsRequired(t *testing.T) {
	inARun(t)

	err := run([]string{"handover", "--note", "orphaned"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "--next") {
		t.Fatalf("got %v", err)
	}
}

func TestOutsideARunItSaysSo(t *testing.T) {
	t.Setenv(protocol.HandoverURLVar, "")
	t.Setenv(protocol.HandoverTokenVar, "")

	err := run([]string{"handover", "--next", "spec"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "no run") {
		t.Fatalf("got %v", err)
	}
}

func TestUnknownCommandShowsUsage(t *testing.T) {
	err := run([]string{"deploy"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "handover") {
		t.Fatalf("got %v", err)
	}
}

func TestPuttingItToAPersonDoesNotSoundLikeAStation(t *testing.T) {
	inARun(t)
	out := new(bytes.Buffer)

	if err := run(
		[]string{"handover", "--next", "review", "--note", "needs a decision"},
		strings.NewReader(""),
		out,
	); err != nil {
		t.Fatalf("run: %v", err)
	}

	said := out.String()

	if !strings.Contains(said, "person") {
		t.Errorf("did not say who it went to: %q", said)
	}
	if strings.Contains(said, "Handed over") {
		t.Errorf("read as a station handover: %q", said)
	}
}

func TestClosingItWhereItStandsDoesNotSoundLikeAStation(t *testing.T) {
	server := inARun(t)
	out := new(bytes.Buffer)

	if err := run(
		[]string{"handover", "--next", "DONE", "--note", "nothing left to do"},
		strings.NewReader(""),
		out,
	); err != nil {
		t.Fatalf("run: %v", err)
	}

	if declared := server.Declared(); declared == nil || declared.Next != "done" {
		t.Fatalf("got %+v", declared)
	}

	said := out.String()

	if !strings.Contains(said, "Closed where it stands") {
		t.Errorf("did not say it was closed: %q", said)
	}
	if strings.Contains(said, "Handed over") {
		t.Errorf("read as a station handover: %q", said)
	}
}

func TestRepliesToARemark(t *testing.T) {
	var said protocol.Remark
	server, err := serveHandover([]string{"spec"}, func(_ context.Context, spoken protocol.Remark) error {
		said = spoken
		return nil
	})
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	t.Setenv(protocol.HandoverURLVar, server.URL())
	t.Setenv(protocol.HandoverTokenVar, server.Token())

	out := new(bytes.Buffer)
	args := []string{"reply", "--to", "c3", "--resolve"}

	if err := run(args, strings.NewReader("Split out in 4a1c2b0.\n"), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if said.Handle != "c3" || said.Body != "Split out in 4a1c2b0." || !said.Resolve {
		t.Fatalf("said = %+v", said)
	}
	if !strings.Contains(out.String(), "resolved") {
		t.Errorf("said %q, want that it resolved the thread", out.String())
	}
}

func TestRefusesAReplyNamingNoRemark(t *testing.T) {
	inARun(t)

	err := run([]string{"reply", "--body", "x"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "--to") {
		t.Fatalf("err = %v, want it to ask which remark", err)
	}
}

var pullRequesting = protocol.ToolManifest{
	Name:        "pull-request",
	Description: "Open a pull request for the branch this task was worked on.",
	Inputs: []protocol.ToolInputManifest{
		{Name: "title", Type: "string", Description: "What it does", Required: true},
		{Name: "body", Type: "string", Description: "The detail, as Markdown", Piped: true},
		{Name: "repository", Type: "string", Description: "Which of the line’s repositories, where it works several"},
	},
}

func openingPullRequests(t *testing.T) *map[string]any {
	t.Helper()

	server := inARun(t)
	carried := map[string]any{}
	server.Tools([]string{"pull-request"}, func(_ context.Context, name string, input json.RawMessage) (json.RawMessage, error) {
		if name != "pull-request" {
			t.Errorf("reached for %q", name)
		}
		if err := json.Unmarshal(input, &carried); err != nil {
			t.Errorf("carried %s: %v", input, err)
		}
		return json.RawMessage(`{"output":"https://github.com/acme/widgets/pull/7"}`), nil
	})
	server.Manifest([]protocol.ToolManifest{pullRequesting})

	return &carried
}

func TestOpensAPullRequestThroughItsTool(t *testing.T) {
	carried := openingPullRequests(t)

	out := new(bytes.Buffer)
	args := []string{"pull-request", "--title", "Fix the queue", "--repository", "api"}

	if err := run(args, strings.NewReader("What it does.\n"), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["title"] != "Fix the queue" || (*carried)["body"] != "What it does." || (*carried)["repository"] != "api" {
		t.Fatalf("carried = %v", *carried)
	}
	if strings.TrimSpace(out.String()) != "https://github.com/acme/widgets/pull/7" {
		t.Errorf("said %q, want where it landed", out.String())
	}
}

func TestRefusesAPullRequestWithoutATitle(t *testing.T) {
	openingPullRequests(t)

	err := run([]string{"pull-request", "--body", "What it does."}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "--title is required") {
		t.Fatalf("err = %v, want it to ask for a title", err)
	}
}

func TestSaysWhyItCouldNotLookForATool(t *testing.T) {
	down := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		http.Error(writer, "the run's tools are unavailable", http.StatusBadGateway)
	}))
	t.Cleanup(down.Close)

	t.Setenv(protocol.HandoverURLVar, down.URL)
	t.Setenv(protocol.HandoverTokenVar, "token")

	err := run([]string{"pull-request", "--title", "Fix the queue"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "the run's tools are unavailable") {
		t.Fatalf("err = %v, want why the tools could not be read", err)
	}
	if strings.Contains(err.Error(), "no such command") {
		t.Errorf("err = %v, which reads as a tool that is not there", err)
	}
}
