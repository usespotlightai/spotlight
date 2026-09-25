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
	"usespotlight.ai/data-plane/runner/internal/stackcheck"
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
	marked := markBases(context.Background(), dir, []protocol.Checkout{{Path: "widgets"}, {Path: "missing"}}, logger)

	git(t, repository, "commit", "--quiet", "--allow-empty", "--message", "work")

	if got := git(t, repository, "rev-parse", stackcheck.BaseRef); got != began {
		t.Fatalf("base is %s, want %s", got, began)
	}
	if marked["widgets"] != began {
		t.Fatalf("reported %q, want %s", marked["widgets"], began)
	}
	if _, told := marked["missing"]; told {
		t.Fatalf("reported a base for a checkout that is not there: %q", marked["missing"])
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
	marked := markBases(context.Background(), dir, []protocol.Checkout{{Path: "widgets"}}, logger)

	if got := git(t, repository, "rev-parse", stackcheck.BaseRef); got != branched {
		t.Fatalf("base is %s, want where the branch left develop, %s", got, branched)
	}
	if marked["widgets"] != branched {
		t.Fatalf("reported %q, want %s", marked["widgets"], branched)
	}
}

func TestToolNamesAreTheManifestsOwn(t *testing.T) {
	given := []protocol.ToolManifest{{Name: "pull-request"}, {Name: "propose-task"}}

	got := toolNames(given)
	if len(got) != 2 || got[0] != "pull-request" || got[1] != "propose-task" {
		t.Fatalf("tool names %v", got)
	}
}
