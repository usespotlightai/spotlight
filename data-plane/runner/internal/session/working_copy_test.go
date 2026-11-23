package session_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/session"
)

const store = "s3://team-a"

type hostSnapshots struct {
	mu    sync.Mutex
	made  []string
	fails error
}

func (h *hostSnapshots) Snapshot(_ context.Context, name string) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.fails != nil {
		return h.fails
	}
	h.made = append(h.made, name)
	return nil
}

func inStore(archives *archives, root string, host *session.HostWorkingCopy) func(*runOptions) {
	return func(o *runOptions) {
		o.archives = archives
		o.resume = protocol.Resume{Key: resumeKey}
		o.root = root
		o.workingCopy = host
	}
}

func TestSavesTheWorkspaceAsASnapshotTheHostMakes(t *testing.T) {
	archives := newArchives(t)
	host := &hostSnapshots{}

	written := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		inStore(archives, t.TempDir(), &session.HostWorkingCopy{Store: store, Host: host}))

	if got := step(t, written, "archive"); got != "Captured the workspace for the next run (snapshot spotlight-archive_1)" {
		t.Errorf("the run said %q about archiving its workspace", got)
	}
	if len(host.made) != 1 || host.made[0] != "spotlight-archive_1" {
		t.Errorf("the host made the snapshots %q", host.made)
	}
	if len(archives.objects) != 0 {
		t.Errorf("the run uploaded %d archives to Spotlight", len(archives.objects))
	}
	if archives.count() != 1 {
		t.Errorf("%d archives were completed", archives.count())
	}
}

func TestTakesTheWorkspaceTheHostRestoredFromItsSnapshot(t *testing.T) {
	archives := newArchives(t)
	kept := t.TempDir()
	host := &hostSnapshots{}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		inStore(archives, kept, &session.HostWorkingCopy{Store: store, Host: host}))

	second := run(t, harness(t, `output = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"),
		inStore(archives, kept, &session.HostWorkingCopy{Store: store, Restored: "archive_1", Host: host}))

	if got := step(t, second, "restore"); got != "Restored the workspace the last run left, from snapshot spotlight-archive_1" {
		t.Errorf("the next run said %q about restoring", got)
	}
	if got := agentOutput(t, second); got != "halfway" {
		t.Errorf("the next run found %q in the workspace", got)
	}
}

func TestStartsAfreshWhenTheWorkingCopyIsInAStoreThisHostDoesNotReach(t *testing.T) {
	archives := newArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		inStore(archives, t.TempDir(), &session.HostWorkingCopy{Store: store, Host: &hostSnapshots{}}))

	elsewhere := run(t, harness(t, `output = String(require("node:fs").existsSync("notes.md"));`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.resume = protocol.Resume{Key: resumeKey}
		})

	if got := step(t, elsewhere, "restore"); got != "Started afresh: the last run kept the working copy in store s3://team-a, which this host does not reach" {
		t.Errorf("a run on a host without the store said %q about restoring", got)
	}
	if got := agentOutput(t, elsewhere); got != "false" {
		t.Errorf("a run on a host without the store found notes.md: %q", got)
	}
}

func TestStartsAfreshWhenTheHostCouldNotOpenTheSnapshot(t *testing.T) {
	archives := newArchives(t)
	host := &hostSnapshots{}

	run(t, harness(t, `output = "wrote";`, "end_turn"),
		inStore(archives, t.TempDir(), &session.HostWorkingCopy{Store: store, Host: host}))
	second := run(t, harness(t, `output = "again";`, "end_turn"),
		inStore(archives, t.TempDir(), &session.HostWorkingCopy{Store: store, Host: host}))

	if got := step(t, second, "restore"); got != "Started afresh: the host could not open the working copy from snapshot spotlight-archive_1" {
		t.Errorf("the run said %q about restoring", got)
	}
}

func TestMovesATarArchiveIntoTheWorkingCopyOfTheHost(t *testing.T) {
	archives := newArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.resume = protocol.Resume{Key: resumeKey}
		})

	host := &hostSnapshots{}
	moved := run(t, harness(t, `output = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"),
		inStore(archives, t.TempDir(), &session.HostWorkingCopy{Store: store, Host: host}))

	if got := step(t, moved, "restore"); !strings.HasPrefix(got, "Restored the workspace the last run left (") {
		t.Errorf("the run on a host with a store said %q about restoring a tar", got)
	}
	if got := agentOutput(t, moved); got != "halfway" {
		t.Errorf("the run found %q in the workspace", got)
	}
	if got := step(t, moved, "archive"); got != "Captured the workspace for the next run (snapshot spotlight-archive_2)" {
		t.Errorf("the run said %q about archiving", got)
	}
}

func TestSkipsTheArchiveWhenTheHostCannotMakeTheSnapshot(t *testing.T) {
	archives := newArchives(t)
	host := &hostSnapshots{fails: errors.New("the store is not reachable")}

	written := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		inStore(archives, t.TempDir(), &session.HostWorkingCopy{Store: store, Host: host}))

	if got := step(t, written, "archive"); got != "Skipped: make the snapshot: the store is not reachable" {
		t.Errorf("the run said %q about archiving", got)
	}
	if archives.count() != 0 {
		t.Errorf("%d archives were completed without a snapshot", archives.count())
	}
}

func TestOpensASandboxOnTheWorkingCopyTheHostRestored(t *testing.T) {
	archives := newArchives(t)
	kept := t.TempDir()
	host := &hostSnapshots{}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		inStore(archives, kept, &session.HostWorkingCopy{Store: store, Host: host}))

	sandbox := new(session.Sandbox)
	options := sandboxOptions(kept, &sandboxArchives{archives: archives})
	options.WorkingCopy = &session.HostWorkingCopy{Store: store, Restored: "archive_1", Host: host}
	if err := sandbox.Open(context.Background(), options); err != nil {
		t.Fatalf("open: %v", err)
	}

	if err := os.WriteFile(filepath.Join(kept, "more.md"), []byte("later"), 0o644); err != nil {
		t.Fatal(err)
	}
	sandbox.Archive(context.Background(), options)

	if len(host.made) != 2 || host.made[1] != "spotlight-archive_2" {
		t.Errorf("the sandbox had the host make the snapshots %q", host.made)
	}
	if len(archives.objects) != 0 {
		t.Errorf("the sandbox uploaded %d archives to Spotlight", len(archives.objects))
	}
}

func TestStartsFromTheCurrentBaseWhenTheHostReopenedARunThatStartsAfresh(t *testing.T) {
	archives := newArchives(t)
	host := &hostSnapshots{}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		inStore(archives, t.TempDir(), &session.HostWorkingCopy{Store: store, Base: "base-v1", Host: host}))
	fresh := run(t, harness(t, `output = String(require("node:fs").existsSync("notes.md"));`, "end_turn"),
		inStore(archives, t.TempDir(), &session.HostWorkingCopy{Store: store, Rebased: "archive_1", Base: "base-v2", Host: host}))

	if got := step(t, fresh, "restore"); got != "Started from base base-v2 of the store: this run starts no session, and the last working copy descends from base base-v1" {
		t.Errorf("the run said %q about restoring", got)
	}
	if failedStep(t, fresh, "restore") {
		t.Error("starting from the current base counted as a failed restore")
	}

	archives.mu.Lock()
	defer archives.mu.Unlock()
	for id, want := range map[string]string{"archive_1": "base-v1", "archive_2": "base-v2"} {
		if got := archives.granted[id].Snapshot.Base; got == nil || *got != want {
			t.Errorf("%s was granted as descending from %v, want %s", id, got, want)
		}
	}
}

func TestSavesAWorkingCopyThatStartedWithoutABase(t *testing.T) {
	archives := newArchives(t)

	run(t, harness(t, `output = "wrote";`, "end_turn"),
		inStore(archives, t.TempDir(), &session.HostWorkingCopy{Store: store, Host: &hostSnapshots{}}))

	archives.mu.Lock()
	defer archives.mu.Unlock()
	if base := archives.granted["archive_1"].Snapshot.Base; base != nil {
		t.Errorf("a working copy without a base was granted as descending from %q", *base)
	}
}

func failedStep(t *testing.T, written *journal, name string) bool {
	t.Helper()

	for _, event := range written.typed(protocol.EventStepEnded) {
		if event.Message == name {
			var ended protocol.StepEnd
			if err := json.Unmarshal(event.Data, &ended); err != nil {
				t.Fatal(err)
			}
			return ended.Failed
		}
	}
	t.Fatalf("no %s step", name)
	return false
}
