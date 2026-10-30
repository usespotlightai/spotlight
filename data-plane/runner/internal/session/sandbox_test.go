package session_test

import (
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
