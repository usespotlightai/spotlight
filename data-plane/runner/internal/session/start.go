package session

import (
	"context"
	"fmt"
	"path/filepath"

	"usespotlight.ai/data-plane/protocol"
)

const startStep = "start"

type startingPoints interface {
	RecordStartingPoint(ctx context.Context, runID string, point protocol.StartingPoint) error
}

func (k *keeper) started(ctx context.Context) {
	if !k.run.Spec.StartingPoint {
		return
	}

	if err := recordStart(ctx, k.control, k.run, k.space.Dir, k.restoredFrom); err != nil {
		k.report(startStep, "Where the run started was not recorded: %v", err)
	}
}

func recordStart(ctx context.Context, to startingPoints, run protocol.Run, dir, restoredFrom string) error {
	checkouts, err := heads(ctx, dir, run.Spec.Checkouts)
	if err != nil {
		return err
	}

	point := protocol.StartingPoint{Attempt: run.Attempt, Checkouts: checkouts}
	if restoredFrom != "" {
		point.ArchiveID = &restoredFrom
	}

	return to.RecordStartingPoint(ctx, run.ID, point)
}

func heads(ctx context.Context, dir string, checkouts []protocol.Checkout) ([]protocol.StartedCheckout, error) {
	started := make([]protocol.StartedCheckout, 0, len(checkouts))

	for _, checkout := range checkouts {
		commit, err := gitIn(ctx, filepath.Join(dir, checkout.Path))("rev-parse", "--verify", "HEAD")
		if err != nil {
			return nil, fmt.Errorf("read the commit %s is at: %w: %s", checkout.Path, err, commit)
		}

		started = append(started, protocol.StartedCheckout{Path: checkout.Path, Commit: commit})
	}

	return started, nil
}
