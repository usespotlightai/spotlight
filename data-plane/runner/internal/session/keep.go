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
	keepStep    = "archive"
)

type keeper struct {
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

func newKeeper(
	run protocol.Run, space *workspace.Workspace, journal *journalWriter, control Journal, through http.RoundTripper, log *slog.Logger,
) *keeper {
	return &keeper{
		run:     run,
		space:   space,
		journal: journal,
		control: control,
		scratch: os.TempDir(),
		through: through,
		log:     log,
	}
}

func (k *keeper) replays() bool {
	return k.run.Spec.Replay != nil
}

func (k *keeper) carriesOn() bool {
	return !k.replays() && !searches(k.run) && k.run.Spec.Continuity.Key != ""
}

func (k *keeper) restore(ctx context.Context) error {
	if k.replays() {
		return k.restoreReplayed(ctx)
	}

	if k.carriesOn() {
		k.leased(ctx, k.restored)
	}

	return nil
}

func (k *keeper) restored(ctx context.Context) {
	stored, err := k.control.WorkspaceArchive(ctx, k.run.ID)
	if err != nil {
		k.report(restoreStep, "Started afresh: %v", err)
		return
	}
	if stored == nil {
		return
	}

	if err := k.unpacked(ctx, *stored); err != nil {
		k.report(restoreStep, "Started afresh: %v", err)
		return
	}

	k.report(restoreStep, "Restored the workspace the last run left (%s)", sized(stored.Size))
}

func (k *keeper) restoreReplayed(ctx context.Context) error {
	wanted := k.run.Spec.Replay.Archive
	if wanted == nil {
		return nil
	}

	var err error
	k.leased(ctx, func(ctx context.Context) {
		err = k.restoredExactly(ctx, *wanted)
	})

	return err
}

func (k *keeper) restoredExactly(ctx context.Context, wanted string) error {
	stored, err := k.control.WorkspaceArchive(ctx, k.run.ID)
	if err != nil {
		return fmt.Errorf("read the archive the replay starts from: %w", err)
	}
	if stored == nil || stored.ID != wanted {
		return fmt.Errorf("the archive the replay starts from, %s, is no longer kept", wanted)
	}

	if err := k.unpacked(ctx, *stored); err != nil {
		return fmt.Errorf("restore the archive the replay starts from: %w", err)
	}

	k.report(restoreStep, "Restored the workspace the replayed run started from (%s)", sized(stored.Size))
	return nil
}

func (k *keeper) unpacked(ctx context.Context, stored protocol.StoredArchive) error {
	fetched, err := archive.Fetch(ctx, k.through, stored, k.scratch)
	if err != nil {
		return err
	}
	defer func() {
		if err := fetched.Remove(); err != nil {
			k.log.Warn("could not remove the fetched workspace", "error", err)
		}
	}()

	if err := k.space.Clear(k.rebuilt(ctx)); err != nil {
		k.emptied()
		return err
	}

	if err := fetched.UnpackInto(k.space.Dir); err != nil {
		k.emptied()
		return err
	}

	k.restoredFrom = stored.ID
	return nil
}

func (k *keeper) recordBaseline() {
	if k.restoredFrom == "" {
		return
	}

	fingerprint, err := archive.Fingerprint(k.space.Dir, k.rebuilt(context.Background()))
	if err != nil {
		k.log.Warn("could not take the workspace's fingerprint", "error", err)
		return
	}

	k.baseline = fingerprint
}

func (k *keeper) keep(ctx context.Context) bool {
	if !k.carriesOn() {
		return false
	}

	var sealed bool
	k.leased(ctx, func(ctx context.Context) {
		var summary string
		summary, sealed = k.kept(ctx)
		k.report(keepStep, "%s", summary)
	})

	return sealed
}

func (k *keeper) kept(ctx context.Context) (string, bool) {
	leaveOut := k.rebuilt(ctx)

	now, err := archive.Fingerprint(k.space.Dir, leaveOut)
	if err != nil {
		k.log.Warn("could not take the workspace's fingerprint", "error", err)
	}
	if now != "" && now == k.baseline {
		return "Coalesced: nothing changed since the workspace was last restored or kept", true
	}

	packed, err := archive.Pack(k.space.Dir, k.scratch, leaveOut)
	if err != nil {
		return "Skipped: " + err.Error(), false
	}
	defer func() {
		if err := packed.Remove(); err != nil {
			k.log.Warn("could not remove the packed workspace", "error", err)
		}
	}()

	grant, err := k.control.GrantArchive(ctx, k.run.ID, packed.Size, packed.SHA256)
	if err != nil {
		return "Skipped: " + err.Error(), false
	}

	if err := archive.Upload(ctx, k.through, grant, packed); err != nil {
		return "Skipped: " + err.Error(), false
	}

	if err := k.control.SealArchive(ctx, k.run.ID, grant.ID); err != nil {
		return "Skipped: " + err.Error(), false
	}
	k.baseline = now

	return fmt.Sprintf("Captured the workspace for the next run (%s)", sized(packed.Size)), true
}

// leased renews the lease also after a person asks the run to stop. The run must keep its lease until it ends.
func (k *keeper) leased(ctx context.Context, do func(context.Context)) {
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
				if _, err := k.control.RenewLease(renewing, k.run.ID); err != nil {
					k.log.Warn("could not renew lease", "error", err)
				}
			}
		}
	}()

	do(ctx)
}

func (k *keeper) emptied() {
	if err := k.space.Clear(nil); err != nil {
		k.log.Warn("could not clear a workspace half restored", "error", err)
	}
}

func (k *keeper) rebuilt(ctx context.Context) []string {
	var setUp []string
	for _, checkout := range k.run.Spec.Checkouts {
		if checkout.Setup != "" {
			setUp = append(setUp, checkout.Path)
		}
	}
	if len(setUp) == 0 {
		return nil
	}

	ignored, err := k.space.Ignored(ctx, setUp)
	if err != nil {
		k.log.Warn("could not tell what the checkouts ignore", "error", err)
	}
	return ignored
}

func (k *keeper) report(step, format string, args ...any) {
	summary := fmt.Sprintf(format, args...)

	k.log.Info("workspace "+step, "outcome", summary)
	k.journal.append(protocol.Event{
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
