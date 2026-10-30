package session

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/archive"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

type SandboxArchives interface {
	WorkspaceArchive(ctx context.Context) (*protocol.StoredArchive, error)
	GrantArchive(ctx context.Context, size int64, sha256 string) (protocol.ArchiveGrant, error)
	CompleteArchive(ctx context.Context, archiveID string) error
}

type SandboxOptions struct {
	Workspace string
	Archives  SandboxArchives
	Transport http.RoundTripper
	AgentUser *account.User
	Log       *slog.Logger
}

func (s *Sandbox) Open(ctx context.Context, opts SandboxOptions) error {
	space, err := workspace.Open(opts.Workspace)
	if err != nil {
		return err
	}
	s.space = space

	stored, err := opts.Archives.WorkspaceArchive(ctx)
	if err != nil {
		opts.Log.Warn("could not read the workspace to restore; the first run tries again", "error", err)
		return nil
	}

	restored := kept{archives: true}
	if stored != nil {
		if err := unpackInto(ctx, space, opts.Transport, *stored, nil, os.TempDir(), opts.Log); err != nil {
			opts.Log.Warn("could not restore the workspace; the first run tries again", "error", err)
			return nil
		}
		restored.archive = stored.ID
		opts.Log.Info("restored the workspace", "archive", stored.ID, "size", sized(stored.Size))
	}

	if restored.baseline, err = archive.Fingerprint(space.Dir, nil); err != nil {
		opts.Log.Warn("could not take the workspace's fingerprint", "error", err)
	}

	if opts.AgentUser != nil {
		if err := space.ChownAll(opts.AgentUser.UID, opts.AgentUser.GID); err != nil {
			return fmt.Errorf("hand over the restored workspace: %w", err)
		}
	}

	s.kept = &restored
	return nil
}

// Call Archive only between runs. During a run, the run archives the workspace with its own lease.
func (s *Sandbox) Archive(ctx context.Context, opts SandboxOptions) {
	if s.space == nil || s.kept == nil || !s.kept.archives {
		return
	}

	ctx, cancel := settling(ctx)
	defer cancel()

	now, err := archive.Fingerprint(s.space.Dir, s.kept.leftOut)
	if err != nil {
		opts.Log.Warn("could not take the workspace's fingerprint", "error", err)
	}
	if now != "" && now == s.kept.baseline {
		opts.Log.Info("the workspace did not change since it was last restored or archived")
		return
	}

	stored, err := packAndStore(ctx, s.space, opts.Transport, s.kept.leftOut, os.TempDir(), storeCalls{
		grant:    opts.Archives.GrantArchive,
		complete: opts.Archives.CompleteArchive,
	}, opts.Log)
	if err != nil {
		opts.Log.Warn("could not archive the workspace", "error", err)
		return
	}

	s.kept.archive, s.kept.baseline = stored.id, now
	opts.Log.Info("archived the workspace", "archive", stored.id, "size", sized(stored.size))
}
