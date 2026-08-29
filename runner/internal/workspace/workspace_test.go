package workspace_test

import (
	"os"
	"path/filepath"
	"testing"

	"usespotlight.ai/runner/internal/workspace"
)

func TestCreateMakesAnEmptyDirectoryForTheRun(t *testing.T) {
	root := t.TempDir()

	space, err := workspace.Create(root, "run_1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if space.Dir != filepath.Join(root, "run_1") {
		t.Errorf("dir %q", space.Dir)
	}

	entries, err := os.ReadDir(space.Dir)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("expected an empty directory, found %d entries", len(entries))
	}
}

func TestCreateLeavesTheRootTraversableButNotListable(t *testing.T) {
	root := filepath.Join(t.TempDir(), "workspaces")

	if _, err := workspace.Create(root, "run_1"); err != nil {
		t.Fatalf("create: %v", err)
	}

	info, err := os.Stat(root)
	if err != nil {
		t.Fatal(err)
	}
	// An agent must reach its own workspace without enumerating its neighbours.
	if mode := info.Mode().Perm(); mode&0o001 == 0 || mode&0o004 != 0 {
		t.Errorf("root mode %o", mode)
	}
}

func TestResolveDefaultsToTheWorkspaceItself(t *testing.T) {
	space, err := workspace.Create(t.TempDir(), "run_1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	cwd, err := space.Resolve("")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if cwd != space.Dir {
		t.Errorf("cwd %q", cwd)
	}
}

func TestResolveFindsWhatTheHookCreated(t *testing.T) {
	space, err := workspace.Create(t.TempDir(), "run_1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := os.Mkdir(filepath.Join(space.Dir, "service"), 0o700); err != nil {
		t.Fatal(err)
	}

	cwd, err := space.Resolve("service")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if cwd != filepath.Join(space.Dir, "service") {
		t.Errorf("cwd %q", cwd)
	}
}

func TestResolveRefusesWhatIsNotThere(t *testing.T) {
	space, err := workspace.Create(t.TempDir(), "run_1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if _, err := space.Resolve("never-cloned"); err == nil {
		t.Error("a cwd the hook did not create should be refused")
	}
}

func TestResolveRefusesAPathOutOfTheWorkspace(t *testing.T) {
	space, err := workspace.Create(t.TempDir(), "run_1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if _, err := space.Resolve("../escape"); err == nil {
		t.Error("an escaping cwd should be refused")
	}
}

func TestRemoveDisposesOfWhatItMade(t *testing.T) {
	root := t.TempDir()

	space, err := workspace.Create(root, "run_1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := os.WriteFile(filepath.Join(space.Dir, "left-behind"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := space.Remove(); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if _, err := os.Stat(space.Dir); !os.IsNotExist(err) {
		t.Error("the workspace should be gone")
	}
	if _, err := os.Stat(root); err != nil {
		t.Error("the root is not this package's to remove")
	}
}

func TestStateMakesADirectoryInsideTheWorkspace(t *testing.T) {
	space, err := workspace.Create(t.TempDir(), "run_1")
	if err != nil {
		t.Fatalf("create: %v", err)
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

func TestCreateReusesWhatASharedKeyAlreadyHolds(t *testing.T) {
	root := t.TempDir()

	first, err := workspace.Create(root, "task_1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	state, err := first.State()
	if err != nil {
		t.Fatalf("state: %v", err)
	}
	if err := os.WriteFile(filepath.Join(state, "history"), []byte("kept"), 0o600); err != nil {
		t.Fatal(err)
	}

	second, err := workspace.Create(root, "task_1")
	if err != nil {
		t.Fatalf("create again: %v", err)
	}

	kept, err := os.ReadFile(filepath.Join(second.Dir, workspace.StatePath, "history"))
	if err != nil || string(kept) != "kept" {
		t.Errorf("the second run did not find what the first left: %v", err)
	}
}
