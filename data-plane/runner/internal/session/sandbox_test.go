package session_test

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/session"
)

func TestATurnArchivesTheWorkspaceThenReportsAndTheRunIsOver(t *testing.T) {
	written := run(t, harness(t, `output = "asked";`, "end_turn"), func(o *runOptions) {
		o.archives = newArchives(t)
		o.resume = protocol.Resume{Key: resumeKey}
		o.handover = []string{"review"}
	})

	if !slices.Equal(written.calls, []string{"archive", "complete"}) {
		t.Errorf("the turn end went %v", written.calls)
	}
	if len(written.completions) != 1 {
		t.Errorf("completions %+v", written.completions)
	}
}

func TestALaterRunInTheSameSandboxKeepsTheWorkspaceAndRestoresNothing(t *testing.T) {
	archives := newArchives(t)
	root := t.TempDir()
	sandbox := new(session.Sandbox)
	inSandbox := func(o *runOptions) {
		o.root = root
		o.sandbox = sandbox
		o.archives = archives
		o.resume = protocol.Resume{Key: resumeKey}
	}

	first := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "asked"); output = "asked";`, "end_turn"), inSandbox)
	if first.restores != 1 {
		t.Fatalf("the first run looked for an archive %d times", first.restores)
	}
	if err := os.WriteFile(filepath.Join(root, "left.txt"), []byte("left by a dev server"), 0o644); err != nil {
		t.Fatal(err)
	}

	second := run(t, harness(t, `const fs = require("node:fs");
output = fs.readFileSync("notes.md", "utf8") + " | " + fs.readFileSync("left.txt", "utf8") + " | " + msg.params.prompt[0].text;`, "end_turn"),
		inSandbox, func(o *runOptions) {
			o.runID = "run_1"
			o.resume = protocol.Resume{Key: resumeKey, SessionID: "session_known", ResumeSession: true}
			o.messages = [][]protocol.Message{{{Position: 3, Body: "go ahead"}}}
		})

	if second.restores != 0 {
		t.Errorf("the later run looked for an archive %d times", second.restores)
	}
	if got := agentOutput(t, second); got != "asked | left by a dev server | go ahead" {
		t.Errorf("the answered run found %q", got)
	}
	if got := step(t, second, "restore"); !strings.HasPrefix(got, "Kept the workspace") {
		t.Errorf("the later run said %q about its workspace", got)
	}
}

func TestALaterRunSaysItStartedFromTheArchiveTheLastRunLeft(t *testing.T) {
	archives := newArchives(t)
	root := t.TempDir()
	sandbox := new(session.Sandbox)
	inSandbox := func(o *runOptions) {
		o.root = root
		o.sandbox = sandbox
		o.archives = archives
		o.resume = protocol.Resume{Key: resumeKey}
		o.starting = true
	}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "first"); output = "first";`, "end_turn"), inSandbox)
	left := archives.newest()
	if left == nil {
		t.Fatal("the first run left no archive")
	}

	second := run(t, harness(t, `output = "second";`, "end_turn"), inSandbox, func(o *runOptions) { o.runID = "run_2" })

	if len(second.starts) != 1 || second.starts[0].ArchiveID == nil || *second.starts[0].ArchiveID != left.ID {
		t.Errorf("the later run said it started from %+v, wanted archive %s", second.starts, left.ID)
	}
}

type sandboxArchives struct {
	archives *archives
	restores int
	grants   int
}

func (s *sandboxArchives) WorkspaceArchive(context.Context) (*protocol.StoredArchive, error) {
	s.restores++
	return s.archives.newest(), nil
}

func (s *sandboxArchives) GrantArchive(_ context.Context, size int64, sha256 string) (protocol.ArchiveGrant, error) {
	s.grants++
	return s.archives.grant(size, sha256), nil
}

func (s *sandboxArchives) CompleteArchive(_ context.Context, archiveID string) error {
	return s.archives.complete(archiveID)
}

func sandboxOptions(root string, archives *sandboxArchives) session.SandboxOptions {
	return session.SandboxOptions{
		Workspace: root,
		Archives:  archives,
		Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

func TestASandboxRestoresTheNewestArchiveBeforeItsFirstRun(t *testing.T) {
	archives := newArchives(t)
	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "left"); output = "left";`, "end_turn"), func(o *runOptions) {
		o.archives = archives
		o.resume = protocol.Resume{Key: resumeKey}
	})
	if archives.newest() == nil {
		t.Fatal("the earlier run left no archive")
	}

	root := t.TempDir()
	sandbox := new(session.Sandbox)
	own := &sandboxArchives{archives: archives}
	if err := sandbox.Open(context.Background(), sandboxOptions(root, own)); err != nil {
		t.Fatal(err)
	}
	if own.restores != 1 {
		t.Fatalf("the sandbox looked for an archive %d times", own.restores)
	}
	if body, err := os.ReadFile(filepath.Join(root, "notes.md")); err != nil || string(body) != "left" {
		t.Fatalf("the sandbox restored %q, %v", body, err)
	}

	first := run(t, harness(t, `output = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.sandbox = sandbox
		o.archives = archives
		o.resume = protocol.Resume{Key: resumeKey}
	})

	if first.restores != 0 {
		t.Errorf("the first run looked for an archive %d times", first.restores)
	}
	if got := agentOutput(t, first); got != "left" {
		t.Errorf("the first run found %q", got)
	}
}

func TestASandboxWithNoRunStartsEmptyWhenNothingWasArchived(t *testing.T) {
	root := t.TempDir()
	own := &sandboxArchives{archives: newArchives(t)}
	sandbox := new(session.Sandbox)

	if err := sandbox.Open(context.Background(), sandboxOptions(root, own)); err != nil {
		t.Fatal(err)
	}
	sandbox.Archive(context.Background(), sandboxOptions(root, own))

	if own.grants != 0 {
		t.Errorf("an unchanged empty workspace was archived %d times", own.grants)
	}
}

func TestASandboxArchivesEditsMadeBetweenRunsWithItsOwnToken(t *testing.T) {
	archives := newArchives(t)
	root := t.TempDir()
	own := &sandboxArchives{archives: archives}
	sandbox := new(session.Sandbox)
	if err := sandbox.Open(context.Background(), sandboxOptions(root, own)); err != nil {
		t.Fatal(err)
	}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "run"); output = "run";`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.sandbox = sandbox
		o.archives = archives
		o.resume = protocol.Resume{Key: resumeKey}
	})
	afterRun := archives.count()

	sandbox.Archive(context.Background(), sandboxOptions(root, own))
	if own.grants != 0 {
		t.Fatalf("archived %d times though nothing changed since the run archived", own.grants)
	}

	if err := os.WriteFile(filepath.Join(root, "notes.md"), []byte("edited in the editor"), 0o644); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	sandbox.Archive(ctx, sandboxOptions(root, own))

	if own.grants != 1 || archives.count() != afterRun+1 {
		t.Fatalf("granted %d, completed %d archives", own.grants, archives.count()-afterRun)
	}

	fresh := t.TempDir()
	if err := new(session.Sandbox).Open(context.Background(), sandboxOptions(fresh, &sandboxArchives{archives: archives})); err != nil {
		t.Fatal(err)
	}
	if body, err := os.ReadFile(filepath.Join(fresh, "notes.md")); err != nil || string(body) != "edited in the editor" {
		t.Errorf("the next sandbox restored %q, %v", body, err)
	}
}

func TestASandboxDoesNotArchiveAfterARunThatKeepsNoWorkspace(t *testing.T) {
	archives := newArchives(t)
	root := t.TempDir()
	own := &sandboxArchives{archives: archives}
	sandbox := new(session.Sandbox)
	if err := sandbox.Open(context.Background(), sandboxOptions(root, own)); err != nil {
		t.Fatal(err)
	}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "run"); output = "run";`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.sandbox = sandbox
		o.archives = archives
	})
	sandbox.Archive(context.Background(), sandboxOptions(root, own))

	if own.grants != 0 {
		t.Errorf("archived %d times after a run with no resume key", own.grants)
	}
}
