package harness_test

import (
	"context"
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

	found := harness.Installed(context.Background(), []protocol.Installable{
		{ID: "the-one-here", Executable: executable},
	})

	if len(found) != 1 || found[0].ID != "the-one-here" {
		t.Fatalf("got %v", found)
	}
}

// A harness the control plane knows about but this machine does not have is
// simply left out: the runner says what it has, not what it was asked about.
func TestLeavesOutWhatIsNotThere(t *testing.T) {
	onPath(t, "here")

	found := harness.Installed(context.Background(), []protocol.Installable{
		{ID: "the-one-here", Executable: "here"},
		{ID: "not-here", Executable: "nothing-of-that-name"},
	})

	if len(found) != 1 || found[0].ID != "the-one-here" {
		t.Fatalf("got %v", found)
	}
}

// A discovery command's stdout is read a model id per line: the first token of
// each line, when it looks like an id. Headers and decorations are left out.
func TestDiscoversModelsFromTheCommand(t *testing.T) {
	dir := t.TempDir()
	script := filepath.Join(dir, "lister")
	body := "#!/bin/sh\n" +
		"echo 'Available models:'\n" +
		"echo 'sonnet-4.5'\n" +
		"echo 'gpt-5   (default)'\n" +
		"echo 'sonnet-4.5'\n" + // a repeat is reported once
		"echo 'GARBAGE'\n"
	if err := os.WriteFile(script, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)

	found := harness.Installed(context.Background(), []protocol.Installable{
		{ID: "lister", Executable: "lister", Discovery: []string{"lister"}},
	})

	if len(found) != 1 {
		t.Fatalf("got %v", found)
	}
	got := found[0].Models
	want := []string{"sonnet-4.5", "gpt-5"}
	if len(got) != len(want) {
		t.Fatalf("models: got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("models: got %v, want %v", got, want)
		}
	}
}

// A harness with no discovery command, or one that fails, simply reports no
// models: the control plane falls back to what it knows.
func TestReportsNoModelsWithoutDiscovery(t *testing.T) {
	executable := onPath(t, "bare")

	found := harness.Installed(context.Background(), []protocol.Installable{
		{ID: "bare", Executable: executable},
	})

	if len(found) != 1 || len(found[0].Models) != 0 {
		t.Fatalf("got %v", found)
	}
}

func TestNothingAskedAboutIsNothingReported(t *testing.T) {
	if found := harness.Installed(context.Background(), nil); len(found) != 0 {
		t.Fatalf("got %v", found)
	}
}

// The runner reads no meaning into the list, so a malformed entry is skipped
// rather than guessed at.
func TestSkipsAnEntryThatNamesNothing(t *testing.T) {
	onPath(t, "here")

	found := harness.Installed(context.Background(), []protocol.Installable{
		{ID: "", Executable: "here"},
		{ID: "no-executable", Executable: ""},
	})

	if len(found) != 0 {
		t.Fatalf("got %v", found)
	}
}
