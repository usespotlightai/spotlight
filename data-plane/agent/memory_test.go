package agent

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

type memoryChannel struct {
	recalled   []protocol.RecallRequest
	remembered []protocol.Remembering
}

func remembering(t *testing.T, refusing error) *memoryChannel {
	t.Helper()

	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	seen := &memoryChannel{}
	name := "Ada"
	grounds := &protocol.MemoryGrounds{TaskID: "task_1", RunID: "run_1"}
	repository := "acme/api"

	server.Memories(
		func(asked protocol.RecallRequest) (json.RawMessage, error) {
			seen.recalled = append(seen.recalled, asked)
			memory := protocol.RecalledMemory{
				Handle: "M-12", Kind: "rejected-approach", Standing: "stands",
				Body: "Uploads retry in the request,\nnot from a queue.", Source: "run", Reach: "line",
				Repository: &repository, Paths: []string{"src/uploads"},
				ApprovedBy: protocol.MemoryPerson{ID: "user_1", Name: &name},
				ApprovedAt: "2026-09-21T10:00:00.000Z", Grounds: grounds,
				Steps:      []protocol.MemoryStep{{Index: 14, Kind: "thought", Text: "A queue needs a worker we do not run."}},
				Superseded: &protocol.MemoryLink{Handle: "M-7", Body: "Uploads retry from a queue."},
			}
			if asked.Handle != "" {
				return json.Marshal(memory)
			}
			if asked.Words == "nothing" {
				return json.Marshal([]protocol.RecalledMemory{})
			}
			return json.Marshal([]protocol.RecalledMemory{memory})
		},
		func(asked protocol.Remembering) (json.RawMessage, error) {
			if refusing != nil {
				return nil, refusing
			}
			seen.remembered = append(seen.remembered, asked)
			return json.Marshal(protocol.ProposedMemory{
				Kind: asked.Kind, Body: asked.Body, Source: "run", Reach: "line",
			})
		},
	)

	t.Setenv(protocol.HandoverURLVar, server.URL())
	t.Setenv(protocol.HandoverTokenVar, server.Token())

	return seen
}

func TestRecallSearchesByWordsAndShowsEachMemoryBriefly(t *testing.T) {
	seen := remembering(t, nil)
	out := new(bytes.Buffer)

	if err := run([]string{"recall", "upload", "retries"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(seen.recalled) != 1 || seen.recalled[0].Words != "upload retries" {
		t.Fatalf("asked %+v", seen.recalled)
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
		t.Errorf("said %q", out.String())
	}
}

func TestRecallByHandleShowsTheMemoryInFullWithItsGrounds(t *testing.T) {
	seen := remembering(t, nil)
	out := new(bytes.Buffer)

	if err := run([]string{"recall", "m-12"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if len(seen.recalled) != 1 || seen.recalled[0].Handle != "M-12" || seen.recalled[0].Words != "" {
		t.Fatalf("asked %+v", seen.recalled)
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
	if !strings.Contains(out.String(), "waits beside the task for a person to approve it") {
		t.Errorf("said %q", out.String())
	}
}

func TestRememberShowsWhySpotlightRefusedIt(t *testing.T) {
	remembering(t, errors.New("A memory is one of rationale, rejected-approach, failure, environment, preference, correction, not gossip"))

	err := run([]string{"remember", "--kind", "gossip", "--body", "Something."}, strings.NewReader(""), new(bytes.Buffer))

	if err == nil || !strings.Contains(err.Error(), "one of rationale, rejected-approach") {
		t.Fatalf("got %v", err)
	}
}

func TestRememberAsksForAKindAndABody(t *testing.T) {
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
