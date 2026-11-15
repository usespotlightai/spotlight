package session

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

type imageLine struct {
	source, mirrors, installs, record string
	space                             *workspace.Workspace
	log                               *slog.Logger
}

func newImageLine(t *testing.T) *imageLine {
	t.Helper()
	line := &imageLine{
		source: t.TempDir(), mirrors: t.TempDir(),
		installs: filepath.Join(t.TempDir(), "installs"), record: filepath.Join(t.TempDir(), "setups.json"),
		log: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	warmGit(t, line.source, "init", "--quiet", "--initial-branch", "main")
	writeFile(t, filepath.Join(line.source, ".gitignore"), "node_modules\n")
	writeFile(t, filepath.Join(line.source, "package-lock.json"), "{}")
	warmGit(t, line.source, "add", ".")
	warmGit(t, line.source, "commit", "--quiet", "-m", "one")
	warmGit(t, line.mirrors, "clone", "--quiet", "--bare", line.source, filepath.Join(line.mirrors, "web.git"))

	space, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	line.space = space
	return line
}

func (l *imageLine) setup() string {
	return "mkdir -p node_modules && echo installed >> " + l.installs
}

func (l *imageLine) installed(t *testing.T) int {
	t.Helper()
	body, err := os.ReadFile(l.installs)
	if os.IsNotExist(err) {
		return 0
	}
	if err != nil {
		t.Fatal(err)
	}
	return strings.Count(string(body), "installed")
}

func (l *imageLine) recorded(t *testing.T) protocol.SetupRecord {
	t.Helper()
	body, err := os.ReadFile(l.record)
	if err != nil {
		t.Fatal(err)
	}
	var record protocol.SetupRecord
	if err := json.Unmarshal(body, &record); err != nil {
		t.Fatal(err)
	}
	return record
}

// fromImage is a new container started from the image of the last warm sandbox: same files, nothing in memory.
func (l *imageLine) fromImage() *Sandbox {
	return &Sandbox{space: l.space, kept: &kept{archives: true}}
}

func (l *imageLine) warm(t *testing.T, sandbox *Sandbox) {
	t.Helper()
	sandbox.readPristine(l.record, l.log)
	if err := sandbox.Warm(context.Background(), protocol.WarmSandbox{
		Line: "line_1", Checkouts: []protocol.WarmCheckout{{Path: "web", Setup: l.setup()}},
	}, WarmOptions{Mirrors: l.mirrors, Log: l.log, SetupRecord: l.record}); err != nil {
		t.Fatal(err)
	}
}

func (l *imageLine) firstRun(t *testing.T, sandbox *Sandbox) {
	t.Helper()
	if sandbox.setUp == nil {
		sandbox.setUp = sandbox.firstSetups(l.record, l.log)
	}
	sandbox.pristine = nil
	if failures, _ := (Options{}).setUp(context.Background(), l.space.Dir,
		[]protocol.Checkout{{Path: "web", Setup: l.setup()}}, sandbox.setUp, &journalWriter{}, l.log); len(failures) > 0 {
		t.Fatalf("setup failed: %+v", failures)
	}
}

func TestASandboxFromAWarmSandboxsImageSkipsTheSetupTheWarmSandboxRan(t *testing.T) {
	line := newImageLine(t)

	line.warm(t, line.fromImage())
	if record := line.recorded(t); !record.Complete || !record.Ran || record.Checkouts["web"] == "" {
		t.Fatalf("the warm sandbox recorded %+v", record)
	}

	line.firstRun(t, line.fromImage())

	if got := line.installed(t); got != 1 {
		t.Errorf("setup ran %d times, want 1: a sandbox from the image must find its setup", got)
	}
}

func TestOnlyTheFirstRunOfASandboxTrustsItsImagesSetups(t *testing.T) {
	line := newImageLine(t)
	line.warm(t, line.fromImage())

	sandbox := line.fromImage()
	line.firstRun(t, sandbox)
	sandbox.setUp = nil
	line.firstRun(t, sandbox)

	if got := line.installed(t); got != 2 {
		t.Errorf("setup ran %d times, want 2: a later run that drops its setups must not fall back on the image's", got)
	}
}

func TestAWarmSandboxFromAnUpToDateImageRunsNoSetupAndSaysSo(t *testing.T) {
	line := newImageLine(t)
	line.warm(t, line.fromImage())

	line.warm(t, line.fromImage())

	if got := line.installed(t); got != 1 {
		t.Errorf("setup ran %d times, want 1", got)
	}
	if record := line.recorded(t); !record.Complete || record.Ran {
		t.Errorf("a warm sandbox that ran nothing recorded %+v; the host would commit an image with nothing new", record)
	}
}

func TestAWarmSandboxFromAnOlderImageMovesToTheMirrorAndSetsUpWhatChanged(t *testing.T) {
	line := newImageLine(t)
	line.warm(t, line.fromImage())
	before := line.recorded(t).Checkouts["web"]

	writeFile(t, filepath.Join(line.source, "package-lock.json"), `{"lockfileVersion":3}`)
	warmGit(t, line.source, "commit", "--quiet", "-am", "two")
	warmGit(t, filepath.Join(line.mirrors, "web.git"), "fetch", "--quiet", line.source, "+refs/heads/*:refs/heads/*")

	line.warm(t, line.fromImage())

	if got := line.installed(t); got != 2 {
		t.Errorf("setup ran %d times, want 2: the new lockfile needs a setup", got)
	}
	body, err := os.ReadFile(filepath.Join(line.space.Dir, "web", "package-lock.json"))
	if err != nil || string(body) != `{"lockfileVersion":3}` {
		t.Errorf("the clone is still at the image's commit: %q, %v", body, err)
	}
	if record := line.recorded(t); !record.Ran || record.Checkouts["web"] == before {
		t.Errorf("recorded %+v, want the new inputs", record)
	}
}

func TestAWarmSandboxWhoseSetupFailedRecordsAnIncompleteSetup(t *testing.T) {
	line := newImageLine(t)
	sandbox := line.fromImage()
	sandbox.readPristine(line.record, line.log)
	if err := sandbox.Warm(context.Background(), protocol.WarmSandbox{
		Line: "line_1", Checkouts: []protocol.WarmCheckout{{Path: "web", Setup: "exit 3"}},
	}, WarmOptions{Mirrors: line.mirrors, Log: line.log, SetupRecord: line.record}); err != nil {
		t.Fatal(err)
	}

	if record := line.recorded(t); record.Complete {
		t.Errorf("recorded %+v as complete", record)
	}
	if got := readSetupRecord(line.record, line.log); got != nil {
		t.Errorf("a sandbox from this image would trust %v", got)
	}
}

func TestRestoringOverAnImageKeepsWhatItsSetupsPutInPlace(t *testing.T) {
	line := newImageLine(t)
	line.warm(t, line.fromImage())

	sandbox := line.fromImage()
	sandbox.readPristine(line.record, line.log)
	kept := sandbox.keptFromImage(context.Background(), line.log)

	if !slices.Contains(kept, "web/node_modules") {
		t.Errorf("a restore would keep %v, not web/node_modules", kept)
	}
}

func TestAWarmSandboxWhoseImageLostTheCloneSetsUpAgain(t *testing.T) {
	line := newImageLine(t)
	line.warm(t, line.fromImage())
	if err := os.RemoveAll(filepath.Join(line.space.Dir, "web")); err != nil {
		t.Fatal(err)
	}

	line.warm(t, line.fromImage())

	if got := line.installed(t); got != 2 {
		t.Errorf("setup ran %d times, want 2: a fresh clone has nothing the record says was set up", got)
	}
}

func TestASetupWithSpacesAroundItMatchesTheImagesSetup(t *testing.T) {
	line := newImageLine(t)
	line.warm(t, line.fromImage())

	sandbox := line.fromImage()
	sandbox.setUp = sandbox.firstSetups(line.record, line.log)
	if failures, _ := (Options{}).setUp(context.Background(), line.space.Dir,
		[]protocol.Checkout{{Path: "web", Setup: "  " + line.setup() + "\n"}}, sandbox.setUp, &journalWriter{}, line.log); len(failures) > 0 {
		t.Fatalf("setup failed: %+v", failures)
	}

	if got := line.installed(t); got != 1 {
		t.Errorf("setup ran %d times, want 1", got)
	}
}

func TestAWarmSandboxWhoseSetupFailsLeavesNoRecordOfTheImage(t *testing.T) {
	line := newImageLine(t)
	line.warm(t, line.fromImage())

	sandbox := line.fromImage()
	sandbox.readPristine(line.record, line.log)
	writeFile(t, filepath.Join(line.source, "package-lock.json"), `{"v":2}`)
	warmGit(t, line.source, "commit", "--quiet", "-am", "two")
	warmGit(t, filepath.Join(line.mirrors, "web.git"), "fetch", "--quiet", line.source, "+refs/heads/*:refs/heads/*")
	if err := sandbox.Warm(context.Background(), protocol.WarmSandbox{
		Line: "line_1", Checkouts: []protocol.WarmCheckout{{Path: "web", Setup: line.setup() + " && exit 3"}},
	}, WarmOptions{Mirrors: line.mirrors, Log: line.log, SetupRecord: line.record}); err != nil {
		t.Fatal(err)
	}

	if record := line.recorded(t); record.Complete || !record.Ran {
		t.Errorf("recorded %+v", record)
	}
}
