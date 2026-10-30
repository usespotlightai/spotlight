package runner

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/config"
	"usespotlight.ai/data-plane/runner/internal/session"
)

func TestTakesTheNextAssignmentOnceTheHostSignals(t *testing.T) {
	path := assignmentFile(t, protocol.Assignment{RunnerID: "runner_2", Token: "one-run-2", SandboxID: "sandbox_a"})
	r := runner{cfg: config.Config{AssignmentFile: path}, log: quiet}
	delivered := make(chan os.Signal, 1)
	delivered <- syscall.SIGUSR1

	next, ok := r.nextAssignment(context.Background(), delivered, quiet)

	if !ok || next.RunnerID != "runner_2" || next.Token != "one-run-2" {
		t.Fatalf("took %+v, %v", next, ok)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the next run's credential is still on disk: %v", err)
	}
}

func TestLeavesAHalfWrittenAssignmentForTheNextSignal(t *testing.T) {
	path := filepath.Join(t.TempDir(), "assignment.json")
	if err := os.WriteFile(path, []byte(`{"runnerId":"runner_2","tok`), 0o400); err != nil {
		t.Fatal(err)
	}
	r := runner{cfg: config.Config{AssignmentFile: path}, log: quiet}
	delivered := make(chan os.Signal, 2)
	delivered <- syscall.SIGUSR1

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, ok := r.nextAssignment(ctx, delivered, quiet); ok {
		t.Fatal("took a half-written assignment")
	}
	if _, err := os.Stat(path); err != nil {
		t.Errorf("removed a half-written assignment: %v", err)
	}
}

func TestStopsWaitingForANextRunWhenTheSandboxDrains(t *testing.T) {
	r := runner{cfg: config.Config{AssignmentFile: filepath.Join(t.TempDir(), "assignment.json")}, log: quiet}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, ok := r.nextAssignment(ctx, make(chan os.Signal), quiet); ok {
		t.Error("took work from a sandbox that drains")
	}
}

func TestReadsASandboxOnlyAssignmentWithItsSandboxCredential(t *testing.T) {
	path := assignmentFile(t, protocol.Assignment{
		SandboxID:    "sandbox_a",
		SandboxToken: "sandbox-token",
		Work:         protocol.ClaimResponse{Kind: protocol.ClaimedSandbox},
	})

	assigned, err := readAssignment(path)
	if err != nil || !assigned.StartsSandboxOnly() || assigned.SandboxToken != "sandbox-token" {
		t.Fatalf("read %+v, %v", assigned, err)
	}

	bare := assignmentFile(t, protocol.Assignment{SandboxID: "sandbox_a", Work: protocol.ClaimResponse{Kind: protocol.ClaimedSandbox}})
	if _, err := readAssignment(bare); err == nil {
		t.Error("took a sandbox with no credential")
	}
}

func TestStopsTheAgentsProcessesBeforeTheRunIsComplete(t *testing.T) {
	var order []string
	journal := stoppingFirst{
		Journal: completing{done: func() { order = append(order, "complete") }},
		stop:    func() { order = append(order, "stop") },
	}

	if err := journal.Complete(context.Background(), "run_1", protocol.Completion{}); err != nil {
		t.Fatal(err)
	}

	if len(order) != 2 || order[0] != "stop" || order[1] != "complete" {
		t.Errorf("went %v", order)
	}
}

type completing struct {
	session.Journal
	done func()
}

func (c completing) Complete(context.Context, string, protocol.Completion) error {
	c.done()
	return nil
}

type sandboxPlane struct {
	mu       sync.Mutex
	server   *httptest.Server
	calls    []string
	uploaded []byte
}

func (p *sandboxPlane) serve(w http.ResponseWriter, r *http.Request) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls = append(p.calls, r.Method+" "+r.URL.Path)

	switch {
	case r.Method == http.MethodGet:
		w.WriteHeader(http.StatusNoContent)
	case r.Method == http.MethodPut:
		p.uploaded, _ = io.ReadAll(r.Body)
	case strings.HasSuffix(r.URL.Path, "/complete"):
		w.WriteHeader(http.StatusNoContent)
	default:
		_ = json.NewEncoder(w).Encode(protocol.ArchiveGrant{ID: "archive_1", URL: p.server.URL + "/objects/archive_1"})
	}
}

func (p *sandboxPlane) called() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return slices.Clone(p.calls)
}

func TestASandboxWithNoRunRestoresWaitsAndArchivesItsEditsWhenItDrains(t *testing.T) {
	plane := &sandboxPlane{}
	plane.server = httptest.NewServer(http.HandlerFunc(plane.serve))
	t.Cleanup(plane.server.Close)

	workspace := t.TempDir()
	r := runner{
		cfg:     config.Config{URL: plane.server.URL, Workspace: workspace, AssignmentFile: filepath.Join(t.TempDir(), "assignment.json")},
		log:     quiet,
		sandbox: new(session.Sandbox),
	}
	ctx, drain := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		r.supervise(ctx, protocol.Assignment{
			SandboxID:    "sandbox_a",
			SandboxToken: "sandbox-token",
			Work:         protocol.ClaimResponse{Kind: protocol.ClaimedSandbox},
		}, make(chan os.Signal))
	}()

	deadline := time.Now().Add(5 * time.Second)
	for len(plane.called()) == 0 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if err := os.WriteFile(filepath.Join(workspace, "notes.md"), []byte("edited"), 0o644); err != nil {
		t.Fatal(err)
	}
	drain()
	<-done

	want := []string{
		"GET /api/sandboxes/sandbox_a/workspace-archive",
		"POST /api/sandboxes/sandbox_a/workspace-archive",
		"PUT /objects/archive_1",
		"POST /api/sandboxes/sandbox_a/workspace-archive/archive_1/complete",
	}
	if got := plane.called(); !slices.Equal(got, want) {
		t.Errorf("called %v, want %v", got, want)
	}
}
