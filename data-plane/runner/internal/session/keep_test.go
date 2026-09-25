package session_test

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

type keptArchives struct {
	mu      sync.Mutex
	server  *httptest.Server
	objects map[string][]byte
	granted map[string]protocol.ArchiveRequest
	sealed  []string
	issued  int
	spoil   bool

	slow          time.Duration
	putting       bool
	renewedMidPut int
}

func (k *keptArchives) renewed() {
	k.mu.Lock()
	defer k.mu.Unlock()
	if k.putting {
		k.renewedMidPut++
	}
}

func newKeptArchives(t *testing.T) *keptArchives {
	t.Helper()

	kept := &keptArchives{
		objects: map[string][]byte{},
		granted: map[string]protocol.ArchiveRequest{},
	}
	kept.server = httptest.NewServer(http.HandlerFunc(kept.serve))
	t.Cleanup(kept.server.Close)

	return kept
}

func (k *keptArchives) serve(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/objects/")

	if r.Method == http.MethodPut {
		body, _ := io.ReadAll(r.Body)
		k.mu.Lock()
		k.putting = true
		slow := k.slow
		k.mu.Unlock()

		time.Sleep(slow)

		k.mu.Lock()
		k.putting = false
		k.objects[id] = body
		k.mu.Unlock()
		return
	}

	k.mu.Lock()
	defer k.mu.Unlock()

	switch r.Method {
	case http.MethodGet:
		body, held := k.objects[id]
		if !held {
			http.NotFound(w, r)
			return
		}
		if k.spoil {
			body = append([]byte{}, body...)
			body[len(body)/2] ^= 0xff
		}
		_, _ = w.Write(body)
	}
}

func (k *keptArchives) grant(size int64, sha string) protocol.ArchiveGrant {
	k.mu.Lock()
	defer k.mu.Unlock()

	k.issued++
	id := fmt.Sprintf("archive_%d", k.issued)
	k.granted[id] = protocol.ArchiveRequest{Size: size, SHA256: sha}

	return protocol.ArchiveGrant{ID: id, URL: k.server.URL + "/objects/" + id}
}

func (k *keptArchives) seal(id string) error {
	k.mu.Lock()
	defer k.mu.Unlock()

	body, held := k.objects[id]
	granted := k.granted[id]
	sum := sha256.Sum256(body)

	if !held || int64(len(body)) != granted.Size || hex.EncodeToString(sum[:]) != granted.SHA256 {
		return errors.New("409 Conflict: not uploaded as granted")
	}

	k.sealed = append(k.sealed, id)
	return nil
}

func (k *keptArchives) newest() *protocol.HeldArchive {
	k.mu.Lock()
	defer k.mu.Unlock()

	if len(k.sealed) == 0 {
		return nil
	}

	id := k.sealed[len(k.sealed)-1]
	granted := k.granted[id]

	return &protocol.HeldArchive{
		ID:     id,
		URL:    k.server.URL + "/objects/" + id,
		Size:   granted.Size,
		SHA256: granted.SHA256,
	}
}

func (k *keptArchives) count() int {
	k.mu.Lock()
	defer k.mu.Unlock()
	return len(k.sealed)
}

func step(t *testing.T, written *journal, name string) string {
	t.Helper()

	for _, event := range written.typed(protocol.EventOutput) {
		if event.Message == name {
			return string(event.Data)
		}
	}
	return ""
}

const carriedOn = "task_1-station_1"

func TestKeepsTheWorkspaceForTheNextRunInAFreshSandbox(t *testing.T) {
	kept := newKeptArchives(t)

	first := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); said = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = kept
			o.continuity = protocol.Continuity{Key: carriedOn}
		})

	if got := step(t, first, "archive"); !strings.HasPrefix(got, "Captured the workspace") {
		t.Fatalf("the first run said %q about keeping its workspace", got)
	}

	second := run(t, harness(t, `said = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"),
		func(o *runOptions) {
			o.archives = kept
			o.continuity = protocol.Continuity{Key: carriedOn, SessionID: "session_held"}
		})

	if got := said(t, second); got != "halfway" {
		t.Errorf("the next run found %q in the workspace", got)
	}
	if got := step(t, second, "restore"); !strings.HasPrefix(got, "Restored the workspace") {
		t.Errorf("the next run said %q about restoring", got)
	}
}

func TestCoalescesAWorkspaceNothingChangedIn(t *testing.T) {
	kept := newKeptArchives(t)
	continuing := func(o *runOptions) {
		o.archives = kept
		o.continuity = protocol.Continuity{Key: carriedOn, SessionID: "session_held"}
	}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); said = "wrote";`, "end_turn"), continuing)
	second := run(t, harness(t, `said = "looked";`, "end_turn"), continuing)

	if got := step(t, second, "archive"); !strings.HasPrefix(got, "Coalesced") {
		t.Errorf("a run that changed nothing said %q about keeping its workspace", got)
	}
	if kept.count() != 1 {
		t.Errorf("%d archives were sealed, wanted the one", kept.count())
	}
}

func TestSkipsKeepingAWorkspaceWithNowhereToKeepIt(t *testing.T) {
	written := run(t, harness(t, `said = "worked";`, "end_turn"), func(o *runOptions) {
		o.continuity = protocol.Continuity{Key: carriedOn}
	})

	if got := step(t, written, "archive"); !strings.HasPrefix(got, "Skipped: ") || !strings.Contains(got, "nowhere to keep") {
		t.Errorf("said %q about keeping its workspace", got)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("a workspace it could not keep failed the run: %+v", written.done)
	}
}

func TestRestoresOverWhatTheImageLaidDown(t *testing.T) {
	kept := newKeptArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); said = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = kept
			o.continuity = protocol.Continuity{Key: carriedOn}
		})

	baked := t.TempDir()
	if err := os.WriteFile(filepath.Join(baked, "notes.md"), []byte("from the image"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(baked, "stale.md"), []byte("from the image"), 0o644); err != nil {
		t.Fatal(err)
	}

	second := run(t, harness(t, `said = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"),
		func(o *runOptions) {
			o.root = baked
			o.archives = kept
			o.continuity = protocol.Continuity{Key: carriedOn, SessionID: "session_held"}
		})

	if got := said(t, second); got != "halfway" {
		t.Errorf("the next run found %q in the workspace", got)
	}
	if _, err := os.Stat(filepath.Join(baked, "stale.md")); !os.IsNotExist(err) {
		t.Errorf("what the image laid down outlived the restore: %v", err)
	}
}

func TestStartsAfreshFromAnArchiveThatIsNotTheOneKept(t *testing.T) {
	kept := newKeptArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); said = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = kept
			o.continuity = protocol.Continuity{Key: carriedOn}
		})

	kept.spoil = true
	root := t.TempDir()
	second := run(t, harness(t, `said = require("node:fs").existsSync("notes.md") ? "restored" : "afresh";`, "end_turn"),
		func(o *runOptions) {
			o.root = root
			o.archives = kept
			o.continuity = protocol.Continuity{Key: carriedOn, SessionID: "session_held"}
		})

	if got := said(t, second); got != "afresh" {
		t.Errorf("the run found the workspace %s", got)
	}
	if got := step(t, second, "restore"); !strings.HasPrefix(got, "Started afresh") {
		t.Errorf("said %q about restoring", got)
	}
	if _, err := os.Stat(filepath.Join(root, "notes.md")); !os.IsNotExist(err) {
		t.Errorf("a spoiled archive left files behind: %v", err)
	}
}

func TestHoldsTheRunWhileItKeepsTheWorkspace(t *testing.T) {
	kept := newKeptArchives(t)
	kept.slow = 5 * time.Second

	written := run(t, harness(t, `said = "worked";`, "end_turn"), func(o *runOptions) {
		o.archives = kept
		o.continuity = protocol.Continuity{Key: carriedOn}
		o.stopAfter = 1
	})

	if got := step(t, written, "archive"); !strings.HasPrefix(got, "Captured the workspace") {
		t.Fatalf("said %q about keeping its workspace", got)
	}

	kept.mu.Lock()
	defer kept.mu.Unlock()
	if kept.renewedMidPut < 2 {
		t.Errorf("the lease was renewed %d times during a five-second upload of a run asked to stop", kept.renewedMidPut)
	}
}
