package agent

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

type memoryChannel struct {
	recalled   []protocol.RecallRequest
	remembered []protocol.RememberRequest
}

func remembering(t *testing.T, rejecting error) *memoryChannel {
	t.Helper()

	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	seen := &memoryChannel{}
	name := "Ada"
	provenance := &protocol.MemoryProvenance{TaskID: "task_1", RunID: "run_1"}
	repository := "acme/api"

	server.Memories(
		func(received protocol.RecallRequest) (json.RawMessage, error) {
			seen.recalled = append(seen.recalled, received)
			memory := protocol.RecalledMemory{
				Handle: "M-12", Kind: "rejected-approach", Status: "active",
				Body: "Uploads retry in the request,\nnot from a queue.", Source: "run", Scope: "line",
				Repository: &repository, Paths: []string{"src/uploads"},
				ApprovedBy: protocol.MemoryPerson{ID: "user_1", Name: &name},
				ApprovedAt: "2026-09-21T10:00:00.000Z", Provenance: provenance,
				Steps:      []protocol.MemoryStep{{Index: 14, Kind: "thought", Text: "A queue needs a worker we do not run."}},
				Superseded: &protocol.MemoryLink{Handle: "M-7", Body: "Uploads retry from a queue."},
			}
			if received.Handle != "" {
				return json.Marshal(memory)
			}
			if received.Words == "nothing" {
				return json.Marshal([]protocol.RecalledMemory{})
			}
			return json.Marshal([]protocol.RecalledMemory{memory})
		},
		func(received protocol.RememberRequest) (json.RawMessage, error) {
			if rejecting != nil {
				return nil, rejecting
			}
			seen.remembered = append(seen.remembered, received)
			return json.Marshal(protocol.ProposedMemory{
				Kind: received.Kind, Body: received.Body, Source: "run", Scope: "line",
			})
		},
	)

	t.Setenv(protocol.AgentAPIURLVar, server.URL())
	t.Setenv(protocol.AgentAPITokenVar, server.Token())

	return seen
}

func TestRecallSearchesByWordsAndShowsEachMemoryBriefly(t *testing.T) {
	seen := remembering(t, nil)
	out := new(bytes.Buffer)

	if err := run([]string{"recall", "upload", "retries"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(seen.recalled) != 1 || seen.recalled[0].Words != "upload retries" {
		t.Fatalf("received %+v", seen.recalled)
	}
	for _, want := range []string{
		"M-12 · rejected approach · line, in acme/api at src/uploads",
		"Uploads retry in the request, not from a queue.",
		"From a run on task task_1, approved by Ada on 2026-09-21",
	} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("missing %q in %q", want, out.String())
		}
	}
}

func TestRecallSaysSoWhenNothingMatches(t *testing.T) {
	remembering(t, nil)
	out := new(bytes.Buffer)

	if err := run([]string{"recall", "nothing"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if !strings.Contains(out.String(), "remembers nothing") {
		t.Errorf("output %q", out.String())
	}
}

func TestRecallByHandleShowsTheMemoryInFullWithItsProvenance(t *testing.T) {
	seen := remembering(t, nil)
	out := new(bytes.Buffer)

	if err := run([]string{"recall", "m-12"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(seen.recalled) != 1 || seen.recalled[0].Handle != "M-12" || seen.recalled[0].Words != "" {
		t.Fatalf("received %+v", seen.recalled)
	}
	for _, want := range []string{
		"step 14, thought: A queue needs a worker we do not run.",
		"It replaced M-7: Uploads retry from a queue.",
		"spotlight trace --task task_1",
	} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("missing %q in %q", want, out.String())
		}
	}
}

func TestRememberProposesWithAbsolutePaths(t *testing.T) {
	seen := remembering(t, nil)
	out := new(bytes.Buffer)
	dir := t.TempDir()
	t.Chdir(dir)

	err := run([]string{
		"remember", "--kind", "rationale", "--body", "-",
		"--path", "api/src/uploads", "--path", "web",
	}, strings.NewReader("Retry in the request.\n"), out)
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	resolved, _ := filepath.EvalSymlinks(dir)
	working, _ := os.Getwd()
	if len(seen.remembered) != 1 {
		t.Fatalf("remembered %+v", seen.remembered)
	}
	got := seen.remembered[0]
	if got.Kind != "rationale" || got.Body != "Retry in the request." {
		t.Errorf("remembered %+v", got)
	}
	if len(got.Paths) != 2 || !filepath.IsAbs(got.Paths[0]) ||
		(!strings.HasPrefix(got.Paths[0], working) && !strings.HasPrefix(got.Paths[0], resolved)) {
		t.Errorf("paths %v", got.Paths)
	}
	if !strings.Contains(out.String(), "waits in the inbox for a person to approve it") {
		t.Errorf("output %q", out.String())
	}
}

func TestRememberShowsWhySpotlightRejectedIt(t *testing.T) {
	remembering(t, errors.New("A memory is one of rationale, rejected-approach, failure, environment, preference, correction, not gossip"))

	err := run([]string{"remember", "--kind", "gossip", "--body", "Something."}, strings.NewReader(""), new(bytes.Buffer))

	if err == nil || !strings.Contains(err.Error(), "one of rationale, rejected-approach") {
		t.Fatalf("got %v", err)
	}
}

func TestRememberRequiresAKindAndABody(t *testing.T) {
	remembering(t, nil)

	for _, args := range [][]string{
		{"remember", "--body", "Something."},
		{"remember", "--kind", "rationale"},
		{"remember", "--kind", "rationale", "--body", "Something.", "stray"},
	} {
		if err := run(args, strings.NewReader(""), new(bytes.Buffer)); err == nil ||
			!strings.Contains(err.Error(), "spotlight remember --kind") {
			t.Errorf("%v: got %v", args, err)
		}
	}
}

func forgetting(t *testing.T) *[]protocol.ForgetRequest {
	t.Helper()

	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	seen := []protocol.ForgetRequest{}
	server.Forgetting(func(received protocol.ForgetRequest) (json.RawMessage, error) {
		seen = append(seen, received)
		return json.Marshal(protocol.ProposedMemory{Kind: "rationale", Body: "Uploads retry from a queue.", Scope: "line"})
	})
	t.Setenv(protocol.AgentAPIURLVar, server.URL())
	t.Setenv(protocol.AgentAPITokenVar, server.Token())

	return &seen
}

func TestForgetProposesToRetireAMemoryWithAReason(t *testing.T) {
	seen := forgetting(t)
	out := new(bytes.Buffer)

	err := run([]string{"forget", "m-12", "--because", "The queue was removed."}, strings.NewReader(""), out)
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(*seen) != 1 || (*seen)[0] != (protocol.ForgetRequest{Handle: "M-12", Because: "The queue was removed."}) {
		t.Errorf("forgot %+v", *seen)
	}
	if !strings.Contains(out.String(), "Proposed to retire M-12: Uploads retry from a queue.") {
		t.Errorf("output %q", out.String())
	}
}

func TestForgetRequiresAHandleAndAReason(t *testing.T) {
	forgetting(t)

	for _, args := range [][]string{
		{"forget", "--because", "Gone."},
		{"forget", "memory_1", "--because", "Gone."},
		{"forget", "M-12"},
		{"forget", "M-12", "M-13", "--because", "Gone."},
	} {
		if err := run(args, strings.NewReader(""), new(bytes.Buffer)); err == nil ||
			!strings.Contains(err.Error(), "spotlight forget <handle>") {
			t.Errorf("%v: got %v", args, err)
		}
	}
}

func hooked(t *testing.T, answer string) *[]protocol.TouchedRequest {
	t.Helper()

	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	seen := []protocol.TouchedRequest{}
	server.Touches(func(received protocol.TouchedRequest) string {
		seen = append(seen, received)
		return answer
	})
	t.Setenv(protocol.AgentAPIURLVar, server.URL())
	t.Setenv(protocol.AgentAPITokenVar, server.Token())

	return &seen
}

func TestTheHookShowsTheAgentWhatTheTeamRemembersAboutAPathItUsed(t *testing.T) {
	seen := hooked(t, "The team remembers this about `api/src/uploads.ts`, which you just used:")
	out := new(bytes.Buffer)

	err := run([]string{"hook", "post-tool-use"}, strings.NewReader(
		`{"cwd":"/work","tool_name":"Read","tool_input":{"file_path":"/work/api/src/uploads.ts"}}`,
	), out)
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(*seen) != 1 || !slices.Equal((*seen)[0].Paths, []string{"/work/api/src/uploads.ts"}) {
		t.Errorf("touched %+v", *seen)
	}
	var answered struct {
		HookSpecificOutput struct {
			HookEventName     string `json:"hookEventName"`
			AdditionalContext string `json:"additionalContext"`
		} `json:"hookSpecificOutput"`
	}
	if err := json.Unmarshal(out.Bytes(), &answered); err != nil ||
		answered.HookSpecificOutput.HookEventName != "PostToolUse" ||
		!strings.Contains(answered.HookSpecificOutput.AdditionalContext, "api/src/uploads.ts") {
		t.Errorf("output %q", out.String())
	}
}

func TestTheHookReadsThePathsAPatchChanges(t *testing.T) {
	seen := hooked(t, "")

	err := run([]string{"hook", "post-tool-use"}, strings.NewReader(
		`{"cwd":"/work","tool_name":"apply_patch","tool_input":{"command":["apply_patch","*** Begin Patch\n*** Update File: api/src/uploads.ts\n@@\n*** Add File: web/new.ts\n*** End Patch"]}}`,
	), new(bytes.Buffer))
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(*seen) != 1 || !slices.Equal((*seen)[0].Paths, []string{"/work/api/src/uploads.ts", "/work/web/new.ts"}) {
		t.Errorf("touched %+v", *seen)
	}
}

func TestTheHookSaysNothingWhereThereIsNothingToShow(t *testing.T) {
	hooked(t, "")
	out := new(bytes.Buffer)

	for _, input := range []string{
		`{"cwd":"/work","tool_name":"Read","tool_input":{"file_path":"/work/api/src/uploads.ts"}}`,
		`{"tool_name":"Bash","tool_input":{"command":"ls"}}`,
		`not json`,
	} {
		if err := run([]string{"hook", "post-tool-use"}, strings.NewReader(input), out); err != nil {
			t.Errorf("%s: got %v", input, err)
		}
	}

	if out.Len() != 0 {
		t.Errorf("output %q", out.String())
	}
}
