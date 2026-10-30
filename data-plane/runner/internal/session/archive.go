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
		a.leased(ctx, a.restored)
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

	var err error
	a.leased(ctx, func(ctx context.Context) {
		err = a.restoredExactly(ctx, *wanted)
	})

	return err
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
	fetched, err := archive.Fetch(ctx, a.through, stored, a.scratch)
	if err != nil {
		return err
	}
	defer func() {
		if err := fetched.Remove(); err != nil {
			a.log.Warn("could not remove the fetched workspace", "error", err)
		}
	}()

	if err := a.space.Clear(a.rebuilt(ctx)); err != nil {
		a.emptied()
		return err
	}

	if err := fetched.UnpackInto(a.space.Dir); err != nil {
		a.emptied()
		return err
	}

	a.restoredFrom = stored.ID
	return nil
}

func (a *archiver) recordBaseline() {
	if a.restoredFrom == "" {
		return
	}

	fingerprint, err := archive.Fingerprint(a.space.Dir, a.rebuilt(context.Background()))
	if err != nil {
		a.log.Warn("could not take the workspace's fingerprint", "error", err)
		return
	}

	a.baseline = fingerprint
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

	packed, err := archive.Pack(a.space.Dir, a.scratch, leaveOut)
	if err != nil {
		return "Skipped: " + err.Error(), false
	}
	defer func() {
		if err := packed.Remove(); err != nil {
			a.log.Warn("could not remove the packed workspace", "error", err)
		}
	}()

	grant, err := a.control.GrantArchive(ctx, a.run.ID, packed.Size, packed.SHA256)
	if err != nil {
		return "Skipped: " + err.Error(), false
	}

	if err := archive.Upload(ctx, a.through, grant, packed); err != nil {
		return "Skipped: " + err.Error(), false
	}

	if err := a.control.CompleteArchive(ctx, a.run.ID, grant.ID); err != nil {
		return "Skipped: " + err.Error(), false
	}
	a.baseline = now

	return fmt.Sprintf("Captured the workspace for the next run (%s)", sized(packed.Size)), true
}

// leased renews the lease also after a person requests a stop. The run must keep its lease until it ends.
func (a *archiver) leased(ctx context.Context, do func(context.Context)) {
	renewing, stop := context.WithCancel(ctx)
	defer stop()

	go func() {
		ticker := time.NewTicker(heartbeat)
		defer ticker.Stop()

		for {
			select {
			case <-renewing.Done():
				return
			case <-ticker.C:
				if _, err := a.control.RenewLease(renewing, a.run.ID); err != nil {
					a.log.Warn("could not renew lease", "error", err)
				}
			}
		}
	}()

	do(ctx)
}

func settling(ctx context.Context) (context.Context, context.CancelFunc) {
	if ctx.Err() == nil {
		return context.WithCancel(ctx)
	}
	return context.WithTimeout(context.WithoutCancel(ctx), settleFor)
}

func (a *archiver) emptied() {
	if err := a.space.Clear(nil); err != nil {
		a.log.Warn("could not clear a workspace half restored", "error", err)
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
