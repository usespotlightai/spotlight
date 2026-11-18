package session

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func endedOf(t *testing.T, event protocol.Event) protocol.StepEnd {
	t.Helper()

	if event.Type != protocol.EventStepEnded {
		t.Fatalf("%s is not the end of a step", event.Type)
	}
	var ended protocol.StepEnd
	if err := json.Unmarshal(event.Data, &ended); err != nil {
		t.Fatal(err)
	}
	return ended
}

func startedOf(t *testing.T, event protocol.Event) protocol.StepStart {
	t.Helper()

	if event.Type != protocol.EventStepStarted {
		t.Fatalf("%s is not the start of a step", event.Type)
	}
	var started protocol.StepStart
	if err := json.Unmarshal(event.Data, &started); err != nil {
		t.Fatal(err)
	}
	return started
}

type watchedSink struct {
	mu       sync.Mutex
	events   []protocol.Event
	received func(protocol.Event)
}

func (w *watchedSink) AppendEvents(_ context.Context, _ string, events []protocol.Event) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, event := range events {
		if w.received != nil {
			w.received(event)
		}
	}
	w.events = append(w.events, events...)
	return nil
}

func TestAStepIsSentWhenItStartsAndAgainWhenItEnds(t *testing.T) {
	sink := &watchedSink{}
	journal := &journalWriter{runID: "run", journal: sink}

	running := journal.begin(context.Background(), "restore")
	if len(sink.events) != 1 || sink.events[0].Message != "restore" {
		t.Fatalf("sent %+v when the step started", sink.events)
	}
	started := startedOf(t, sink.events[0])
	if started.ID == "" {
		t.Fatal("the step started with no id")
	}

	running.end(context.Background(), true, "Started afresh: gone")
	if len(sink.events) != 2 || sink.events[1].Message != "restore" {
		t.Fatalf("sent %+v when the step ended", sink.events)
	}
	ended := endedOf(t, sink.events[1])
	if ended != (protocol.StepEnd{ID: started.ID, Failed: true, Output: "Started afresh: gone"}) {
		t.Errorf("the step ended as %+v", ended)
	}
}

func TestEachStepHasItsOwnID(t *testing.T) {
	journal := &journalWriter{runID: "run", journal: &watchedSink{}}

	first := journal.begin(context.Background(), "setup")
	second := journal.begin(context.Background(), "setup")

	if first.id == second.id {
		t.Error("two setups started under one id")
	}
}

func TestANoteIsAStepThatOnlyEnds(t *testing.T) {
	journal := &journalWriter{}

	journal.note("setup", false, "Skipped setup for web")

	if len(journal.pending) != 1 {
		t.Fatalf("noted %+v", journal.pending)
	}
	if ended := endedOf(t, journal.pending[0]); ended != (protocol.StepEnd{Output: "Skipped setup for web"}) {
		t.Errorf("noted %+v", ended)
	}
}

func TestASetupIsSentWhileItRuns(t *testing.T) {
	dir := t.TempDir()
	for _, path := range []string{"web", "api"} {
		if err := os.MkdirAll(filepath.Join(dir, path), 0o755); err != nil {
			t.Fatal(err)
		}
	}

	done := map[string]bool{}
	sink := &watchedSink{}
	sink.received = func(event protocol.Event) {
		if event.Type != protocol.EventStepStarted {
			return
		}
		_, err := os.Stat(filepath.Join(dir, "web", "installed"))
		done[startedOf(t, event).ID] = err == nil
	}
	journal := &journalWriter{runID: "run", journal: sink}

	failures := Options{}.setUp(context.Background(), dir, []protocol.Checkout{
		{Path: "web", Setup: "touch installed"},
		{Path: "api", Setup: "exit 3"},
	}, setUps{}, journal, slog.New(slog.NewTextHandler(io.Discard, nil)))
	journal.drain(context.Background())

	if len(failures) != 1 || failures[0].path != "api" {
		t.Fatalf("failed %+v", failures)
	}

	ended := map[string]protocol.StepEnd{}
	for _, event := range sink.events {
		if event.Message != setupStep {
			t.Errorf("journalled %q as a setup", event.Message)
		}
		if event.Type == protocol.EventStepEnded {
			each := endedOf(t, event)
			if _, began := done[each.ID]; !began {
				t.Errorf("a setup ended that never started: %+v", each)
			}
			ended[each.ID] = each
		}
	}
	if len(done) != 2 || len(ended) != 2 {
		t.Fatalf("started %d and ended %d setups, want 2 of each", len(done), len(ended))
	}

	var failed int
	for id, each := range ended {
		if done[id] && !each.Failed {
			t.Error("the web setup was sent only once it had run")
		}
		if each.Failed {
			failed++
		}
	}
	if failed != 1 {
		t.Errorf("%d setups ended failed, want 1", failed)
	}
}
