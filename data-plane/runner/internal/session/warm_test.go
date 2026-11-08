package session

import (
	"context"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

func warmGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	command := exec.Command("git", args...)
	command.Dir = dir
	command.Env = append(os.Environ(), "GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v: %s", args, err, output)
	}
}

func TestAWarmSandboxSetsUpOnceSoTheFirstRunSkipsSetup(t *testing.T) {
	source, mirrors := t.TempDir(), t.TempDir()
	warmGit(t, source, "init", "--quiet", "--initial-branch", "main")
	writeFile(t, filepath.Join(source, "package-lock.json"), "{}")
	warmGit(t, source, "add", ".")
	warmGit(t, source, "commit", "--quiet", "-m", "one")
	warmGit(t, mirrors, "clone", "--quiet", "--bare", source, filepath.Join(mirrors, "web.git"))

	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	installs := filepath.Join(t.TempDir(), "installs")
	setup := "echo installed >> " + installs
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	sandbox := &Sandbox{space: space, kept: &kept{archives: true}}

	if err := sandbox.Warm(context.Background(), protocol.WarmSandbox{
		Line: "line_1", Checkouts: []protocol.WarmCheckout{{Path: "web", Setup: setup}},
	}, WarmOptions{Mirrors: mirrors, Log: log}); err != nil {
		t.Fatal(err)
	}

	if sandbox.kept.archives {
		t.Error("a warm sandbox that no run took would archive its working copy")
	}

	journal := &journalWriter{}
	Options{}.setUp(context.Background(), space.Dir, []protocol.Checkout{{Path: "web", Setup: setup}}, sandbox.setUp, journal, log)

	body, err := os.ReadFile(installs)
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.Count(string(body), "installed"); got != 1 {
		t.Errorf("setup ran %d times, want 1: the first run must find the warm setup", got)
	}
	if len(journal.pending) != 1 || !strings.HasPrefix(string(journal.pending[0].Data), "Skipped setup for web:") {
		t.Errorf("the first run journaled %+v", journal.pending)
	}
}

func TestAWarmSandboxFailsWhenTheHostHasNoMirror(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	sandbox := &Sandbox{space: space}

	err = sandbox.Warm(context.Background(), protocol.WarmSandbox{Checkouts: []protocol.WarmCheckout{{Path: "web"}}},
		WarmOptions{Mirrors: t.TempDir(), Log: slog.New(slog.NewTextHandler(io.Discard, nil))})
	if err == nil {
		t.Error("a sandbox warmed with no mirror")
	}
}
