package agent

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func proposer(t *testing.T, status int, body string) *[]protocol.CandidateProposal {
	t.Helper()

	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	var received []protocol.CandidateProposal
	server.Candidates(func(proposal protocol.CandidateProposal) (int, string) {
		received = append(received, proposal)
		return status, body
	})

	t.Setenv(protocol.AgentAPIURLVar, server.URL())
	t.Setenv(protocol.AgentAPITokenVar, server.Token())

	return &received
}

const proposedTerse = `{"candidateId":"cand_1","name":"terse","replayId":"replay_1"}`

func TestCandidateReadsTheStationBlockFromStdin(t *testing.T) {
	received := proposer(t, 200, proposedTerse)
	out := new(bytes.Buffer)

	err := run([]string{
		"candidate", "--name", "terse", "--hypothesis", "Shorter prompts finish sooner.", "-",
	}, strings.NewReader("\n{\"prompt\": \"Be brief.\", \"effort\": \"low\"}\n"), out)
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(*received) != 1 {
		t.Fatalf("received %+v", *received)
	}
	got := (*received)[0]
	if got.Name != "terse" || got.Hypothesis != "Shorter prompts finish sooner." ||
		string(got.Station) != `{"prompt":"Be brief.","effort":"low"}` {
		t.Errorf("proposed %+v (station %s)", got, got.Station)
	}
	for _, want := range []string{"Proposed terse as candidate cand_1.", "replays it as replay_1"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("output %q, missing %q", out, want)
		}
	}
}

func TestCandidateReadsTheBlockAndTheHypothesisFromFiles(t *testing.T) {
	received := proposer(t, 201, proposedTerse)
	dir := t.TempDir()
	block := filepath.Join(dir, "station.json")
	hypothesis := filepath.Join(dir, "hypothesis.md")
	if err := os.WriteFile(block, []byte(`{"model":"sonnet"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(hypothesis, []byte("A smaller model is enough\nfor this station.\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	err := run([]string{"candidate", block, "--name", "sonnet", "--hypothesis", "@" + hypothesis},
		strings.NewReader(""), new(bytes.Buffer))
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(*received) != 1 || (*received)[0].Hypothesis != "A smaller model is enough\nfor this station." ||
		string((*received)[0].Station) != `{"model":"sonnet"}` {
		t.Errorf("proposed %+v", *received)
	}
}

func TestCandidatePrintsTheProblemsSpotlightFound(t *testing.T) {
	proposer(t, 422, `{"errors":[`+
		`{"path":"station.check","message":"a search may not change the check","severity":"error"},`+
		`{"path":"station.effort","message":"effort is one of low, medium, high","severity":"error"},`+
		`{"path":"station.prompt","message":"the prompt is long","severity":"warning"}]}`)
	out := new(bytes.Buffer)

	err := run([]string{"candidate", "--name", "terse", "--hypothesis", "x", "-"},
		strings.NewReader(`{"check":"npm test"}`), out)

	if err == nil {
		t.Fatal("a rejected candidate passed")
	}
	for _, want := range []string{
		"Spotlight rejected the candidate:\n",
		"\nstation.check: a search may not change the check\n",
		"\nstation.effort: effort is one of low, medium, high\n",
		"\nstation.prompt: the prompt is long (warning, not why it was rejected)\n",
	} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("output %q, missing %q", err, want)
		}
	}
	if out.Len() != 0 {
		t.Errorf("printed %q as if it had been proposed", out)
	}
}

func TestCandidateCarriesAnErrorWithoutProblems(t *testing.T) {
	proposer(t, 422, "this iteration has proposed all the candidates it may\n")

	err := run([]string{"candidate", "--name", "terse", "--hypothesis", "x", "-"},
		strings.NewReader(`{}`), new(bytes.Buffer))

	if err == nil || err.Error() != "this iteration has proposed all the candidates it may" {
		t.Fatalf("err = %v", err)
	}
}

func TestCandidateRejectsMisuseBeforeCallingSpotlight(t *testing.T) {
	received := proposer(t, 200, proposedTerse)

	for _, args := range [][]string{
		{"candidate"},
		{"candidate", "--hypothesis", "x", "-"},
		{"candidate", "--name", "terse", "-"},
		{"candidate", "--name", "terse", "--hypothesis", "x"},
		{"candidate", "--name", "terse", "--hypothesis", "x", "a.json", "b.json"},
		{"candidate", "--name", "terse", "--hypothesis", "x", "--colour", "red", "-"},
		{"candidate", "--name", "a/b", "--hypothesis", "x", "-"},
		{"candidate", "--name", "..", "--hypothesis", "x", "-"},
		{"candidate", "--name", "terse ", "--hypothesis", "x", "-"},
		{"candidate", "--name", "Terse", "--hypothesis", "x", "-"},
		{"candidate", "--name", "-terse", "--hypothesis", "x", "-"},
		{"candidate", "--name", strings.Repeat("a", 64), "--hypothesis", "x", "-"},
	} {
		err := run(args, strings.NewReader(`{}`), new(bytes.Buffer))
		if err == nil || !strings.Contains(err.Error(), "usage:") {
			t.Errorf("%v returned %v", args, err)
		}
	}
	if len(*received) != 0 {
		t.Errorf("proposed anyway: %+v", *received)
	}
}

func TestCandidateNeedsAJSONObject(t *testing.T) {
	received := proposer(t, 200, proposedTerse)
	hcl := filepath.Join(t.TempDir(), "line.tf")
	if err := os.WriteFile(hcl, []byte(`station "build" {}`), 0o644); err != nil {
		t.Fatal(err)
	}

	for _, attempt := range []struct {
		args []string
		in   string
		want string
	}{
		{[]string{"-"}, `["prompt"]`, "contains no JSON object"},
		{[]string{"-"}, `null`, "contains no JSON object"},
		{[]string{"-"}, `prompt: x`, "contains no JSON object"},
		{[]string{hcl}, ``, "is HCL"},
		{[]string{filepath.Join(t.TempDir(), "gone.json")}, ``, "read the station block"},
	} {
		args := append([]string{"candidate", "--name", "terse", "--hypothesis", "x"}, attempt.args...)
		err := run(args, strings.NewReader(attempt.in), new(bytes.Buffer))
		if err == nil || !strings.Contains(err.Error(), attempt.want) {
			t.Errorf("%v with %q: %v", attempt.args, attempt.in, err)
		}
	}
	if len(*received) != 0 {
		t.Errorf("proposed anyway: %+v", *received)
	}
}

func TestCandidateSaysWhenTheRunCannotProposeOne(t *testing.T) {
	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })
	t.Setenv(protocol.AgentAPIURLVar, server.URL())
	t.Setenv(protocol.AgentAPITokenVar, server.Token())

	err = run([]string{"candidate", "--name", "terse", "--hypothesis", "x", "-"}, strings.NewReader(`{}`), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "only a search's runs do") {
		t.Fatalf("got %v", err)
	}
}

func TestCandidateOutsideARunSaysSo(t *testing.T) {
	t.Setenv(protocol.AgentAPIURLVar, "")
	t.Setenv(protocol.AgentAPITokenVar, "")

	err := run([]string{"candidate", "--name", "terse", "--hypothesis", "x", "-"}, strings.NewReader(`{}`), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "no run") {
		t.Fatalf("got %v", err)
	}
}
