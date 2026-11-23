package session

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/archive"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

const (
	restoreStep = "restore"
	archiveStep = "archive"
)

const settleFor = 25 * time.Second

const archiveLeaseRenewal = 30 * time.Second

const releaseWithin = 5 * time.Second

type ArchivingSandbox interface {
	HoldArchiveLease(ctx context.Context, runID string, attempt int) error
	ReleaseArchiveLease(ctx context.Context, runID string, attempt int) error
	AppendEvents(ctx context.Context, runID string, events []protocol.Event) error
	GrantArchive(ctx context.Context, request protocol.ArchiveRequest) (protocol.ArchiveGrant, error)
	CompleteArchive(ctx context.Context, archiveID string) error
}

type archiver struct {
	run     protocol.Run
	space   *workspace.Workspace
	journal *journalWriter
	control Journal
	scratch string
	through http.RoundTripper
	log     *slog.Logger
	host    *HostWorkingCopy

	restoredFrom string
	baseline     string
	leftOut      []string
	current      string
	inherits     bool
	// moving is set while a tar restored into the host's working copy has no snapshot yet, so the next archive makes one.
	moving bool
}

type kept struct {
	archive  string
	baseline string
	leftOut  []string
	archives bool
	moving   bool
}

func newArchiver(
	run protocol.Run, space *workspace.Workspace, journal *journalWriter, control Journal, through http.RoundTripper, log *slog.Logger,
	host *HostWorkingCopy,
) *archiver {
	return &archiver{
		run:     run,
		space:   space,
		journal: journal,
		control: control,
		scratch: os.TempDir(),
		through: through,
		log:     log,
		host:    host,
	}
}

func (a *archiver) keep() kept {
	return kept{archive: a.current, baseline: a.baseline, leftOut: a.leftOut, archives: a.restoresWorkspace(), moving: a.moving}
}

func (a *archiver) carry(from kept) {
	a.restoredFrom, a.current = from.archive, from.archive
	a.baseline, a.leftOut = from.baseline, from.leftOut
	a.moving = from.moving
	a.inherits = true
	if from.archive != "" {
		a.noted(restoreStep, false, "Kept the workspace this sandbox restored or the last run left in it")
	}
}

func (a *archiver) replays() bool {
	return a.run.Spec.Replay != nil
}

func (a *archiver) restoresWorkspace() bool {
	return !a.replays() && !searches(a.run) && a.run.Spec.Resume.Key != ""
}

func (a *archiver) restore(ctx context.Context) error {
	if a.replays() {
		return a.restoreReplayed(ctx)
	}

	if a.restoresWorkspace() {
		a.restored(ctx)
	}

	return nil
}

func (a *archiver) restored(ctx context.Context) {
	stored, err := a.control.WorkingCopyArchive(ctx, a.run.ID)
	if err != nil {
		a.noted(restoreStep, true, "Started afresh: %v", err)
		return
	}
	if stored == nil {
		return
	}

	if stored.Snapshot != nil {
		a.restoredByHost(*stored)
		return
	}

	restoring := a.journal.begin(ctx, restoreStep)
	if err := a.unpacked(ctx, *stored); err != nil {
		a.ended(ctx, restoring, true, "Started afresh: %v", err)
		return
	}

	a.ended(ctx, restoring, false, "Restored the workspace the last run left (%s)", sized(stored.Size))
}

func (a *archiver) restoreReplayed(ctx context.Context) error {
	wanted := a.run.Spec.Replay.Archive
	if wanted == nil {
		return nil
	}

	return a.restoredExactly(ctx, *wanted)
}

func (a *archiver) restoredExactly(ctx context.Context, wanted string) error {
	stored, err := a.control.WorkingCopyArchive(ctx, a.run.ID)
	if err != nil {
		return fmt.Errorf("read the archive the replay starts from: %w", err)
	}
	if stored == nil || stored.ID != wanted {
		return fmt.Errorf("the archive the replay starts from, %s, is no longer stored", wanted)
	}

	if stored.Snapshot != nil {
		if restored, err := a.host.restoredBy(*stored); !restored {
			return fmt.Errorf("restore the archive the replay starts from: %w", err)
		}
		a.restoredFromHost(stored.ID)
		a.noted(restoreStep, false, "Restored the workspace the replayed run started from, from snapshot %s", stored.Snapshot.Name)
		return nil
	}

	restoring := a.journal.begin(ctx, restoreStep)
	if err := a.unpacked(ctx, *stored); err != nil {
		err = fmt.Errorf("restore the archive the replay starts from: %w", err)
		a.ended(ctx, restoring, true, "%v", err)
		return err
	}

	a.ended(ctx, restoring, false, "Restored the workspace the replayed run started from (%s)", sized(stored.Size))
	return nil
}

func (a *archiver) restoredByHost(stored protocol.StoredArchive) {
	restored, err := a.host.restoredBy(stored)
	var fresh rebase
	switch {
	case errors.As(err, &fresh):
		a.noted(restoreStep, false, "%v", fresh)
		return
	case !restored:
		a.noted(restoreStep, true, "Started afresh: %v", err)
		return
	}

	a.restoredFromHost(stored.ID)
	a.noted(restoreStep, false, "Restored the workspace the last run left, from snapshot %s", stored.Snapshot.Name)
}

func (a *archiver) restoredFromHost(archiveID string) {
	a.restoredFrom, a.current = archiveID, archiveID
	a.inherits = true
}

func (a *archiver) unpacked(ctx context.Context, stored protocol.StoredArchive) error {
	if err := unpackInto(ctx, a.space, a.through, stored, a.rebuilt(ctx), a.scratch, a.log); err != nil {
		return err
	}

	a.restoredFrom, a.current = stored.ID, stored.ID
	a.inherits = true
	a.moving = a.host != nil
	return nil
}

func unpackInto(
	ctx context.Context, space *workspace.Workspace, through http.RoundTripper, stored protocol.StoredArchive,
	leaveOut []string, scratch string, log *slog.Logger,
) error {
	fetched, err := archive.Fetch(ctx, through, stored, scratch)
	if err != nil {
		return err
	}
	defer func() {
		if err := fetched.Remove(); err != nil {
			log.Warn("could not remove the fetched workspace", "error", err)
		}
	}()

	if err := space.Clear(leaveOut); err != nil {
		emptied(space, log)
		return err
	}

	if err := fetched.UnpackInto(space.Dir); err != nil {
		emptied(space, log)
		return err
	}

	return nil
}

func (a *archiver) recordBaseline() {
	if a.restoredFrom == "" {
		return
	}

	leaveOut := a.rebuilt(context.Background())
	fingerprint, err := archive.Fingerprint(a.space.Dir, leaveOut)
	if err != nil {
		a.log.Warn("could not take the workspace's fingerprint", "error", err)
		return
	}

	a.baseline, a.leftOut = fingerprint, leaveOut
}

func (a *archiver) archive(ctx context.Context) bool {
	if !a.restoresWorkspace() {
		return false
	}

	ctx, cancel := settling(ctx)
	defer cancel()

	var completed bool
	a.leased(ctx, func(ctx context.Context) {
		archiving := a.journal.begin(ctx, archiveStep)
		var summary string
		summary, completed = a.archived(ctx, storeCalls{
			grant: func(ctx context.Context, request protocol.ArchiveRequest) (protocol.ArchiveGrant, error) {
				return a.control.GrantArchive(ctx, a.run.ID, request)
			},
			complete: func(ctx context.Context, archiveID string) error {
				return a.control.CompleteArchive(ctx, a.run.ID, archiveID)
			},
		})
		a.ended(ctx, archiving, !completed, "%s", summary)
	})
	if !completed {
		a.current = ""
	}

	return completed
}

type heldArchive struct {
	sandbox      ArchivingSandbox
	stopRenewing context.CancelFunc
}

func (a *archiver) holdForArchive(ctx context.Context, sandbox ArchivingSandbox) *heldArchive {
	if sandbox == nil || !a.restoresWorkspace() {
		return nil
	}

	if err := sandbox.HoldArchiveLease(ctx, a.run.ID, a.run.Attempt); err != nil {
		a.log.Warn("the sandbox could not hold the workspace for an archive after the report, so the run archives first", "error", err)
		a.releaseArchiveLease(ctx, sandbox)
		return nil
	}

	return &heldArchive{
		sandbox: sandbox,
		stopRenewing: renewing(context.WithoutCancel(ctx), archiveLeaseRenewal, func(ctx context.Context) error {
			return sandbox.HoldArchiveLease(ctx, a.run.ID, a.run.Attempt)
		}, func(err error) {
			a.log.Error("could not renew the sandbox's archive lease; a new sandbox of the task may restore an older archive", "error", err)
		}),
	}
}

func (a *archiver) archiveHeld(ctx context.Context, held *heldArchive, reported bool) {
	defer held.stopRenewing()

	lingered, done := lingering(ctx, settleFor)
	defer done()

	if reported {
		a.journal.through(held.sandbox)
		archiving, stop := lingering(ctx, settleFor-releaseWithin)
		a.archiveAfterReport(archiving, held.sandbox)
		stop()
	} else {
		a.archive(ctx)
	}

	settled, cancel := context.WithTimeout(lingered, settleFor)
	defer cancel()

	a.journal.drain(settled)
	held.stopRenewing()
	if err := held.sandbox.ReleaseArchiveLease(settled, a.run.ID, a.run.Attempt); err != nil {
		a.log.Warn("could not release the sandbox after the archive; the lease expires instead", "error", err)
	}
}

func (a *archiver) releaseArchiveLease(ctx context.Context, sandbox ArchivingSandbox) {
	released, done := context.WithTimeout(context.WithoutCancel(ctx), releaseWithin)
	defer done()

	if err := sandbox.ReleaseArchiveLease(released, a.run.ID, a.run.Attempt); err != nil {
		a.log.Warn("could not release an archive lease the sandbox may hold; it expires instead", "error", err)
	}
}

func (a *archiver) archiveAfterReport(ctx context.Context, sandbox ArchivingSandbox) {
	archiving := a.journal.begin(ctx, archiveStep)
	summary, completed := a.archived(ctx, storeCalls{grant: sandbox.GrantArchive, complete: sandbox.CompleteArchive})
	a.ended(ctx, archiving, !completed, "%s", summary)
	if !completed {
		a.current = ""
	}
}

func (a *archiver) archived(ctx context.Context, calls storeCalls) (string, bool) {
	leaveOut := a.rebuilt(ctx)

	now, err := archive.Fingerprint(a.space.Dir, leaveOut)
	if err != nil {
		a.log.Warn("could not take the workspace's fingerprint", "error", err)
	}
	if now != "" && now == a.baseline && !a.moving {
		return "Coalesced: nothing changed since the workspace was last restored or archived", true
	}

	stored, err := store(ctx, a.host, a.space, a.through, leaveOut, a.scratch, calls, a.log)
	if err != nil {
		return "Skipped: " + err.Error(), false
	}
	a.baseline, a.leftOut, a.current = now, leaveOut, stored.id
	a.moving = false

	return "Captured the workspace for the next run " + stored.described(), true
}

type storeCalls struct {
	grant    func(ctx context.Context, request protocol.ArchiveRequest) (protocol.ArchiveGrant, error)
	complete func(ctx context.Context, archiveID string) error
}

type storedArchive struct {
	id       string
	size     int64
	snapshot string
}

func (s storedArchive) described() string {
	if s.snapshot != "" {
		return "(snapshot " + s.snapshot + ")"
	}
	return "(" + sized(s.size) + ")"
}

// store keeps the archive as a snapshot when the host keeps the workspace in a store, else as a tar in Spotlight.
func store(
	ctx context.Context, host *HostWorkingCopy, space *workspace.Workspace, through http.RoundTripper, leaveOut []string,
	scratch string, calls storeCalls, log *slog.Logger,
) (storedArchive, error) {
	if host != nil {
		return snapshotAndStore(ctx, host, calls)
	}
	return packAndStore(ctx, space, through, leaveOut, scratch, calls, log)
}

func packAndStore(
	ctx context.Context, space *workspace.Workspace, through http.RoundTripper, leaveOut []string, scratch string,
	calls storeCalls, log *slog.Logger,
) (storedArchive, error) {
	packed, err := archive.Pack(space.Dir, scratch, leaveOut)
	if err != nil {
		return storedArchive{}, err
	}
	defer func() {
		if err := packed.Remove(); err != nil {
			log.Warn("could not remove the packed workspace", "error", err)
		}
	}()

	grant, err := calls.grant(ctx, protocol.ArchiveRequest{Size: packed.Size, SHA256: packed.SHA256})
	if err != nil {
		return storedArchive{}, err
	}

	if err := archive.Upload(ctx, through, grant, packed); err != nil {
		return storedArchive{}, err
	}

	if err := calls.complete(ctx, grant.ID); err != nil {
		return storedArchive{}, err
	}

	return storedArchive{id: grant.ID, size: packed.Size}, nil
}

// leased renews the lease also after a person requests a stop. The run must keep its lease until it ends.
func (a *archiver) leased(ctx context.Context, do func(context.Context)) {
	stop := leasing(ctx, a.control, a.run.ID, heartbeat, a.log)
	defer stop()

	do(ctx)
}

func leasing(ctx context.Context, lease Journal, runID string, every time.Duration, log *slog.Logger) context.CancelFunc {
	return renewing(ctx, every, func(ctx context.Context) error {
		_, err := lease.RenewLease(ctx, runID)
		return err
	}, func(err error) {
		log.Warn("could not renew lease", "error", err)
	})
}

func renewing(ctx context.Context, every time.Duration, renew func(context.Context) error, failed func(error)) context.CancelFunc {
	renewing, stop := context.WithCancel(ctx)

	go func() {
		ticker := time.NewTicker(every)
		defer ticker.Stop()

		for {
			select {
			case <-renewing.Done():
				return
			case <-ticker.C:
				if err := renew(renewing); err != nil {
					failed(err)
				}
			}
		}
	}()

	return stop
}

func settling(ctx context.Context) (context.Context, context.CancelFunc) {
	if ctx.Err() == nil {
		return context.WithCancel(ctx)
	}
	return context.WithTimeout(context.WithoutCancel(ctx), settleFor)
}

func lingering(ctx context.Context, after time.Duration) (context.Context, context.CancelFunc) {
	detached, cancel := context.WithCancel(context.WithoutCancel(ctx))
	stop := context.AfterFunc(ctx, func() { time.AfterFunc(after, cancel) })

	return detached, func() {
		stop()
		cancel()
	}
}

func emptied(space *workspace.Workspace, log *slog.Logger) {
	if err := space.Clear(nil); err != nil {
		log.Warn("could not clear a workspace half restored", "error", err)
	}
}

// rebuilt names what an archive leaves out, as each checkout's setup builds it again. A store of the host keeps everything.
func (a *archiver) rebuilt(ctx context.Context) []string {
	if a.host != nil {
		return nil
	}

	var setUp []string
	for _, checkout := range a.run.Spec.Checkouts {
		if checkout.Setup != "" {
			setUp = append(setUp, checkout.Path)
		}
	}
	if len(setUp) == 0 {
		return nil
	}

	ignored, err := a.space.Ignored(ctx, setUp)
	if err != nil {
		a.log.Warn("could not tell what the checkouts ignore", "error", err)
	}
	return ignored
}

func (a *archiver) noted(name string, failed bool, format string, args ...any) {
	summary := fmt.Sprintf(format, args...)

	a.log.Info("workspace "+name, "outcome", summary)
	a.journal.note(name, failed, summary)
}

func (a *archiver) ended(ctx context.Context, running step, failed bool, format string, args ...any) {
	summary := fmt.Sprintf(format, args...)

	a.log.Info("workspace "+running.name, "outcome", summary)
	running.end(ctx, failed, summary)
}

func sized(bytes int64) string {
	const mb = 1 << 20
	if bytes < mb {
		return fmt.Sprintf("%d KB", (bytes+1023)/1024)
	}
	return fmt.Sprintf("%.1f MB", float64(bytes)/mb)
}
