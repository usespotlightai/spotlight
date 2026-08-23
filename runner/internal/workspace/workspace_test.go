package workspace_test

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/workspace"
)

// origin builds a real repository to clone from: git's behaviour is the thing
// under test, so faking it would test nothing.
func origin(t *testing.T, name string) string {
	t.Helper()

	dir := filepath.Join(t.TempDir(), name)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}

	write(t, filepath.Join(dir, "README.md"), "# "+name)
	run(t, dir, "init", "--initial-branch=main")
	run(t, dir, "config", "user.email", "runner@spotlight.test")
	run(t, dir, "config", "user.name", "Runner")
	run(t, dir, "add", ".")
	run(t, dir, "commit", "-m", "first")

	return dir
}

func write(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
}

func run(t *testing.T, dir string, args ...string) string {
	t.Helper()
	command := exec.Command("git", args...)
	command.Dir = dir
	out, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v: %s", strings.Join(args, " "), err, out)
	}
	return string(out)
}

func TestPrepareClonesEveryCheckout(t *testing.T) {
	service, sdk := origin(t, "service"), origin(t, "sdk")
	root := t.TempDir()

	space, err := workspace.Prepare(context.Background(), root, protocol.Run{
		ID: "run_1",
		Checkouts: []protocol.Checkout{
			{Remote: service, Path: "service", Branch: "spot/run_1"},
			{Remote: sdk, Path: "sdk", Branch: "spot/run_1"},
		},
		Cwd: "service",
	})
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}
	t.Cleanup(func() { _ = space.Remove() })

	for _, path := range []string{"service/README.md", "sdk/README.md"} {
		if _, err := os.Stat(filepath.Join(space.Dir, path)); err != nil {
			t.Errorf("expected %s: %v", path, err)
		}
	}

	if space.Cwd != filepath.Join(space.Dir, "service") {
		t.Errorf("cwd %q", space.Cwd)
	}

	branch := strings.TrimSpace(run(t, space.Cwd, "rev-parse", "--abbrev-ref", "HEAD"))
	if branch != "spot/run_1" {
		t.Errorf("branch %q", branch)
	}
}

func TestPrepareDefaultsToTheOnlyCheckout(t *testing.T) {
	root := t.TempDir()

	space, err := workspace.Prepare(context.Background(), root, protocol.Run{
		ID:        "run_2",
		Checkouts: []protocol.Checkout{{Remote: origin(t, "service"), Path: "service"}},
	})
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}
	t.Cleanup(func() { _ = space.Remove() })

	if space.Cwd != filepath.Join(space.Dir, "service") {
		t.Errorf("cwd %q", space.Cwd)
	}
}

func TestPrepareRefusesAPathOutOfTheWorkspace(t *testing.T) {
	root := t.TempDir()

	_, err := workspace.Prepare(context.Background(), root, protocol.Run{
		ID:        "run_3",
		Checkouts: []protocol.Checkout{{Remote: origin(t, "service"), Path: "../escape"}},
	})
	if err == nil {
		t.Fatal("expected an escaping path to be refused")
	}
}

func TestPrepareLeavesNothingBehindWhenACheckoutFails(t *testing.T) {
	root := t.TempDir()

	_, err := workspace.Prepare(context.Background(), root, protocol.Run{
		ID: "run_4",
		Checkouts: []protocol.Checkout{
			{Remote: origin(t, "service"), Path: "service"},
			{Remote: filepath.Join(root, "nope"), Path: "missing"},
		},
	})
	if err == nil {
		t.Fatal("expected a missing remote to fail")
	}

	if _, err := os.Stat(filepath.Join(root, "run_4")); !os.IsNotExist(err) {
		t.Error("a failed prepare should leave no workspace behind")
	}
}

func TestDiffReportsWhatChanged(t *testing.T) {
	root := t.TempDir()

	space, err := workspace.Prepare(context.Background(), root, protocol.Run{
		ID:        "run_5",
		Checkouts: []protocol.Checkout{{Remote: origin(t, "service"), Path: "service"}},
	})
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}
	t.Cleanup(func() { _ = space.Remove() })

	write(t, filepath.Join(space.Cwd, "added.txt"), "new")

	diff, err := space.Diff(context.Background(), "service")
	if err != nil {
		t.Fatalf("diff: %v", err)
	}
	if !strings.Contains(diff, "added.txt") {
		t.Errorf("diff %q", diff)
	}
}

func TestRemoveDisposesOfTheWorkspace(t *testing.T) {
	root := t.TempDir()

	space, err := workspace.Prepare(context.Background(), root, protocol.Run{
		ID:        "run_6",
		Checkouts: []protocol.Checkout{{Remote: origin(t, "service"), Path: "service"}},
	})
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}

	if err := space.Remove(); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if _, err := os.Stat(space.Dir); !os.IsNotExist(err) {
		t.Error("workspace should be gone")
	}
}
