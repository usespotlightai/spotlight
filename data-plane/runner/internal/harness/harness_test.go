package harness_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/harness"
)

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

func TestDiscoversModelsFromTheCommand(t *testing.T) {
	dir := t.TempDir()
	script := filepath.Join(dir, "lister")
	body := "#!/bin/sh\n" +
		"echo 'Available models:'\n" +
		"echo 'sonnet-4.5'\n" +
		"echo 'gpt-5   (default)'\n" +
		"echo 'sonnet-4.5'\n" +
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

func TestReadsTheVersionTheHarnessReports(t *testing.T) {
	for _, expected := range []struct {
		printed string
		version string
	}{
		{"2.1.270 (Claude Code)", "2.1.270"},
		{"v1.4.0", "1.4.0"},
		{"cursor-agent 2026.09.01-abc", "2026.09.01-abc"},
		{"codex-cli\n0.46.0\n", "0.46.0"},
		{"garbage", ""},
		{"", ""},
	} {
		dir := t.TempDir()
		script := "#!/bin/sh\nprintf '%s\\n' '" + expected.printed + "'\n"
		if err := os.WriteFile(filepath.Join(dir, "versioned"), []byte(script), 0o755); err != nil {
			t.Fatal(err)
		}
		t.Setenv("PATH", dir)

		found := harness.Installed(context.Background(), []protocol.Installable{
			{ID: "versioned", Executable: "versioned", VersionProbe: []string{"versioned", "--version"}},
		})

		if len(found) != 1 || found[0].Version != expected.version {
			t.Errorf("%q: got %+v, want version %q", expected.printed, found, expected.version)
		}
	}
}

func TestReportsNoVersionWhenItCannotBeRead(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "broken"), []byte("#!/bin/sh\necho 1.2.3\nexit 1\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)

	found := harness.Installed(context.Background(), []protocol.Installable{
		{ID: "broken", Executable: "broken", VersionProbe: []string{"broken"}},
		{ID: "unasked", Executable: "broken"},
	})

	if len(found) != 2 || found[0].Version != "" || found[1].Version != "" {
		t.Fatalf("got %+v", found)
	}
}
