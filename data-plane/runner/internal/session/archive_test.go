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

type archives struct {
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

func (a *archives) renewed() {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.putting {
		a.renewedMidPut++
	}
}

func newArchives(t *testing.T) *archives {
	t.Helper()

	archives := &archives{
		objects: map[string][]byte{},
		granted: map[string]protocol.ArchiveRequest{},
	}
	archives.server = httptest.NewServer(http.HandlerFunc(archives.serve))
	t.Cleanup(archives.server.Close)

	return archives
}

func (a *archives) serve(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/objects/")

	if r.Method == http.MethodPut {
		body, _ := io.ReadAll(r.Body)
		a.mu.Lock()
		a.putting = true
		slow := a.slow
		a.mu.Unlock()

		time.Sleep(slow)

		a.mu.Lock()
		a.putting = false
		a.objects[id] = body
		a.mu.Unlock()
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	switch r.Method {
	case http.MethodGet:
		body, found := a.objects[id]
		if !found {
			http.NotFound(w, r)
			return
		}
		if a.spoil {
			body = append([]byte{}, body...)
			body[len(body)/2] ^= 0xff
		}
		_, _ = w.Write(body)
	}
}

func (a *archives) grant(size int64, sha string) protocol.ArchiveGrant {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.issued++
	id := fmt.Sprintf("archive_%d", a.issued)
	a.granted[id] = protocol.ArchiveRequest{Size: size, SHA256: sha}

	return protocol.ArchiveGrant{ID: id, URL: a.server.URL + "/objects/" + id}
}

func (a *archives) seal(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	body, found := a.objects[id]
	granted := a.granted[id]
	sum := sha256.Sum256(body)

	if !found || int64(len(body)) != granted.Size || hex.EncodeToString(sum[:]) != granted.SHA256 {
		return errors.New("409 Conflict: not uploaded as granted")
	}

	a.sealed = append(a.sealed, id)
	return nil
}

func (a *archives) newest() *protocol.StoredArchive {
	a.mu.Lock()
	defer a.mu.Unlock()

	if len(a.sealed) == 0 {
		return nil
	}

	id := a.sealed[len(a.sealed)-1]
	granted := a.granted[id]

	return &protocol.StoredArchive{
		ID:     id,
		URL:    a.server.URL + "/objects/" + id,
		Size:   granted.Size,
		SHA256: granted.SHA256,
	}
}

func (a *archives) count() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return len(a.sealed)
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

const carriedOn = "task-task_1"

func TestArchivesTheWorkspaceForTheNextRunInAFreshSandbox(t *testing.T) {
	archives := newArchives(t)

	first := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.continuity = protocol.Continuity{Key: carriedOn}
		})

	if got := step(t, first, "archive"); !strings.HasPrefix(got, "Captured the workspace") {
		t.Fatalf("the first run said %q about archiving its workspace", got)
	}

	second := run(t, harness(t, `output = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.continuity = protocol.Continuity{Key: carriedOn, SessionID: "session_known"}
		})

	if got := agentOutput(t, second); got != "halfway" {
		t.Errorf("the next run found %q in the workspace", got)
	}
	if got := step(t, second, "restore"); !strings.HasPrefix(got, "Restored the workspace") {
		t.Errorf("the next run said %q about restoring", got)
	}
}

func TestRestoresTheWorkspaceForARunThatStartsItsConversationAfresh(t *testing.T) {
	archives := newArchives(t)
	carrying := func(o *runOptions) {
		o.archives = archives
		o.continuity = protocol.Continuity{Key: carriedOn}
	}

	first := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"), carrying)

	if got := step(t, first, "restore"); got != "" {
		t.Errorf("a run with nothing archived before it said %q about restoring", got)
	}

	second := run(t, harness(t, `output = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"), carrying)

	if got := agentOutput(t, second); got != "halfway" {
		t.Errorf("the next station's run found %q in the workspace", got)
	}
	if got := step(t, second, "restore"); !strings.HasPrefix(got, "Restored the workspace") {
		t.Errorf("the next station's run said %q about restoring", got)
	}
}

func TestCoalescesAWorkspaceNothingChangedIn(t *testing.T) {
	archives := newArchives(t)
	continuing := func(o *runOptions) {
		o.archives = archives
		o.continuity = protocol.Continuity{Key: carriedOn, SessionID: "session_known"}
	}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"), continuing)
	second := run(t, harness(t, `output = "looked";`, "end_turn"), continuing)

	if got := step(t, second, "archive"); !strings.HasPrefix(got, "Coalesced") {
		t.Errorf("a run that changed nothing said %q about archiving its workspace", got)
	}
	if archives.count() != 1 {
		t.Errorf("%d archives were sealed, wanted the one", archives.count())
	}
}

func TestSkipsArchivingAWorkspaceWithNowhereToStoreIt(t *testing.T) {
	written := run(t, harness(t, `output = "worked";`, "end_turn"), func(o *runOptions) {
		o.continuity = protocol.Continuity{Key: carriedOn}
	})

	if got := step(t, written, "archive"); !strings.HasPrefix(got, "Skipped: ") || !strings.Contains(got, "nowhere to store") {
		t.Errorf("said %q about archiving its workspace", got)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("a workspace it could not archive failed the run: %+v", written.done)
	}
}

func TestRestoresOverWhatTheImageLaidDown(t *testing.T) {
	archives := newArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.continuity = protocol.Continuity{Key: carriedOn}
		})

	baked := t.TempDir()
	if err := os.WriteFile(filepath.Join(baked, "notes.md"), []byte("from the image"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(baked, "stale.md"), []byte("from the image"), 0o644); err != nil {
		t.Fatal(err)
	}

	second := run(t, harness(t, `output = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"),
		func(o *runOptions) {
			o.root = baked
			o.archives = archives
			o.continuity = protocol.Continuity{Key: carriedOn, SessionID: "session_known"}
		})

	if got := agentOutput(t, second); got != "halfway" {
		t.Errorf("the next run found %q in the workspace", got)
	}
	if _, err := os.Stat(filepath.Join(baked, "stale.md")); !os.IsNotExist(err) {
		t.Errorf("what the image laid down outlived the restore: %v", err)
	}
}

func TestStartsAfreshFromAnArchiveThatIsNotTheOneStored(t *testing.T) {
	archives := newArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.continuity = protocol.Continuity{Key: carriedOn}
		})

	archives.spoil = true
	root := t.TempDir()
	second := run(t, harness(t, `output = require("node:fs").existsSync("notes.md") ? "restored" : "afresh";`, "end_turn"),
		func(o *runOptions) {
			o.root = root
			o.archives = archives
			o.continuity = protocol.Continuity{Key: carriedOn, SessionID: "session_known"}
		})

	if got := agentOutput(t, second); got != "afresh" {
		t.Errorf("the run found the workspace %s", got)
	}
	if got := step(t, second, "restore"); !strings.HasPrefix(got, "Started afresh") {
		t.Errorf("said %q about restoring", got)
	}
	if _, err := os.Stat(filepath.Join(root, "notes.md")); !os.IsNotExist(err) {
		t.Errorf("a spoiled archive left files behind: %v", err)
	}
}

func TestRenewsTheLeaseWhileItArchivesTheWorkspace(t *testing.T) {
	archives := newArchives(t)
	archives.slow = 5 * time.Second

	written := run(t, harness(t, `output = "worked";`, "end_turn"), func(o *runOptions) {
		o.archives = archives
		o.continuity = protocol.Continuity{Key: carriedOn}
		o.stopAfter = 1
	})

	if got := step(t, written, "archive"); !strings.HasPrefix(got, "Captured the workspace") {
		t.Fatalf("said %q about archiving its workspace", got)
	}

	archives.mu.Lock()
	defer archives.mu.Unlock()
	if archives.renewedMidPut < 2 {
		t.Errorf("the lease was renewed %d times during a five-second upload of a run that a person stopped", archives.renewedMidPut)
	}
}

func TestSaysWhereATaskRunStartedFromTheArchiveItRestored(t *testing.T) {
	archives := newArchives(t)
	reporting := func(o *runOptions) {
		o.archives = archives
		o.continuity = protocol.Continuity{Key: carriedOn}
		o.starting = true
	}

	first := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"), reporting)
	second := run(t, harness(t, `output = "read";`, "end_turn"), reporting)

	if len(first.starts) != 1 || first.starts[0].ArchiveID != nil {
		t.Errorf("the first run said it started from %+v, want no archive", first.starts)
	}
	if len(second.starts) != 1 || second.starts[0].ArchiveID == nil || *second.starts[0].ArchiveID != archives.newest().ID {
		t.Errorf("the next run said it started from %+v, want the archive it restored", second.starts)
	}
	if got := step(t, second, "start"); got != "" {
		t.Errorf("a start it could record said %q", got)
	}
}

func TestSaysNothingOfWhereARunStartedUnlessRequested(t *testing.T) {
	written := run(t, harness(t, `output = "worked";`, "end_turn"))

	if len(written.starts) != 0 {
		t.Errorf("a run that did not request it said it started from %+v", written.starts)
	}
}

func TestRunsOnWhenWhereItStartedCannotBeRecorded(t *testing.T) {
	written := run(t, harness(t, `output = "worked";`, "end_turn"), func(o *runOptions) {
		o.starting = true
		o.startErr = errors.New("409 Conflict: a run records where it started only when it works a task")
	})

	if got := step(t, written, "start"); !strings.HasPrefix(got, "Where the run started was not recorded: ") || !strings.Contains(got, "409") {
		t.Errorf("said %q about where it started", got)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("a start it could not record failed the run: %+v", written.done)
	}
	if got := agentOutput(t, written); got != "worked" {
		t.Errorf("output %q", got)
	}
}
