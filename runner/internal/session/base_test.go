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

	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/stackcheck"
)

func git(t *testing.T, dir string, args ...string) string {
	t.Helper()

	command := exec.Command("git", append([]string{"-C", dir}, args...)...)
	command.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=Spotlight", "GIT_AUTHOR_EMAIL=noreply@usespotlight.ai",
		"GIT_COMMITTER_NAME=Spotlight", "GIT_COMMITTER_EMAIL=noreply@usespotlight.ai",
	)

	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, output)
	}

	return strings.TrimSpace(string(output))
}

func TestMarkBasesRecordsWhereEachCheckoutBegan(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	dir := t.TempDir()
	repository := filepath.Join(dir, "widgets")

	if err := os.MkdirAll(repository, 0o755); err != nil {
		t.Fatal(err)
	}

	git(t, repository, "init", "--quiet")
	git(t, repository, "commit", "--quiet", "--allow-empty", "--message", "start")
	began := git(t, repository, "rev-parse", "HEAD")

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	markBases(context.Background(), dir, []protocol.Checkout{{Path: "widgets"}, {Path: "missing"}}, logger)

	git(t, repository, "commit", "--quiet", "--allow-empty", "--message", "work")

	if got := git(t, repository, "rev-parse", stackcheck.BaseRef); got != began {
		t.Fatalf("base is %s, want %s", got, began)
	}
}

func TestMarkBasesRecordsWhereTheBranchLeftTheDefaultBranch(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	dir := t.TempDir()
	origin := filepath.Join(dir, "origin")
	repository := filepath.Join(dir, "widgets")

	if err := os.MkdirAll(origin, 0o755); err != nil {
		t.Fatal(err)
	}
	git(t, origin, "init", "--quiet", "--initial-branch", "develop")
	git(t, origin, "commit", "--quiet", "--allow-empty", "--message", "start")
	branched := git(t, origin, "rev-parse", "HEAD")

	git(t, dir, "clone", "--quiet", origin, repository)
	git(t, repository, "switch", "--quiet", "-c", "task")
	git(t, repository, "commit", "--quiet", "--allow-empty", "--message", "an earlier run")

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	markBases(context.Background(), dir, []protocol.Checkout{{Path: "widgets"}}, logger)

	if got := git(t, repository, "rev-parse", stackcheck.BaseRef); got != branched {
		t.Fatalf("base is %s, want where the branch left develop, %s", got, branched)
	}
}

func TestAgentToolsLeaveOutWhatTheRunnerDoesItself(t *testing.T) {
	given := []protocol.ToolManifest{{Name: "pull-request"}, {Name: "change-stack"}}

	got := toolNames(agentTools(given))
	if len(got) != 1 || got[0] != "pull-request" {
		t.Fatalf("agent tools %v", got)
	}
	if len(given) != 2 {
		t.Fatalf("the run's own manifest changed: %v", given)
	}
}
