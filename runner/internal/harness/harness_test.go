package harness_test

import (
	"os"
	"path/filepath"
	"testing"

	"usespotlight.ai/runner/internal/harness"
	"usespotlight.ai/runner/internal/protocol"
)

// onPath puts a runnable file where LookPath will find it, and answers with
// its name.
func onPath(t *testing.T, name string) string {
	t.Helper()

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, name), []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)

	return name
}

func TestReportsWhatIsThere(t *testing.T) {
	executable := onPath(t, "here")

	found := harness.Installed([]protocol.Installable{
		{ID: "the-one-here", Executable: executable},
	})

	if len(found) != 1 || found[0] != "the-one-here" {
		t.Fatalf("got %v", found)
	}
}

// A harness the control plane knows about but this machine does not have is
// simply left out: the runner says what it has, not what it was asked about.
func TestLeavesOutWhatIsNotThere(t *testing.T) {
	onPath(t, "here")

	found := harness.Installed([]protocol.Installable{
		{ID: "the-one-here", Executable: "here"},
		{ID: "not-here", Executable: "nothing-of-that-name"},
	})

	if len(found) != 1 || found[0] != "the-one-here" {
		t.Fatalf("got %v", found)
	}
}

func TestNothingAskedAboutIsNothingReported(t *testing.T) {
	if found := harness.Installed(nil); len(found) != 0 {
		t.Fatalf("got %v", found)
	}
}

// The runner reads no meaning into the list, so a malformed entry is skipped
// rather than guessed at.
func TestSkipsAnEntryThatNamesNothing(t *testing.T) {
	onPath(t, "here")

	found := harness.Installed([]protocol.Installable{
		{ID: "", Executable: "here"},
		{ID: "no-executable", Executable: ""},
	})

	if len(found) != 0 {
		t.Fatalf("got %v", found)
	}
}
