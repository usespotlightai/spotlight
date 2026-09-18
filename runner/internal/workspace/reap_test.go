package workspace_test

import (
	"os"
	"path/filepath"
	"testing"

	"usespotlight.ai/runner/internal/workspace"
)

func held(t *testing.T, root, key string) string {
	t.Helper()

	space, err := workspace.Create(root, key)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	state, err := space.State()
	if err != nil {
		t.Fatalf("state: %v", err)
	}
	if err := os.WriteFile(filepath.Join(state, "history"), []byte("kept"), 0o600); err != nil {
		t.Fatal(err)
	}

	return space.Dir
}

func TestReapDisposesOfWhatNothingWillReturnFor(t *testing.T) {
	root := t.TempDir()
	wanted := held(t, root, "task_1-station_1")
	spent := held(t, root, "task_2-station_1")

	reaped, err := workspace.Reap(root, []string{"task_1-station_1"})
	if err != nil {
		t.Fatalf("reap: %v", err)
	}

	if reaped != 1 {
		t.Errorf("disposed of %d", reaped)
	}
	if _, err := os.Stat(filepath.Join(wanted, workspace.StatePath, "history")); err != nil {
		t.Errorf("a wanted workspace did not survive: %v", err)
	}
	if _, err := os.Stat(spent); !os.IsNotExist(err) {
		t.Errorf("a spent workspace outlived the sweep: %v", err)
	}
}

func TestReapDisposesOfEverythingWhenNothingIsWanted(t *testing.T) {
	root := t.TempDir()
	held(t, root, "task_1-station_1")
	held(t, root, "task_2-station_1")

	reaped, err := workspace.Reap(root, nil)
	if err != nil {
		t.Fatalf("reap: %v", err)
	}

	if reaped != 2 {
		t.Errorf("disposed of %d", reaped)
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Errorf("%d left behind", len(entries))
	}
}

func TestReapLeavesAnythingThatIsNotAWorkspaceAlone(t *testing.T) {
	root := t.TempDir()
	stray := filepath.Join(root, "a-file-someone-left")
	if err := os.WriteFile(stray, []byte("not mine"), 0o600); err != nil {
		t.Fatal(err)
	}

	if _, err := workspace.Reap(root, nil); err != nil {
		t.Fatalf("reap: %v", err)
	}

	if _, err := os.Stat(stray); err != nil {
		t.Errorf("a file was taken for a workspace: %v", err)
	}
}

func TestReapIsContentWithARootThatWasNeverMade(t *testing.T) {
	reaped, err := workspace.Reap(filepath.Join(t.TempDir(), "never"), nil)

	if err != nil || reaped != 0 {
		t.Errorf("reaped %d: %v", reaped, err)
	}
}
