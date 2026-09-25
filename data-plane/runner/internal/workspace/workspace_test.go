package workspace_test

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"testing"

	"usespotlight.ai/data-plane/runner/internal/workspace"
)

func TestOpenMakesTheWorkspaceWhereItIsMissing(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "workspace")

	space, err := workspace.Open(dir)
	if err != nil {
		t.Fatalf("open: %v", err)
	}

	if space.Dir != dir {
		t.Errorf("dir %q", space.Dir)
	}
	if info, err := os.Stat(dir); err != nil || !info.IsDir() {
		t.Errorf("the workspace is not there: %v", err)
	}
}

func TestOpenKeepsWhatAnImageLaidDown(t *testing.T) {
	dir := t.TempDir()
	lay(t, filepath.Join(dir, "acme", "api", "go.sum"), "baked")

	if _, err := workspace.Open(dir); err != nil {
		t.Fatalf("open: %v", err)
	}

	if got, err := os.ReadFile(filepath.Join(dir, "acme", "api", "go.sum")); err != nil || string(got) != "baked" {
		t.Errorf("the baked checkout is gone: %v", err)
	}
}

func TestStateMakesADirectoryInsideTheWorkspace(t *testing.T) {
	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatalf("open: %v", err)
	}

	state, err := space.State()
	if err != nil {
		t.Fatalf("state: %v", err)
	}

	if state != filepath.Join(space.Dir, workspace.StatePath) {
		t.Errorf("state directory %q", state)
	}
	if info, err := os.Stat(state); err != nil || !info.IsDir() {
		t.Errorf("state directory is not there: %v", err)
	}
}

func TestClearKeepsOnlyWhatItIsAskedToKeep(t *testing.T) {
	dir := t.TempDir()
	lay(t, filepath.Join(dir, "acme", "api", "main.go"), "tracked")
	lay(t, filepath.Join(dir, "acme", "api", "node_modules", "left-pad", "index.js"), "installed")
	lay(t, filepath.Join(dir, "acme", "web", "index.html"), "another checkout")
	lay(t, filepath.Join(dir, ".spotlight", "state", "session"), "old")

	space, err := workspace.Open(dir)
	if err != nil {
		t.Fatal(err)
	}

	if err := space.Clear([]string{"acme/api/node_modules"}); err != nil {
		t.Fatalf("clear: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "acme", "api", "node_modules", "left-pad", "index.js")); err != nil {
		t.Errorf("what was kept is gone: %v", err)
	}
	for _, gone := range []string{"acme/api/main.go", "acme/web", ".spotlight"} {
		if _, err := os.Stat(filepath.Join(dir, gone)); !os.IsNotExist(err) {
			t.Errorf("%s is still there", gone)
		}
	}
}

func TestIgnoredNamesWhatACheckoutIgnores(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("no git")
	}

	dir := t.TempDir()
	tree := filepath.Join(dir, "acme", "api")
	lay(t, filepath.Join(tree, ".gitignore"), "node_modules/\n*.log\n")
	lay(t, filepath.Join(tree, "node_modules", "x", "index.js"), "installed")
	lay(t, filepath.Join(tree, "debug.log"), "noise")
	lay(t, filepath.Join(tree, "main.go"), "tracked")
	if output, err := exec.Command("git", "-C", tree, "init", "--quiet").CombinedOutput(); err != nil {
		t.Fatalf("init: %v: %s", err, output)
	}

	space, err := workspace.Open(dir)
	if err != nil {
		t.Fatal(err)
	}

	ignored, err := space.Ignored(context.Background(), []string{"acme/api", "acme/missing"})
	if err != nil {
		t.Fatalf("ignored: %v", err)
	}

	slices.Sort(ignored)
	if want := []string{"acme/api/debug.log", "acme/api/node_modules"}; !slices.Equal(ignored, want) {
		t.Errorf("ignored %v, want %v", ignored, want)
	}
}

func lay(t *testing.T, path, content string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
