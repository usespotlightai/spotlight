package session

import (
	"context"
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

type archiver struct {
	run     protocol.Run
	space   *workspace.Workspace
	journal *journalWriter
	control Journal
	scratch string
	through http.RoundTripper
	log     *slog.Logger

	restoredFrom string
	baseline     string
	leftOut      []string
	current      string
}

type kept struct {
	archive  string
	baseline string
	leftOut  []string
	archives bool
}

func newArchiver(
	run protocol.Run, space *workspace.Workspace, journal *journalWriter, control Journal, through http.RoundTripper, log *slog.Logger,
) *archiver {
	return &archiver{
		run:     run,
		space:   space,
		journal: journal,
		control: control,
		scratch: os.TempDir(),
		through: through,
		log:     log,
	}
}

func (a *archiver) keep() kept {
	return kept{archive: a.current, baseline: a.baseline, leftOut: a.leftOut, archives: a.restoresWorkspace()}
}

func (a *archiver) carry(from kept) {
	a.restoredFrom, a.current = from.archive, from.archive
	a.baseline, a.leftOut = from.baseline, from.leftOut
	if from.archive != "" {
		a.report(restoreStep, "Kept the workspace this sandbox restored or the last run left in it")
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
	stored, err := a.control.WorkspaceArchive(ctx, a.run.ID)
	if err != nil {
		a.report(restoreStep, "Started afresh: %v", err)
		return
	}
	if stored == nil {
		return
	}

	if err := a.unpacked(ctx, *stored); err != nil {
		a.report(restoreStep, "Started afresh: %v", err)
		return
	}

	a.report(restoreStep, "Restored the workspace the last run left (%s)", sized(stored.Size))
}

func (a *archiver) restoreReplayed(ctx context.Context) error {
	wanted := a.run.Spec.Replay.Archive
	if wanted == nil {
		return nil
	}

	return a.restoredExactly(ctx, *wanted)
}

func (a *archiver) restoredExactly(ctx context.Context, wanted string) error {
	stored, err := a.control.WorkspaceArchive(ctx, a.run.ID)
	if err != nil {
		return fmt.Errorf("read the archive the replay starts from: %w", err)
	}
	if stored == nil || stored.ID != wanted {
		return fmt.Errorf("the archive the replay starts from, %s, is no longer stored", wanted)
	}

	if err := a.unpacked(ctx, *stored); err != nil {
		return fmt.Errorf("restore the archive the replay starts from: %w", err)
	}

	a.report(restoreStep, "Restored the workspace the replayed run started from (%s)", sized(stored.Size))
	return nil
}

func (a *archiver) unpacked(ctx context.Context, stored protocol.StoredArchive) error {
	if err := unpackInto(ctx, a.space, a.through, stored, a.rebuilt(ctx), a.scratch, a.log); err != nil {
		return err
	}

	a.restoredFrom, a.current = stored.ID, stored.ID
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
		var summary string
		summary, completed = a.archived(ctx)
		a.report(archiveStep, "%s", summary)
	})
	if !completed {
		a.current = ""
	}

	return completed
}

func (a *archiver) archived(ctx context.Context) (string, bool) {
	leaveOut := a.rebuilt(ctx)

	now, err := archive.Fingerprint(a.space.Dir, leaveOut)
	if err != nil {
		a.log.Warn("could not take the workspace's fingerprint", "error", err)
	}
	if now != "" && now == a.baseline {
		return "Coalesced: nothing changed since the workspace was last restored or archived", true
	}

	stored, err := packAndStore(ctx, a.space, a.through, leaveOut, a.scratch, storeCalls{
		grant: func(ctx context.Context, size int64, sha256 string) (protocol.ArchiveGrant, error) {
			return a.control.GrantArchive(ctx, a.run.ID, size, sha256)
		},
		complete: func(ctx context.Context, archiveID string) error {
			return a.control.CompleteArchive(ctx, a.run.ID, archiveID)
		},
	}, a.log)
	if err != nil {
		return "Skipped: " + err.Error(), false
	}
	a.baseline, a.leftOut, a.current = now, leaveOut, stored.id

	return fmt.Sprintf("Captured the workspace for the next run (%s)", sized(stored.size)), true
}

type storeCalls struct {
	grant    func(ctx context.Context, size int64, sha256 string) (protocol.ArchiveGrant, error)
	complete func(ctx context.Context, archiveID string) error
}

type storedArchive struct {
	id   string
	size int64
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

	grant, err := calls.grant(ctx, packed.Size, packed.SHA256)
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
	renewing, stop := context.WithCancel(ctx)

	go func() {
		ticker := time.NewTicker(every)
		defer ticker.Stop()

		for {
			select {
			case <-renewing.Done():
				return
			case <-ticker.C:
				if _, err := lease.RenewLease(renewing, runID); err != nil {
					log.Warn("could not renew lease", "error", err)
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

func emptied(space *workspace.Workspace, log *slog.Logger) {
	if err := space.Clear(nil); err != nil {
		log.Warn("could not clear a workspace half restored", "error", err)
	}
}

func (a *archiver) rebuilt(ctx context.Context) []string {
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

func (a *archiver) report(step, format string, args ...any) {
	summary := fmt.Sprintf(format, args...)

	a.log.Info("workspace "+step, "outcome", summary)
	a.journal.append(protocol.Event{
		Type:    protocol.EventOutput,
		Message: step,
		Data:    []byte(summary),
	})
}

func sized(bytes int64) string {
	const mb = 1 << 20
	if bytes < mb {
		return fmt.Sprintf("%d KB", (bytes+1023)/1024)
	}
	return fmt.Sprintf("%.1f MB", float64(bytes)/mb)
}
