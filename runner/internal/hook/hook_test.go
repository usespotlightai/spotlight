package hook_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/runner/internal/hook"
)

func script(t *testing.T, body string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "hook")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+body), 0o700); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestNoHookIsNotAFailure(t *testing.T) {
	_, err := hook.Run(context.Background(), hook.Spec{})

	if !errors.Is(err, hook.ErrNoHook) {
		t.Errorf("expected ErrNoHook, got %v", err)
	}
}

func TestTheHookIsGivenTheRunOnStdin(t *testing.T) {
	out, err := hook.Run(context.Background(), hook.Spec{
		Path:    script(t, "cat"),
		Dir:     t.TempDir(),
		Payload: map[string]string{"id": "run_1"},
	})
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	if !strings.Contains(out, `"id":"run_1"`) {
		t.Errorf("the hook received %q", out)
	}
}

func TestTheHookRunsInTheWorkspace(t *testing.T) {
	dir := t.TempDir()

	out, err := hook.Run(context.Background(), hook.Spec{
		Path: script(t, "pwd"),
		Dir:  dir,
	})
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	// macOS resolves /var through a symlink.
	want, _ := filepath.EvalSymlinks(dir)
	got, _ := filepath.EvalSymlinks(strings.TrimSpace(out))
	if got != want {
		t.Errorf("ran in %q, want %q", got, want)
	}
}

func TestTheHookIsToldWhichRunItIsFor(t *testing.T) {
	out, err := hook.Run(context.Background(), hook.Spec{
		Path: script(t, "echo $SPOTLIGHT_RUN_ID"),
		Dir:  t.TempDir(),
		Env:  map[string]string{"SPOTLIGHT_RUN_ID": "run_7"},
	})
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	if strings.TrimSpace(out) != "run_7" {
		t.Errorf("the hook saw %q", out)
	}
}

func TestAFailingHookExplainsItself(t *testing.T) {
	out, err := hook.Run(context.Background(), hook.Spec{
		Path: script(t, "echo 'could not reach the forge' >&2; exit 1"),
		Dir:  t.TempDir(),
	})

	if err == nil {
		t.Fatal("expected an error")
	}
	if !strings.Contains(out, "could not reach the forge") {
		t.Errorf("output %q", out)
	}
}

func TestAWedgedHookIsGivenUpOn(t *testing.T) {
	started := time.Now()

	_, err := hook.Run(context.Background(), hook.Spec{
		Path:    script(t, "sleep 30"),
		Dir:     t.TempDir(),
		Timeout: 200 * time.Millisecond,
	})

	if err == nil {
		t.Fatal("expected the hook to be given up on")
	}
	if !strings.Contains(err.Error(), "did not finish") {
		t.Errorf("error %q", err)
	}
	if elapsed := time.Since(started); elapsed > 5*time.Second {
		t.Errorf("waited %s for a 200ms timeout", elapsed)
	}
}
