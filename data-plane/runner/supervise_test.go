package runner

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/config"
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
