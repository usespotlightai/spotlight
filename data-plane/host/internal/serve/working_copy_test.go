package serve_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/host/internal/serve"
	"usespotlight.ai/data-plane/protocol"
)

// workingCopies keeps working copies as directories, and records what the host asks of the store.
type workingCopies struct {
	mu        sync.Mutex
	root      string
	unfit     error
	missing   string
	opened    []string
	from      []string
	closed    []string
	made      []string
	removed   []string
	left      []string
	checks    int
	openFails error
}

type workingCopy struct {
	store *workingCopies
	name  string
	dir   string
}

func newWorkingCopies(t *testing.T) *workingCopies {
	t.Helper()

	// A unix socket path must be short, so keep the copies under a short temporary directory.
	root, err := os.MkdirTemp("", "wc")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(root) })
	return &workingCopies{root: root}
}

func (w *workingCopies) Check(context.Context, protocol.WorkingCopyStore) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.checks++
	return w.unfit
}

func (w *workingCopies) Open(_ context.Context, _ protocol.WorkingCopyStore, name, from string) (serve.WorkingCopy, bool, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.openFails != nil {
		return nil, false, w.openFails
	}
	w.opened = append(w.opened, name)
	w.from = append(w.from, from)
	dir := filepath.Join(w.root, name)
	for _, each := range []string{"workspace", "socket"} {
		if err := os.MkdirAll(filepath.Join(dir, each), 0o755); err != nil {
			return nil, false, err
		}
	}
	return &workingCopy{store: w, name: name, dir: dir}, from != "" && from != w.missing, nil
}

func (w *workingCopies) Adopt(name string) (serve.WorkingCopy, bool) {
	dir := filepath.Join(w.root, name)
	if _, err := os.Stat(dir); err != nil {
		return nil, false
	}
	return &workingCopy{store: w, name: name, dir: dir}, true
}

func (w *workingCopies) Left() []string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return slices.Clone(w.left)
}

func (w *workingCopies) RemoveSnapshot(_ context.Context, _ protocol.WorkingCopyStore, snapshot string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.removed = append(w.removed, snapshot)
	return nil
}

func (w *workingCopies) closes() []string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return slices.Clone(w.closed)
}

func (c *workingCopy) Dir() string     { return filepath.Join(c.dir, "workspace") }
func (c *workingCopy) Sockets() string { return filepath.Join(c.dir, "socket") }

func (c *workingCopy) Snapshot(_ context.Context, name string) error {
	c.store.mu.Lock()
	defer c.store.mu.Unlock()
	c.store.made = append(c.store.made, name)
	return nil
}

func (c *workingCopy) Close(context.Context) error {
	c.store.mu.Lock()
	defer c.store.mu.Unlock()
	c.store.closed = append(c.store.closed, c.name)
	return os.RemoveAll(c.dir)
}

func inStore(pool *pool) {
	base := "base-v1"
	pool.workingCopies = &protocol.WorkingCopyStore{Store: "s3://team-a", Base: &base}
}

func continuing(runner string) protocol.Assignment {
	work := assignment(runner)
	work.Work.Run.Spec.Resume.Key = "task-task_1"
	return work
}

func TestMountsTheWorkingCopyItRestoresAsTheWorkspace(t *testing.T) {
	engine, pool, copies := harnessed(), newPool(), newWorkingCopies(t)
	inStore(pool)
	descends := "base-v0"
	pool.restores = &protocol.StoredArchive{
		ID: "archive_1", Snapshot: &protocol.StoredSnapshot{Store: "s3://team-a", Name: "spotlight-archive_1", Base: &descends},
	}
	opts := options(t)
	opts.WorkingCopies = copies
	serving(t, opts, engine, pool)

	pool.work <- continuing("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	started := engine.sandbox(engine.workSandboxes()[0])

	if !slices.Equal(copies.from, []string{"spotlight-archive_1"}) {
		t.Errorf("opened the working copies from %q", copies.from)
	}
	for _, mount := range []sandbox.Mount{
		{Source: filepath.Join(copies.root, "runner_1", "workspace"), Target: protocol.SandboxWorkspace},
		{Source: filepath.Join(copies.root, "runner_1", "socket"), Target: protocol.SandboxHostDir},
	} {
		if !slices.Contains(started.Mounts, mount) {
			t.Errorf("mounted %+v, without %+v", started.Mounts, mount)
		}
	}
	for _, variable := range []string{
		"SPOTLIGHT_WORKING_COPY_STORE=s3://team-a",
		"SPOTLIGHT_WORKING_COPY_RESTORED=archive_1", "SPOTLIGHT_WORKSPACE=/workspace",
		"SPOTLIGHT_WORKING_COPY_BASE=base-v0",
	} {
		if !slices.Contains(started.Env, variable) {
			t.Errorf("the sandbox lacks %s: %v", variable, started.Env)
		}
	}

	engine.finish(engine.workSandboxes()[0])
	eventually(t, "the working copy released", func() bool { return slices.Equal(copies.closes(), []string{"runner_1"}) })
}

func TestStartsAWorkingCopyFromTheBaseWhenItsArchiveIsElsewhere(t *testing.T) {
	for name, restores := range map[string]*protocol.StoredArchive{
		"a tar":              {ID: "archive_1", URL: "https://archives.example.com/archive_1"},
		"another store":      {ID: "archive_1", Snapshot: &protocol.StoredSnapshot{Store: "s3://team-b", Name: "spotlight-archive_1"}},
		"nothing to restore": nil,
	} {
		t.Run(name, func(t *testing.T) {
			engine, pool, copies := harnessed(), newPool(), newWorkingCopies(t)
			inStore(pool)
			pool.restores = restores
			opts := options(t)
			opts.WorkingCopies = copies
			serving(t, opts, engine, pool)

			pool.work <- continuing("runner_1")
			eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
			started := engine.sandbox(engine.workSandboxes()[0])

			if !slices.Equal(copies.from, []string{""}) {
				t.Errorf("opened the working copy from %q", copies.from)
			}
			if slices.ContainsFunc(started.Env, func(each string) bool { return strings.HasPrefix(each, protocol.WorkingCopyRestoredVar) }) {
				t.Errorf("said it restored an archive: %v", started.Env)
			}
		})
	}
}

func TestSaysTheHostRestoredNothingWhenItCouldNotOpenTheSnapshot(t *testing.T) {
	engine, pool, copies := harnessed(), newPool(), newWorkingCopies(t)
	inStore(pool)
	copies.missing = "spotlight-archive_1"
	pool.restores = &protocol.StoredArchive{
		ID: "archive_1", Snapshot: &protocol.StoredSnapshot{Store: "s3://team-a", Name: "spotlight-archive_1"},
	}
	opts := options(t)
	opts.WorkingCopies = copies
	serving(t, opts, engine, pool)

	pool.work <- continuing("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	if env := engine.sandbox(engine.workSandboxes()[0]).Env; slices.Contains(env, "SPOTLIGHT_WORKING_COPY_RESTORED=archive_1") {
		t.Errorf("said it restored a snapshot it could not open: %v", env)
	}
}

func TestGivesAWorkingCopyOnlyToWorkThatKeepsItsWorkspace(t *testing.T) {
	engine, pool, copies := harnessed(), newPool(), newWorkingCopies(t)
	inStore(pool)
	opts := options(t)
	opts.WorkingCopies = copies
	serving(t, opts, engine, pool)

	pool.work <- assignment("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	if len(copies.opened) != 0 {
		t.Errorf("opened working copies %q for a run that keeps no workspace", copies.opened)
	}
	if env := engine.sandbox(engine.workSandboxes()[0]).Env; slices.ContainsFunc(env, func(each string) bool { return strings.HasPrefix(each, protocol.WorkingCopyStoreVar) }) {
		t.Errorf("told the runner of a working copy it has none of: %v", env)
	}
}

func TestGivesASandboxAWorkingCopyThatItsRunsKeep(t *testing.T) {
	engine, pool, copies := harnessed(), newPool(), newWorkingCopies(t)
	engine.keepsFile = true
	inStore(pool)
	opts := options(t)
	opts.WorkingCopies = copies
	serving(t, opts, engine, pool)

	pool.work <- sandboxOnly("sandbox_r")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	if !slices.Equal(copies.opened, []string{"sandbox-sandbox_r"}) {
		t.Errorf("opened working copies %q", copies.opened)
	}
	if len(pool.asked) != 1 || pool.asked[0].SandboxID != "sandbox_r" {
		t.Errorf("asked for the archives of %+v", pool.asked)
	}
}

func TestMakesTheSnapshotTheSandboxAsksForOnItsSocket(t *testing.T) {
	engine, pool, copies := harnessed(), newPool(), newWorkingCopies(t)
	inStore(pool)
	opts := options(t)
	opts.WorkingCopies = copies
	serving(t, opts, engine, pool)

	pool.work <- continuing("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })

	socket := filepath.Join(copies.root, "runner_1", "socket", "host.sock")
	client := http.Client{Transport: &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		var dialer net.Dialer
		return dialer.DialContext(ctx, "unix", socket)
	}}}
	ask := func(name string) int {
		body, _ := json.Marshal(protocol.HostSnapshotRequest{Snapshot: name})
		response, err := client.Post("http://host"+protocol.HostSnapshotPath, "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("ask the host: %v", err)
		}
		defer response.Body.Close()
		return response.StatusCode
	}

	if status := ask("spotlight-archive_2"); status != http.StatusNoContent {
		t.Errorf("the host answered %d", status)
	}
	for _, name := range []string{
		"base-v1", "spotlight-", "spotlight-../base-v1", "spotlight-a/b", "spotlight-..", "spotlight-a b",
		"spotlight-" + strings.Repeat("a", 65),
	} {
		if status := ask(name); status != http.StatusBadRequest {
			t.Errorf("the host answered %d to %q, which Spotlight never grants", status, name)
		}
	}
	if status := ask("spotlight-archive_2"); status != http.StatusConflict {
		t.Errorf("the host answered %d to a snapshot this sandbox had made already", status)
	}
	if !slices.Equal(copies.made, []string{"spotlight-archive_2"}) {
		t.Errorf("made the snapshots %q", copies.made)
	}
}

func TestFailsTheWorkWhenItsWorkingCopyDoesNotOpen(t *testing.T) {
	engine, pool, copies := harnessed(), newPool(), newWorkingCopies(t)
	inStore(pool)
	copies.openFails = errors.New("the store is unreachable")
	opts := options(t)
	opts.WorkingCopies = copies
	serving(t, opts, engine, pool)

	pool.work <- continuing("runner_1")
	eventually(t, "the run failed", func() bool {
		done, ok := pool.runClient.completion("run-runner_1")
		return ok && done.Failed && strings.Contains(done.Message, "working copy didn't open")
	})

	if len(engine.workSandboxes()) != 0 {
		t.Error("started a sandbox with no working copy")
	}
}

func TestClaimsNothingWhileItCannotServeTheStoreOfItsPool(t *testing.T) {
	for name, copies := range map[string]*workingCopies{
		"no working copy hook": nil,
		"a host without ublk":  {unfit: errors.New("unsupported: /dev/ublk-control is missing")},
	} {
		t.Run(name, func(t *testing.T) {
			engine, pool := harnessed(), newPool()
			inStore(pool)
			opts := options(t)
			if copies != nil {
				opts.WorkingCopies = copies
			}
			serving(t, opts, engine, pool)

			time.Sleep(200 * time.Millisecond)

			pool.mu.Lock()
			claims := pool.claims
			pool.mu.Unlock()
			if claims != 0 {
				t.Errorf("claimed %d times", claims)
			}
		})
	}
}

func TestReleasesWorkingCopiesThatNoSandboxRunsInAnyMore(t *testing.T) {
	engine, pool, copies := harnessed(), newPool(), newWorkingCopies(t)
	inStore(pool)
	if err := os.MkdirAll(filepath.Join(copies.root, "runner_gone"), 0o755); err != nil {
		t.Fatal(err)
	}
	copies.left = []string{"runner_gone"}
	opts := options(t)
	opts.WorkingCopies = copies
	serving(t, opts, engine, pool)

	eventually(t, "the left working copy released", func() bool { return slices.Equal(copies.closes(), []string{"runner_gone"}) })
}

func TestRemovesTheSnapshotsOfRemovedArchives(t *testing.T) {
	engine, pool, copies := harnessed(), newPool(), newWorkingCopies(t)
	inStore(pool)
	remote := "s3://team-a"
	pool.removals = protocol.SnapshotRemovals{Store: &remote, Removals: []protocol.SnapshotRemoval{
		{ArchiveID: "archive_1", Snapshot: "spotlight-archive_1"},
		{ArchiveID: "archive_2", Snapshot: "base-v1"},
		{ArchiveID: "archive_3", Snapshot: "spotlight-../base-v1"},
	}}
	opts := options(t)
	opts.WorkingCopies = copies
	serving(t, opts, engine, pool)

	eventually(t, "the snapshot removed", func() bool {
		pool.mu.Lock()
		defer pool.mu.Unlock()
		return slices.Equal(pool.forgotten, []string{"archive_1"})
	})

	copies.mu.Lock()
	defer copies.mu.Unlock()
	if !slices.Equal(copies.removed, []string{"spotlight-archive_1"}) {
		t.Errorf("removed the snapshots %q", copies.removed)
	}
}

func TestOpensFromTheCurrentBaseWhenTheRunStartsAfresh(t *testing.T) {
	engine, pool, copies := harnessed(), newPool(), newWorkingCopies(t)
	inStore(pool)
	descends := "base-v0"
	pool.restores = &protocol.StoredArchive{
		ID: "archive_1",
		Snapshot: &protocol.StoredSnapshot{
			Store: "s3://team-a", Name: "spotlight-archive_1", Base: &descends, Rebase: true,
		},
	}
	opts := options(t)
	opts.WorkingCopies = copies
	serving(t, opts, engine, pool)

	pool.work <- continuing("runner_1")
	eventually(t, "a sandbox", func() bool { return len(engine.workSandboxes()) == 1 })
	env := engine.sandbox(engine.workSandboxes()[0]).Env

	if !slices.Equal(copies.from, []string{""}) {
		t.Errorf("opened the working copy from %q", copies.from)
	}
	for _, variable := range []string{"SPOTLIGHT_WORKING_COPY_REBASE=archive_1", "SPOTLIGHT_WORKING_COPY_BASE=base-v1"} {
		if !slices.Contains(env, variable) {
			t.Errorf("the sandbox lacks %s: %v", variable, env)
		}
	}
	if slices.ContainsFunc(env, func(each string) bool { return strings.HasPrefix(each, protocol.WorkingCopyRestoredVar) }) {
		t.Errorf("said it restored the archive it passed over: %v", env)
	}
}
