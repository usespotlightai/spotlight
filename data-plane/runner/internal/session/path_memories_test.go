package session

import (
	"context"
	"encoding/json"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

type deliveredCall struct {
	handles []string
	paths   []string
}

func indexed(t *testing.T, files ...protocol.MemoryFile) (*pathMemories, string, *[]deliveredCall) {
	t.Helper()
	dir := t.TempDir()
	calls := []deliveredCall{}
	index := newPathMemories(
		dir,
		[]protocol.Checkout{{Remote: "https://github.com/acme/api.git", Path: "api"}},
		files,
		func(_ context.Context, handles, paths []string) {
			calls = append(calls, deliveredCall{handles: handles, paths: paths})
		},
	)

	return index, dir, &calls
}

func aboutUploads(handle string, briefed bool) protocol.MemoryFile {
	return protocol.MemoryFile{
		Path:       ".spotlight/memory/repositories/acme/api/src/uploads/" + handle + ".md",
		Body:       "# " + handle + " · rejected approach\n\nUploads retry in the request,\nnot from a queue.\n\n- Applies to: the whole team · acme/api: src/uploads\n",
		Handle:     handle,
		Repository: &protocol.MemoryFileRepository{Owner: "acme", Name: "api"},
		Paths:      []string{"src/uploads"},
		Briefed:    briefed,
	}
}

func TestAPathTheAgentUsesShowsWhatTheTeamRemembersAboutIt(t *testing.T) {
	index, dir, calls := indexed(t, aboutUploads("M-18", false))

	note := index.touched(context.Background(), []string{filepath.Join(dir, "api/src/uploads/retry.ts")})

	want := "The team remembers this about `api/src/uploads/retry.ts`, which you just used:\n" +
		"- **M-18** · rejected approach: Uploads retry in the request, not from a queue."
	if note != want {
		t.Errorf("the note said %q", note)
	}
	if len(*calls) != 1 || !slices.Equal((*calls)[0].handles, []string{"M-18"}) {
		t.Errorf("recorded %v", *calls)
	}
}

func TestAMemoryIsShownOnlyOnce(t *testing.T) {
	index, dir, calls := indexed(t, aboutUploads("M-18", false))

	index.touched(context.Background(), []string{filepath.Join(dir, "api/src/uploads/retry.ts")})
	again := index.touched(context.Background(), []string{"api/src/uploads/queue.ts"})

	if again != "" || len(*calls) != 1 {
		t.Errorf("shown again: %q, recorded %v", again, *calls)
	}
}

func TestNothingIsShownForABriefedMemoryOrAnotherPath(t *testing.T) {
	index, dir, calls := indexed(t, aboutUploads("M-18", true), aboutUploads("M-19", false))

	if note := index.touched(context.Background(), []string{filepath.Join(dir, "api/src/billing.ts"), "/elsewhere/api/src/uploads/a.ts"}); note != "" {
		t.Errorf("the note said %q", note)
	}
	note := index.touched(context.Background(), []string{filepath.Join(dir, "api/src/uploads")})
	if strings.Contains(note, "M-18") || !strings.Contains(note, "M-19") {
		t.Errorf("the note said %q", note)
	}
	if len(*calls) != 1 {
		t.Errorf("recorded %v", *calls)
	}
}

func TestAToolThatUsedAPathShowsTheMemoryAtTheNextPrompt(t *testing.T) {
	index, dir, _ := indexed(t, aboutUploads("M-18", false))
	input, _ := json.Marshal(map[string]string{"file_path": filepath.Join(dir, "api/src/uploads/retry.ts")})
	data, _ := json.Marshal(protocol.ToolChanged{ID: "tool_1", Title: "Read", Input: input})

	index.saw(protocol.Event{Type: protocol.EventToolChanged, Data: data})

	if note := index.pending(context.Background()); !strings.Contains(note, "**M-18**") {
		t.Errorf("the note said %q", note)
	}
	if note := index.pending(context.Background()); note != "" {
		t.Errorf("shown again: %q", note)
	}
}

func TestAMemoryLearnedAtAnotherStationIsNeverShown(t *testing.T) {
	learned := aboutUploads("M-21", false)
	learned.Elsewhere = true
	index, dir, _ := indexed(t, learned)

	if note := index.touched(context.Background(), []string{filepath.Join(dir, "api/src/uploads/retry.ts")}); note != "" {
		t.Errorf("the note said %q", note)
	}
}

func TestAMemoryAboutAnotherRepositoryIsNeverShown(t *testing.T) {
	other := aboutUploads("M-18", false)
	other.Repository = &protocol.MemoryFileRepository{Owner: "elsewhere", Name: "api"}
	index, dir, _ := indexed(t, other)

	if note := index.touched(context.Background(), []string{filepath.Join(dir, "api/src/uploads/retry.ts")}); note != "" {
		t.Errorf("the note said %q", note)
	}
}

func TestMemoriesPastTheLimitAreShownAtTheNextPrompt(t *testing.T) {
	files := []protocol.MemoryFile{}
	used := []string{}
	for _, name := range []string{"a", "b", "c", "d", "e", "f", "g"} {
		file := aboutUploads("M-"+name, false)
		file.Paths = []string{"src/" + name}
		files = append(files, file)
		used = append(used, "api/src/"+name+"/index.ts")
	}
	index, _, calls := indexed(t, files...)

	first := index.touched(context.Background(), used)
	later := index.pending(context.Background())

	if strings.Count(first, "**M-") != maxDeliveredAtOnce {
		t.Errorf("the first note said %q", first)
	}
	if !strings.Contains(later, "**M-f**") || !strings.Contains(later, "**M-g**") {
		t.Errorf("the next note said %q", later)
	}
	if len(*calls) != 2 {
		t.Errorf("recorded %v", *calls)
	}
}
