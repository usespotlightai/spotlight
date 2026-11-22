package agent

import (
	"bytes"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func submitter(t *testing.T, status int, body string) *[]protocol.AssistSubmission {
	t.Helper()

	server, err := serveHandover(nil, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	var received []protocol.AssistSubmission
	server.Submits(func(submitted protocol.AssistSubmission) (int, string) {
		received = append(received, submitted)
		return status, body
	})

	t.Setenv(protocol.AgentAPIURLVar, server.URL())
	t.Setenv(protocol.AgentAPITokenVar, server.Token())

	return &received
}

func TestSubmitReadsTheResultFromStdin(t *testing.T) {
	received := submitter(t, 200, `{"accepted":true}`)
	out := new(bytes.Buffer)

	err := run([]string{"submit", "-"}, strings.NewReader("\n{\"verdict\": \"pass\", \"reasons\": [\"Covered.\"]}\n"), out)
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(*received) != 1 || string((*received)[0].Result) != `{"verdict":"pass","reasons":["Covered."]}` {
		t.Errorf("submitted %+v", *received)
	}
	if out.String() != "Spotlight accepted the result.\n" {
		t.Errorf("output %q", out)
	}
}

func TestSubmitReadsTheResultFromAFile(t *testing.T) {
	received := submitter(t, 200, `{"accepted":true}`)
	result := filepath.Join(t.TempDir(), "result.json")
	if err := os.WriteFile(result, []byte(`[{"claim":"Retries","holds":true}]`), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := run([]string{"submit", result}, strings.NewReader(""), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(*received) != 1 || string((*received)[0].Result) != `[{"claim":"Retries","holds":true}]` {
		t.Errorf("submitted %+v", *received)
	}
}

func TestSubmitPrintsTheProblemsSpotlightFound(t *testing.T) {
	submitter(t, 422, `{"errors":[`+
		`{"path":"verdict","message":"must be one of pass, fail","severity":"error"},`+
		`{"path":"reasons","message":"one reason is thin","severity":"warning"}]}`)
	out := new(bytes.Buffer)

	err := run([]string{"submit", "-"}, strings.NewReader(`{"verdict":"maybe"}`), out)

	if err == nil {
		t.Fatal("a rejected result passed")
	}
	for _, want := range []string{
		"Spotlight did not accept the result:\n",
		"\nverdict: must be one of pass, fail\n",
		"\nreasons: one reason is thin (warning, not why it was rejected)\n",
		"Fix the result and submit it again.",
	} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("output %q, missing %q", err, want)
		}
	}
	if out.Len() != 0 {
		t.Errorf("printed %q as if it had been accepted", out)
	}
}

func TestSubmitTakesOneJSONValue(t *testing.T) {
	received := submitter(t, 200, `{"accepted":true}`)

	for _, input := range []string{"", "not json", `{"a":1} {"b":2}`, "null", `{"a":`} {
		if err := run([]string{"submit", "-"}, strings.NewReader(input), new(bytes.Buffer)); err == nil {
			t.Errorf("submitted %q", input)
		}
	}
	for _, args := range [][]string{{"submit"}, {"submit", "a.json", "b.json"}} {
		if err := run(args, strings.NewReader("{}"), new(bytes.Buffer)); err == nil || !strings.Contains(err.Error(), "spotlight submit") {
			t.Errorf("%v: %v", args, err)
		}
	}
	if len(*received) != 0 {
		t.Errorf("submitted %+v", *received)
	}
}

func TestSubmitCarriesWhySpotlightTakesNoResult(t *testing.T) {
	submitter(t, 422, "this run is no assist session, or Spotlight accepted its result already\n")

	err := run([]string{"submit", "-"}, strings.NewReader(`{}`), new(bytes.Buffer))

	if err == nil || err.Error() != "this run is no assist session, or Spotlight accepted its result already" {
		t.Errorf("got %v", err)
	}
}

func decider(t *testing.T, status int, body string) *[]protocol.ProposedDecision {
	t.Helper()

	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	var received []protocol.ProposedDecision
	server.Decisions(func(decision protocol.ProposedDecision) (int, string) {
		received = append(received, decision)
		return status, body
	})

	t.Setenv(protocol.AgentAPIURLVar, server.URL())
	t.Setenv(protocol.AgentAPITokenVar, server.Token())

	return &received
}

func TestDecideRecordsOneDecision(t *testing.T) {
	received := decider(t, 200, `{}`)
	dir := t.TempDir()
	why := filepath.Join(dir, "why.md")
	if err := os.WriteFile(why, []byte("The queue has no backoff,\nso a retry there floods it.\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Chdir(dir)
	out := new(bytes.Buffer)

	err := run([]string{
		"decide", "--kind", "trade-off", "--title", "Retry in the client", "--why", "@" + why,
		"--alternative", "Retry in the queue", "--alternative", "Do not retry", "--path", "api/src/client.ts",
	}, strings.NewReader(""), out)
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(*received) != 1 {
		t.Fatalf("received %+v", *received)
	}
	got := (*received)[0]
	if got.Kind != "trade-off" || got.Title != "Retry in the client" || got.Why != "The queue has no backoff,\nso a retry there floods it." ||
		!slices.Equal(got.Alternatives, []string{"Retry in the queue", "Do not retry"}) ||
		len(got.Paths) != 1 || !filepath.IsAbs(got.Paths[0]) || !strings.HasSuffix(got.Paths[0], filepath.Join("api", "src", "client.ts")) {
		t.Errorf("decided %+v", got)
	}
	if !strings.HasPrefix(out.String(), "Recorded the decision (trade-off): Retry in the client\n") {
		t.Errorf("output %q", out)
	}
}

func TestDecideTakesOnlyTheKindsSpotlightKnows(t *testing.T) {
	received := decider(t, 200, `{}`)

	for _, args := range [][]string{
		{"decide", "--kind", "hunch", "--title", "x", "--why", "x"},
		{"decide", "--title", "x", "--why", "x"},
		{"decide", "--kind", "assumption", "--why", "x"},
		{"decide", "--kind", "assumption", "--title", "x"},
		{"decide", "--kind", "assumption", "--title", "x", "--why", "x", "--alternative", " "},
		{"decide", "--kind", "assumption", "--title", "x", "--why", "x", "stray"},
		{"decide", "--kind", "assumption", "--title", "x", "--why", "x"},
	} {
		if err := run(args, strings.NewReader(""), new(bytes.Buffer)); err == nil || !strings.Contains(err.Error(), "spotlight decide") {
			t.Errorf("%v: %v", args, err)
		}
	}
	if err := run([]string{"decide", "--kind", "hunch", "--title", "x", "--why", "x"}, strings.NewReader(""), new(bytes.Buffer)); err == nil ||
		!strings.Contains(err.Error(), strings.Join(protocol.DecisionKinds, ", ")) {
		t.Errorf("the error names no kinds: %v", err)
	}
	if len(*received) != 0 {
		t.Errorf("decided %+v", *received)
	}
}

func TestDecidePrintsTheProblemsSpotlightFound(t *testing.T) {
	decider(t, 422, `{"errors":[{"path":"decisions.0.paths","message":"must name files the run changed","severity":"error"}]}`)

	err := run([]string{"decide", "--kind", "assumption", "--title", "x", "--why", "x", "--path", "x.go"}, strings.NewReader(""), new(bytes.Buffer))

	if err == nil || !strings.Contains(err.Error(), "Spotlight rejected the decision:\ndecisions.0.paths: must name files the run changed\n") {
		t.Errorf("got %v", err)
	}
}

func TestDecideCarriesWhyTheRunMayNotDecide(t *testing.T) {
	decider(t, 422, "a search may not record a decision: it studies the station's history and proposes station configs, nothing more\n")

	err := run([]string{"decide", "--kind", "assumption", "--title", "x", "--why", "x", "--path", "x.go"}, strings.NewReader(""), new(bytes.Buffer))

	if err == nil || !strings.HasPrefix(err.Error(), "a search may not record a decision") {
		t.Errorf("got %v", err)
	}
}
