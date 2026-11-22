package session

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

var quietLog = slog.New(slog.NewTextHandler(io.Discard, nil))

func withServicesRun() protocol.Run {
	return protocol.Run{ID: "run_2", Spec: protocol.Spec{Services: []protocol.Service{
		{Name: "db", Image: "postgres:17", From: "app/compose.yml"},
		{Name: "cache", Image: "redis:7", From: "app/compose.yml"},
		{Name: "search", Image: "opensearch:2", From: "app/compose.yml"},
	}}}
}

func leaveServicesFile(t *testing.T, path, run string, outcomes ...protocol.ServiceOutcome) {
	t.Helper()
	body, err := json.Marshal(protocol.ServicesStarted{Run: run, Services: outcomes})
	if err != nil {
		t.Fatal(err)
	}
	// The host replaces the file whole, as a copy into the sandbox does.
	written := path + ".new"
	if err := os.WriteFile(written, body, 0o444); err != nil {
		t.Error(err)
	}
	if err := os.Rename(written, path); err != nil {
		t.Error(err)
	}
}

func TestTheRunnerWaitsForItsRunsServicesAndJournalsHowEachStarted(t *testing.T) {
	path := filepath.Join(t.TempDir(), "services.json")
	leaveServicesFile(t, path, "run_1", protocol.ServiceOutcome{Name: "db", From: "app/compose.yml", Ready: true})
	sink := &watchedSink{}
	journal := &journalWriter{runID: "run_2", journal: sink}

	go func() {
		time.Sleep(50 * time.Millisecond)
		leaveServicesFile(t, path, "run_2",
			protocol.ServiceOutcome{Name: "db", From: "app/compose.yml", Ready: true},
			protocol.ServiceOutcome{Name: "cache", From: "app/compose.yml", Ready: true},
			protocol.ServiceOutcome{Name: "search", From: "app/compose.yml", Problem: "it exited with code 137"},
		)
	}()
	down := Options{HostServices: true, ServicesFile: path, ServicesWait: 5 * time.Second}.awaitServices(context.Background(), withServicesRun(), journal, quietLog)
	journal.flush(context.Background())

	if len(down) != 1 || down[0].Name != "search" {
		t.Fatalf("down %+v, want search only, not the last run's file", down)
	}
	sink.mu.Lock()
	defer sink.mu.Unlock()
	ended := endedOf(t, sink.events[len(sink.events)-1])
	want := "Started db and cache from app/compose.yml.\nsearch from app/compose.yml did not start: it exited with code 137"
	if !ended.Failed || ended.Output != want || sink.events[0].Message != servicesStep {
		t.Errorf("journaled %+v, want a failed services step saying %q", ended, want)
	}
}

func TestTheRunnerGoesOnWithoutServicesTheHostNeverReported(t *testing.T) {
	journal := &journalWriter{runID: "run_2", journal: &watchedSink{}}
	opts := Options{
		HostServices: true, ServicesFile: filepath.Join(t.TempDir(), "services.json"), ServicesWait: 50 * time.Millisecond,
	}

	down := opts.awaitServices(context.Background(), withServicesRun(), journal, quietLog)

	if len(down) != 3 || !strings.Contains(down[0].Problem, "did not say") {
		t.Errorf("down %+v, want every service", down)
	}
}

func TestAnOlderHostStartsNoServicesAndTheRunnerDoesNotWaitForThem(t *testing.T) {
	sink := &watchedSink{}
	journal := &journalWriter{runID: "run_2", journal: sink}
	opts := Options{ServicesFile: filepath.Join(t.TempDir(), "services.json"), ServicesWait: time.Hour}

	down := opts.awaitServices(context.Background(), withServicesRun(), journal, quietLog)
	journal.flush(context.Background())

	if len(down) != 3 || down[0].Problem != "this host does not start services" {
		t.Errorf("down %+v", down)
	}
	if ended := endedOf(t, sink.events[0]); !ended.Failed || !strings.Contains(ended.Output, "Update the host") {
		t.Errorf("journaled %+v", ended)
	}
}

func TestARunWithoutServicesWaitsForNone(t *testing.T) {
	sink := &watchedSink{}
	journal := &journalWriter{runID: "run_1", journal: sink}

	if down := (Options{ServicesWait: time.Hour}).awaitServices(context.Background(), protocol.Run{ID: "run_1"}, journal, quietLog); down != nil {
		t.Errorf("down %+v", down)
	}
	journal.flush(context.Background())
	if len(sink.events) != 0 {
		t.Errorf("journaled %+v for a run without services", sink.events)
	}
}

func TestTheAgentHearsWhichServicesDidNotStart(t *testing.T) {
	talk := &conversation{
		run: protocol.Run{Spec: protocol.Spec{Briefing: "Fix the login page."}},
		down: []protocol.ServiceOutcome{
			{Name: "db", From: "compose.yml", Problem: "it exited with code 1. Its last output:\nPOSTGRES_PASSWORD is not set"},
		},
	}

	got := talk.opening(context.Background())

	for _, want := range []string{
		"- db (compose.yml): it exited with code 1. Its last output:\n  POSTGRES_PASSWORD is not set",
		"say which services did not start",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("the opening does not say %q:\n%s", want, got)
		}
	}
	if !strings.HasSuffix(got, "\n\nFix the login page.") {
		t.Errorf("the briefing does not follow the note:\n%s", got)
	}
}

func TestTheRunsServicesAreReachedDirectlyNotThroughTheProxy(t *testing.T) {
	env := map[string]string{"HTTP_PROXY": "http://127.0.0.1:3128", "NO_PROXY": "localhost,127.0.0.1,::1", "no_proxy": "localhost"}

	got := servicesUnproxied(env, withServicesRun().Spec.Services)

	if got["NO_PROXY"] != "localhost,127.0.0.1,::1,db,cache,search" || got["no_proxy"] != "localhost,db,cache,search" {
		t.Errorf("unproxied %v", got)
	}
	if env["NO_PROXY"] != "localhost,127.0.0.1,::1" {
		t.Error("the runner's own proxy settings changed")
	}
	if got := servicesUnproxied(env, nil); got["NO_PROXY"] != "localhost,127.0.0.1,::1" {
		t.Errorf("a run without services unproxied %v", got)
	}
}
