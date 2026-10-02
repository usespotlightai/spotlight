package session

import (
	"context"
	"fmt"
	"log/slog"
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
	log     *slog.Logger

	restoredFrom string
	baseline     string
}

func newKeeper(run protocol.Run, space *workspace.Workspace, journal *journalWriter, control Journal, log *slog.Logger) *keeper {
	return &keeper{
		run:     run,
		space:   space,
		journal: journal,
		control: control,
		scratch: os.TempDir(),
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
	held, err := k.control.WorkspaceArchive(ctx, k.run.ID)
	if err != nil {
		k.say(restoreStep, "Started afresh: %v", err)
		return
	}
	if held == nil {
		return
	}

	if err := k.unpacked(ctx, *held); err != nil {
		k.say(restoreStep, "Started afresh: %v", err)
		return
	}

	k.say(restoreStep, "Restored the workspace the last run left (%s)", sized(held.Size))
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
	held, err := k.control.WorkspaceArchive(ctx, k.run.ID)
	if err != nil {
		return fmt.Errorf("read the archive the replay starts from: %w", err)
	}
	if held == nil || held.ID != wanted {
		return fmt.Errorf("the archive the replay starts from, %s, is no longer kept", wanted)
	}

	if err := k.unpacked(ctx, *held); err != nil {
		return fmt.Errorf("restore the archive the replay starts from: %w", err)
	}

	k.say(restoreStep, "Restored the workspace the replayed run started from (%s)", sized(held.Size))
	return nil
}

func (k *keeper) unpacked(ctx context.Context, held protocol.HeldArchive) error {
	fetched, err := archive.Fetch(ctx, held, k.scratch)
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

	k.restoredFrom = held.ID
	return nil
}

func (k *keeper) settled() {
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
		var said string
		said, sealed = k.kept(ctx)
		k.say(keepStep, "%s", said)
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

	if err := archive.Upload(ctx, grant, packed); err != nil {
		return "Skipped: " + err.Error(), false
	}

	if err := k.control.SealArchive(ctx, k.run.ID, grant.ID); err != nil {
		return "Skipped: " + err.Error(), false
	}
	k.baseline = now

	return fmt.Sprintf("Captured the workspace for the next run (%s)", sized(packed.Size)), true
}

// Renews even once a person has asked the run to stop: the run is ending, and must stay held until it has.
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

func (k *keeper) say(step, format string, args ...any) {
	said := fmt.Sprintf(format, args...)

	k.log.Info("workspace "+step, "outcome", said)
	k.journal.append(protocol.Event{
		Type:    protocol.EventOutput,
		Message: step,
		Data:    []byte(said),
	})
}

func sized(bytes int64) string {
	const mb = 1 << 20
	if bytes < mb {
		return fmt.Sprintf("%d KB", (bytes+1023)/1024)
	}
	return fmt.Sprintf("%.1f MB", float64(bytes)/mb)
}
