package serve

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/protocol"
)

const (
	workingCopyWait    = 10 * time.Minute
	snapshotRemoveEach = 5 * time.Minute
	socketStopBudget   = 5 * time.Second
)

// WorkingCopies keeps the workspaces of sandboxes in the store of the host's pool or trust, through the operator's
// working copy hook. What the store needs to be reached stays with the hook; the host never reads it.
type WorkingCopies interface {
	Check(ctx context.Context, store protocol.WorkingCopyStore) error
	// Open opens the working copy of the sandbox from the snapshot from, or from the store's base. It says whether
	// it opened from from.
	Open(ctx context.Context, store protocol.WorkingCopyStore, name, from string) (WorkingCopy, bool, error)
	// Adopt takes over the working copy that an earlier host process left open for the sandbox name.
	Adopt(name string) (WorkingCopy, bool)
	// Left names the working copies an earlier host process left on this host.
	Left() []string
	RemoveSnapshot(ctx context.Context, store protocol.WorkingCopyStore, snapshot string) error
}

type WorkingCopy interface {
	// Dir is the working copy's directory, which the host mounts as the sandbox's workspace.
	Dir() string
	// Sockets is the directory the host serves the sandbox's host socket in.
	Sockets() string
	Snapshot(ctx context.Context, name string) error
	Close(ctx context.Context) error
}

var errNoWorkingCopies = errors.New(
	"the pool or trust keeps working copies in a store of its hosts, and this host has no working copy hook: set working-copy-hook",
)

// sandboxCopy is the working copy of one sandbox, with the socket the sandbox asks for its snapshots on.
type sandboxCopy struct {
	copy     WorkingCopy
	name     string
	store    string
	restored string
	rebased  string
	base     *string
	server   *http.Server
	serving  sync.WaitGroup
	saving   sync.Mutex
	// made is every snapshot this sandbox had made, so it cannot have one made again under the same name.
	made map[string]bool
}

func (h *Host) workingCopyStore() *protocol.WorkingCopyStore {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.required.WorkingCopies == nil || h.required.WorkingCopies.Store == "" {
		return nil
	}
	return h.required.WorkingCopies
}

// workingCopiesFit says why this host may not claim yet: its pool or trust keeps working copies in a store it cannot serve.
func (h *Host) workingCopiesFit(ctx context.Context) error {
	store := h.workingCopyStore()
	if store == nil {
		return nil
	}
	if h.opts.WorkingCopies == nil {
		return errNoWorkingCopies
	}

	h.mu.Lock()
	checked := h.checkedStore == store.Store
	h.mu.Unlock()
	if checked {
		return nil
	}

	if err := h.opts.WorkingCopies.Check(ctx, *store); err != nil {
		return err
	}

	h.mu.Lock()
	h.checkedStore = store.Store
	h.mu.Unlock()
	h.log.Info("keeps working copies in a store of its hosts", "store", store.Store)
	return nil
}

// unfit says once why the host does not claim, until the reason changes.
func (h *Host) unfit(err error) {
	h.mu.Lock()
	said := h.unfitBy == err.Error()
	h.unfitBy = err.Error()
	h.mu.Unlock()

	if !said {
		h.log.Error("does not claim: the pool or trust keeps working copies in a store this host cannot serve", "error", err)
	}
}

// needsWorkingCopy says whether the work keeps a workspace for a later run: a sandbox, or a run that continues or replays work.
func needsWorkingCopy(assignment protocol.Assignment) bool {
	if assignment.SandboxID != "" {
		return true
	}

	run := assignment.Work.Run
	if run == nil || run.Spec.Search != nil {
		return false
	}
	return run.Spec.Resume.Key != "" || (run.Spec.Replay != nil && run.Spec.Replay.Archive != nil)
}

// openWorkingCopy gives the sandbox its workspace from the store of its pool or trust, when it keeps working copies there.
func (h *Host) openWorkingCopy(ctx context.Context, assignment protocol.Assignment, log *slog.Logger) (*sandboxCopy, error) {
	store := h.workingCopyStore()
	if store == nil || !needsWorkingCopy(assignment) {
		return nil, nil
	}
	if h.opts.WorkingCopies == nil {
		return nil, errNoWorkingCopies
	}

	opening, cancel := context.WithTimeout(context.WithoutCancel(ctx), workingCopyWait)
	defer cancel()

	stored, err := h.pool.WorkingCopyArchive(opening, assignment, valueOf(store.Base))
	if err != nil {
		log.Warn("could not read the working copy to restore, so it starts from the store's base", "error", err)
	}

	from, rebased := "", ""
	if stored != nil && stored.Snapshot != nil && stored.Snapshot.Store == store.Store {
		if stored.Snapshot.Rebase {
			rebased = stored.ID
		} else {
			from = stored.Snapshot.Name
		}
	}

	name := nameOf(assignment)
	opened, fromSnapshot, err := h.opts.WorkingCopies.Open(opening, *store, name, from)
	if err != nil {
		return nil, fmt.Errorf("open the working copy: %w", err)
	}

	copy := &sandboxCopy{copy: opened, name: name, store: store.Store, rebased: rebased, base: store.Base}
	switch {
	case fromSnapshot && stored != nil:
		copy.restored, copy.base = stored.ID, stored.Snapshot.Base
		log.Info("opened the working copy from its snapshot", "archive", stored.ID, "snapshot", from)
	case rebased != "":
		log.Info("opened the working copy from the store's current base, as the run starts afresh",
			"base", valueOf(store.Base), "archive", rebased)
	case from != "":
		log.Warn("could not open the working copy from its snapshot, so it starts from the store's base", "snapshot", from)
	}

	if err := copy.serve(log); err != nil {
		copy.close(context.WithoutCancel(ctx), log)
		return nil, err
	}
	return copy, nil
}

// adoptWorkingCopy takes over the working copy of a sandbox that the host took over after a restart.
func (h *Host) adoptWorkingCopy(live liveSandbox, log *slog.Logger) *sandboxCopy {
	if h.opts.WorkingCopies == nil {
		return nil
	}

	name := nameOf(protocol.Assignment{RunnerID: live.runnerID, SandboxID: live.sandboxID})
	adopted, ok := h.opts.WorkingCopies.Adopt(name)
	if !ok {
		return nil
	}

	copy := &sandboxCopy{copy: adopted, name: name}
	if err := copy.serve(log); err != nil {
		log.Warn("could not serve the sandbox's host socket again; its runs cannot archive their workspace", "error", err)
	}
	return copy
}

// releaseLeftWorkingCopies closes the working copies of sandboxes that no longer run on this host.
func (h *Host) releaseLeftWorkingCopies(ctx context.Context, taken []taken) {
	if h.opts.WorkingCopies == nil {
		return
	}

	kept := map[string]bool{}
	for _, each := range taken {
		kept[nameOf(protocol.Assignment{RunnerID: each.live.runnerID, SandboxID: each.live.sandboxID})] = true
	}

	for _, name := range h.opts.WorkingCopies.Left() {
		if kept[name] {
			continue
		}
		left, ok := h.opts.WorkingCopies.Adopt(name)
		if !ok {
			continue
		}
		if err := left.Close(ctx); err != nil {
			h.log.Warn("could not release a working copy left behind", "workingCopy", name, "error", err)
			continue
		}
		h.log.Info("released a working copy left behind", "workingCopy", name)
	}
}

// removeSnapshots deletes the snapshots of the archives Spotlight removed, which only a host of the store can delete.
func (h *Host) removeSnapshots(ctx context.Context) {
	if h.opts.WorkingCopies == nil {
		return
	}

	for {
		h.removeDueSnapshots(ctx)

		select {
		case <-ctx.Done():
			return
		case <-time.After(jitter(snapshotRemoveEach)):
		}
	}
}

func (h *Host) removeDueSnapshots(ctx context.Context) {
	store := h.workingCopyStore()
	if store == nil {
		return
	}

	due, err := h.pool.SnapshotRemovals(ctx)
	if err != nil {
		h.log.Warn("could not read the snapshots to remove", "error", err)
		return
	}
	if due.Store == nil || *due.Store != store.Store {
		return
	}

	for _, removal := range due.Removals {
		if !protocol.IsSpotlightSnapshot(removal.Snapshot) {
			h.log.Warn("left a snapshot Spotlight did not make", "snapshot", removal.Snapshot)
			continue
		}
		if err := h.opts.WorkingCopies.RemoveSnapshot(ctx, *store, removal.Snapshot); err != nil {
			h.log.Warn("could not remove the snapshot of a removed archive", "snapshot", removal.Snapshot, "error", err)
			continue
		}
		if err := h.pool.ForgetSnapshotRemoval(ctx, removal.ArchiveID); err != nil {
			h.log.Warn("removed a snapshot, but could not say so", "snapshot", removal.Snapshot, "error", err)
		}
	}
}

func (c *sandboxCopy) mounts() []sandbox.Mount {
	if c == nil {
		return nil
	}
	return []sandbox.Mount{
		{Source: c.copy.Dir(), Target: protocol.SandboxWorkspace},
		{Source: c.copy.Sockets(), Target: protocol.SandboxHostDir},
	}
}

func (c *sandboxCopy) env() []string {
	if c == nil {
		return nil
	}

	env := []string{
		protocol.WorkingCopyStoreVar + "=" + c.store,
		"SPOTLIGHT_WORKSPACE=" + protocol.SandboxWorkspace,
	}
	if c.restored != "" {
		env = append(env, protocol.WorkingCopyRestoredVar+"="+c.restored)
	}
	if c.rebased != "" {
		env = append(env, protocol.WorkingCopyRebasedVar+"="+c.rebased)
	}
	if c.base != nil && *c.base != "" {
		env = append(env, protocol.WorkingCopyBaseVar+"="+*c.base)
	}
	return env
}

func valueOf(text *string) string {
	if text == nil {
		return ""
	}
	return *text
}

// serve answers the sandbox's requests for snapshots on a socket in the working copy's socket directory.
func (c *sandboxCopy) serve(log *slog.Logger) error {
	socket := filepath.Join(c.copy.Sockets(), filepath.Base(protocol.SandboxHostSocket))
	if err := os.Remove(socket); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("clear the host socket: %w", err)
	}

	listener, err := net.Listen("unix", socket)
	if err != nil {
		return fmt.Errorf("serve the host socket: %w", err)
	}
	if err := os.Chmod(socket, 0o600); err != nil {
		_ = listener.Close()
		return fmt.Errorf("serve the host socket: %w", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST "+protocol.HostSnapshotPath, func(w http.ResponseWriter, r *http.Request) {
		c.snapshot(w, r, log)
	})
	c.server = &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}

	c.serving.Go(func() {
		if err := c.server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Warn("stopped serving the host socket", "error", err)
		}
	})
	return nil
}

func (c *sandboxCopy) snapshot(w http.ResponseWriter, r *http.Request, log *slog.Logger) {
	var asked protocol.HostSnapshotRequest
	// The sandbox is not trusted: it names only a snapshot as Spotlight names one, which holds no path, and never one
	// it had made before. The hook refuses a name its store already holds, and archive ids are random, so the sandbox
	// cannot reach the snapshot of another archive.
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&asked); err != nil ||
		!protocol.IsSpotlightSnapshot(asked.Snapshot) {
		http.Error(w, "name a snapshot that Spotlight granted, spotlight-<archive id>", http.StatusBadRequest)
		return
	}

	c.saving.Lock()
	defer c.saving.Unlock()

	if c.made[asked.Snapshot] {
		http.Error(w, "this sandbox had snapshot "+asked.Snapshot+" made already; a snapshot never changes", http.StatusConflict)
		return
	}

	started := time.Now()
	if err := c.copy.Snapshot(r.Context(), asked.Snapshot); err != nil {
		log.Warn("could not make the snapshot of the working copy", "snapshot", asked.Snapshot, "error", err)
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	if c.made == nil {
		c.made = map[string]bool{}
	}
	c.made[asked.Snapshot] = true
	log.Info("made the snapshot of the working copy", "snapshot", asked.Snapshot, "took", time.Since(started).Round(time.Millisecond))
	w.WriteHeader(http.StatusNoContent)
}

// stop ends the host socket and leaves the working copy open, for the host that takes the sandbox over.
func (c *sandboxCopy) stop() {
	if c == nil || c.server == nil {
		return
	}
	stopping, cancel := context.WithTimeout(context.Background(), socketStopBudget)
	defer cancel()
	_ = c.server.Shutdown(stopping)
	c.serving.Wait()
}

// close releases the working copy once the sandbox is gone: every archive it made is a snapshot.
func (c *sandboxCopy) close(ctx context.Context, log *slog.Logger) {
	if c == nil {
		return
	}
	c.stop()

	closing, cancel := context.WithTimeout(context.WithoutCancel(ctx), workingCopyWait)
	defer cancel()
	if err := c.copy.Close(closing); err != nil {
		log.Warn("could not release the working copy; the next host start releases it", "workingCopy", c.name, "error", err)
	}
}
