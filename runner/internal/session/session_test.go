package session_test

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/session"
	"usespotlight.ai/runner/internal/terminal"
)

type journal struct {
	mu       sync.Mutex
	events   []protocol.Event
	renewals int
	done     *protocol.Completion
}

func (j *journal) AppendEvents(_ context.Context, _ string, events []protocol.Event) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.events = append(j.events, events...)
	return nil
}

func (j *journal) RenewLease(context.Context, string) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.renewals++
	return nil
}

func (j *journal) Complete(_ context.Context, _ string, done protocol.Completion) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.done = &done
	return nil
}

func (j *journal) typed(kind protocol.EventType) []protocol.Event {
	j.mu.Lock()
	defer j.mu.Unlock()

	var found []protocol.Event
	for _, event := range j.events {
		if event.Type == kind {
			found = append(found, event)
		}
	}
	return found
}

func prepareHook(t *testing.T, body string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "prepare")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+body), 0o700); err != nil {
		t.Fatal(err)
	}
	return path
}

func execute(t *testing.T, command protocol.Command) (*journal, string) {
	t.Helper()

	root := t.TempDir()
	written := &journal{}

	run := protocol.Run{ID: "run_1", Spec: protocol.Spec{Cwd: "service", Command: command}}

	err := session.Execute(context.Background(), run, session.Options{
		WorkspaceRoot: root,
		Journal:       written,
		Log:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		PrepareHook:   prepareHook(t, "mkdir service && echo '# service' > service/README.md"),
		HookTimeout:   30 * time.Second,
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	return written, root
}

func TestExecuteTakesARunFromNothingToAnOutcome(t *testing.T) {
	written, root := execute(t, protocol.Command{
		Executable: "sh",
		Args:       []string{"-c", "cat README.md"},
	})

	if ready := written.typed(protocol.EventWorkspaceReady); len(ready) != 1 {
		t.Errorf("expected the workspace to be reported once, got %d", len(ready))
	}

	output := written.typed(protocol.EventOutput)
	if len(output) == 0 {
		t.Fatal("expected the agent's output")
	}

	var seen strings.Builder
	for _, event := range output {
		seen.Write(event.Data)
	}
	if !strings.Contains(seen.String(), "# service") {
		t.Errorf("the agent did not see the checkout: %q", seen.String())
	}

	if written.done == nil || written.done.ExitCode != 0 || written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}

	if _, err := os.Stat(filepath.Join(root, "run_1")); !os.IsNotExist(err) {
		t.Error("the workspace should be gone")
	}
	if _, err := os.Stat(filepath.Join(root, ".recordings", "run_1")); !os.IsNotExist(err) {
		t.Error("the recording should be gone with the run")
	}
}

func TestEventsAreNumberedWithoutGaps(t *testing.T) {
	written, _ := execute(t, protocol.Command{
		Executable: "sh",
		Args:       []string{"-c", "for i in 1 2 3 4 5; do echo line $i; done"},
	})

	written.mu.Lock()
	defer written.mu.Unlock()

	for i, event := range written.events {
		if event.Seq != i+1 {
			t.Fatalf("event %d has seq %d", i, event.Seq)
		}
		if event.At.IsZero() {
			t.Errorf("event %d has no timestamp", i)
		}
	}
}

func TestAFailingAgentIsReportedAsFailed(t *testing.T) {
	written, _ := execute(t, protocol.Command{
		Executable: "sh",
		Args:       []string{"-c", "exit 2"},
	})

	if written.done == nil || written.done.ExitCode != 2 || !written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}
}

func TestARunThatCannotStartIsStillReported(t *testing.T) {
	root := t.TempDir()
	written := &journal{}

	err := session.Execute(context.Background(), protocol.Run{ID: "run_2"}, session.Options{
		WorkspaceRoot: root,
		Journal:       written,
		Log:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		PrepareHook:   prepareHook(t, "echo 'could not reach the forge' >&2; exit 1"),
		HookTimeout:   30 * time.Second,
	})
	if err == nil {
		t.Fatal("expected a failing prepare hook to fail the run")
	}

	// Reported, not just journalled. A run left claimed is retried until its
	// lease lapses, and a broken checkout will not fix itself.
	if written.done == nil || !written.done.Failed {
		t.Errorf("the failure was not reported: %+v", written.done)
	}

	if failures := written.typed(protocol.EventFailed); len(failures) != 1 {
		t.Errorf("expected one failure in the journal, got %d", len(failures))
	}
}

// The uid split only means something if the agent genuinely cannot reach what
// the runner keeps. Needs root and the agent account, so it only runs in the
// container.
func TestTheAgentIsWalledOffFromTheRunner(t *testing.T) {
	if os.Getuid() != 0 {
		t.Skip("dropping to another user needs root")
	}
	as, err := terminal.LookupUser("agent")
	if err != nil {
		t.Skipf("no agent account here: %v", err)
	}

	t.Setenv("SPOTLIGHT_TOKEN", "the-runners-control-plane-token")

	root, err := os.MkdirTemp("", "walled")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(root) })

	written := &journal{}
	err = session.Execute(context.Background(), protocol.Run{
		ID: "run_walled",
		Spec: protocol.Spec{
			Cwd: "service",
			Command: protocol.Command{
				Executable: "sh",
				Args: []string{"-c", `
				echo "uid=$(id -u)"
				cat ../../.recordings/run_walled >/dev/null 2>&1 && echo "READ THE RECORDING"
				ls .. >/dev/null 2>&1 || echo "CANNOT SEE OWN RUN DIR"
				ls ../.. >/dev/null 2>&1 && echo "LISTED THE ROOT"
				env | grep -q SPOTLIGHT_TOKEN && echo "SAW THE TOKEN"
				grep -l SPOTLIGHT_TOKEN /proc/*/environ 2>/dev/null | head -1 | grep -q . && echo "READ IT FROM PROC"
				cat /proc/1/environ 2>/dev/null | grep -q SPOTLIGHT && echo "READ PID 1"
				true
			`},
			},
		},
	}, session.Options{
		WorkspaceRoot: root,
		Journal:       written,
		Log:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		AgentUser:     as,
		PrepareHook:   prepareHook(t, "mkdir service"),
		HookTimeout:   30 * time.Second,
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	var seen strings.Builder
	for _, event := range written.typed(protocol.EventOutput) {
		seen.Write(event.Data)
	}
	out := seen.String()

	if !strings.Contains(out, "uid=2000") {
		t.Errorf("the agent did not run as the agent account:\n%s", out)
	}
	for _, breach := range []string{
		"READ THE RECORDING", "LISTED THE ROOT", "SAW THE TOKEN",
		"READ IT FROM PROC", "READ PID 1",
	} {
		if strings.Contains(out, breach) {
			t.Errorf("the agent %s", strings.ToLower(breach))
		}
	}
}

type typedIn struct {
	mu      sync.Mutex
	pending [][]protocol.Input
}

func (t *typedIn) AwaitInput(ctx context.Context, _ string) ([]protocol.Input, error) {
	t.mu.Lock()
	if len(t.pending) > 0 {
		next := t.pending[0]
		t.pending = t.pending[1:]
		t.mu.Unlock()
		return next, nil
	}
	t.mu.Unlock()

	timer := time.NewTimer(50 * time.Millisecond)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-timer.C:
		return nil, nil
	}
}

func TestExecuteDrivesTheAgentFromWhatAViewerTyped(t *testing.T) {
	written := &journal{}

	run := protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Command: protocol.Command{
				Executable: "sh",
				Args:       []string{"-c", "read line; echo \"you said: $line\""},
			},
		},
	}

	err := session.Execute(context.Background(), run, session.Options{
		WorkspaceRoot: t.TempDir(),
		Journal:       written,
		Input: &typedIn{pending: [][]protocol.Input{
			{{Cols: 100, Rows: 30, Data: []byte("hello\n")}},
		}},
		Log:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		HookTimeout: 30 * time.Second,
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	var seen strings.Builder
	for _, event := range written.typed(protocol.EventOutput) {
		seen.Write(event.Data)
	}

	if !strings.Contains(seen.String(), "you said: hello") {
		t.Errorf("the agent did not receive what was typed: %q", seen.String())
	}

	if written.done == nil || written.done.ExitCode != 0 {
		t.Errorf("completion %+v", written.done)
	}
}

func TestExecuteLeavesTheTerminalReadOnlyWithoutAnInputSource(t *testing.T) {
	written, _ := execute(t, protocol.Command{
		Executable: "sh",
		Args:       []string{"-c", "echo ready"},
	})

	if written.done == nil || written.done.Failed {
		t.Errorf("a run without an input source should still finish: %+v", written.done)
	}
}

func TestExecuteStopsTheAgentWhenAskedTo(t *testing.T) {
	written := &journal{}

	run := protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Command: protocol.Command{
				Executable: "sh",
				Args:       []string{"-c", "echo AGENT-READY; sleep 600"},
			},
		},
	}

	done := make(chan error, 1)
	go func() {
		done <- session.Execute(context.Background(), run, session.Options{
			WorkspaceRoot: t.TempDir(),
			Journal:       written,
			Input: &typedIn{pending: [][]protocol.Input{
				{{Stop: true}},
			}},
			Log:         slog.New(slog.NewTextHandler(io.Discard, nil)),
			HookTimeout: 30 * time.Second,
		})
	}()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("execute: %v", err)
		}
	case <-time.After(30 * time.Second):
		t.Fatal("the agent was never stopped")
	}

	if written.done == nil {
		t.Fatal("expected the run to be reported")
	}

	if written.done.Failed {
		t.Errorf("a stopped run should not be reported as failed: %+v", written.done)
	}
	if written.done.Message != "stopped from the console" {
		t.Errorf("message %q", written.done.Message)
	}
}
