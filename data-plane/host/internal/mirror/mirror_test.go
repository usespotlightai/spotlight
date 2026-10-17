package mirror_test

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/host/internal/mirror"
)

func run(t *testing.T, dir string, args ...string) string {
	t.Helper()

	command := exec.Command("git", args...)
	command.Dir = dir
	command.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
	out, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v: %s", args, err, out)
	}

	return strings.TrimSpace(string(out))
}

func upstream(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	run(t, dir, "init", "--quiet", "--initial-branch", "main")
	if err := os.WriteFile(filepath.Join(dir, "README"), []byte("one\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	run(t, dir, "add", ".")
	run(t, dir, "commit", "--quiet", "-m", "one")

	return dir
}

func TestMirrorsARepositoryThenKeepsItUpToDate(t *testing.T) {
	source := upstream(t)
	mirrors := mirror.At(t.TempDir())
	fetch := mirror.Fetch{Workspace: "workspace_1", Repository: "api", Remote: source, Token: "one-run"}

	dir, err := mirrors.Refresh(context.Background(), fetch)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if got, ok := mirrors.Dir("workspace_1", "api"); !ok || got != dir {
		t.Fatalf("dir %q %v, want %q", got, ok, dir)
	}

	first := run(t, source, "rev-parse", "HEAD")
	if got := run(t, dir, "rev-parse", "refs/heads/main"); got != first {
		t.Errorf("mirrored %s, want %s", got, first)
	}

	if err := os.WriteFile(filepath.Join(source, "README"), []byte("two\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	run(t, source, "commit", "--quiet", "-am", "two")

	if _, err := mirrors.Refresh(context.Background(), fetch); err != nil {
		t.Fatalf("refresh again: %v", err)
	}
	if got, want := run(t, dir, "rev-parse", "refs/heads/main"), run(t, source, "rev-parse", "HEAD"); got != want {
		t.Errorf("mirrored %s, want %s", got, want)
	}
}

func TestACheckoutBorrowsFromTheMirrorAndIsIndependent(t *testing.T) {
	source := upstream(t)
	mirrors := mirror.At(t.TempDir())

	dir, err := mirrors.Refresh(context.Background(), mirror.Fetch{
		Workspace: "workspace_1", Repository: "api", Remote: source,
	})
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}

	checkout := filepath.Join(t.TempDir(), "api")
	run(t, "", "clone", "--quiet", "--reference-if-able", dir, "--dissociate", source, checkout)

	if _, err := os.Stat(filepath.Join(checkout, ".git/objects/info/alternates")); !os.IsNotExist(err) {
		t.Errorf("the checkout still leans on the mirror: %v", err)
	}
}

func TestAFailedFirstFetchLeavesNoMirrorBehind(t *testing.T) {
	root := t.TempDir()
	mirrors := mirror.At(root)

	_, err := mirrors.Refresh(context.Background(), mirror.Fetch{
		Workspace: "workspace_1", Repository: "api", Remote: filepath.Join(root, "missing"),
	})
	if err == nil {
		t.Fatal("expected the fetch to fail")
	}

	if _, ok := mirrors.Dir("workspace_1", "api"); ok {
		t.Error("a mirror was left behind")
	}
	entries, _ := os.ReadDir(filepath.Join(root, "workspace_1"))
	if len(entries) != 0 {
		t.Errorf("left %d entries behind", len(entries))
	}
}

func TestRefusesANameThatWouldLeaveTheMirrors(t *testing.T) {
	mirrors := mirror.At(t.TempDir())

	for _, repository := range []string{"../escape", "a/b", ""} {
		if _, err := mirrors.Refresh(context.Background(), mirror.Fetch{
			Workspace: "workspace_1", Repository: repository,
		}); err == nil {
			t.Errorf("%q was taken", repository)
		}
	}
}

func TestTidyingClearsWhatAKilledFetchLeft(t *testing.T) {
	source := upstream(t)
	root := t.TempDir()
	mirrors := mirror.At(root)

	dir, err := mirrors.Refresh(context.Background(), mirror.Fetch{Workspace: "workspace_1", Repository: "api", Remote: source})
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}

	stale := filepath.Join(dir, "refs", "heads", "main.lock")
	aside := filepath.Join(root, "workspace_1", ".api-12345")
	if err := os.WriteFile(stale, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(aside, 0o755); err != nil {
		t.Fatal(err)
	}

	if err := mirrors.Tidy(); err != nil {
		t.Fatalf("tidy: %v", err)
	}

	for _, left := range []string{stale, aside} {
		if _, err := os.Stat(left); !os.IsNotExist(err) {
			t.Errorf("%s is still there: %v", left, err)
		}
	}
	if _, err := mirrors.Refresh(context.Background(), mirror.Fetch{Workspace: "workspace_1", Repository: "api", Remote: source}); err != nil {
		t.Errorf("the mirror no longer fetches: %v", err)
	}
}
