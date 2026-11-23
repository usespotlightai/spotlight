package session

import (
	"context"
	"errors"
	"fmt"

	"usespotlight.ai/data-plane/protocol"
)

// HostSnapshots makes a snapshot of the working copy that holds the sandbox's workspace.
type HostSnapshots interface {
	Snapshot(ctx context.Context, name string) error
}

// HostWorkingCopy is a workspace that the host keeps in the store of its working copy hook. The host restores it
// before the sandbox starts, and makes each archive a snapshot of it, so the runner uploads nothing.
type HostWorkingCopy struct {
	Store    string
	Restored string
	// Rebase is the archive the run rebases from: the host opened the workspace from the store's current base instead.
	Rebase string
	// Base is the base snapshot the working copy descends from, empty for one that started without a base.
	Base string
	Host HostSnapshots
}

// rebase is why the run starts from the store's current base: no failure, but no restore either.
type rebase struct{ base, from string }

func (r rebase) Error() string {
	from := "no base"
	if r.from != "" {
		from = "base " + r.from
	}
	return fmt.Sprintf("Started from base %s of the store: this run starts no session, and the last working copy descends from %s", r.base, from)
}

// restoredBy says whether the host already restored stored into the workspace, and why not when it did not.
func (w *HostWorkingCopy) restoredBy(stored protocol.StoredArchive) (bool, error) {
	snapshot := stored.Snapshot
	switch {
	case w != nil && w.Restored != "" && w.Restored == stored.ID:
		return true, nil
	case w != nil && w.Rebase != "" && w.Rebase == stored.ID:
		from := ""
		if snapshot.Base != nil {
			from = *snapshot.Base
		}
		return false, rebase{base: w.Base, from: from}
	case w != nil && w.Store == snapshot.Store:
		return false, fmt.Errorf("the host could not open the working copy from snapshot %s", snapshot.Name)
	default:
		return false, fmt.Errorf(
			"the last run kept the working copy in store %s, which this host does not reach", snapshot.Store,
		)
	}
}

func snapshotAndStore(ctx context.Context, w *HostWorkingCopy, calls storeCalls) (storedArchive, error) {
	archive := &protocol.SnapshotArchive{}
	if w.Base != "" {
		archive.Base = &w.Base
	}
	grant, err := calls.grant(ctx, protocol.ArchiveRequest{Snapshot: archive})
	if err != nil {
		return storedArchive{}, err
	}
	if grant.Snapshot == nil || grant.Snapshot.Name == "" {
		return storedArchive{}, errors.New("the control plane granted no snapshot for the archive")
	}

	if err := w.Host.Snapshot(ctx, grant.Snapshot.Name); err != nil {
		return storedArchive{}, fmt.Errorf("make the snapshot: %w", err)
	}

	if err := calls.complete(ctx, grant.ID); err != nil {
		return storedArchive{}, err
	}

	return storedArchive{id: grant.ID, snapshot: grant.Snapshot.Name}, nil
}
