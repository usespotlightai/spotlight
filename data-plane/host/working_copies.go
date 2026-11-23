package host

import (
	"context"
	"path/filepath"

	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/host/internal/serve"
	"usespotlight.ai/data-plane/host/internal/workingcopyhook"
	"usespotlight.ai/data-plane/protocol"
)

// hookCopies keeps the workspaces of sandboxes in the store of the host's pool or trust, through its working copy hook.
type hookCopies struct {
	hook *workingcopyhook.Hook
}

func workingCopiesOf(cfg config.Config) serve.WorkingCopies {
	if cfg.WorkingCopyHook == "" {
		return nil
	}
	return hookCopies{hook: workingcopyhook.New(cfg.WorkingCopyHook, filepath.Join(cfg.State, "working-copies"))}
}

func (h hookCopies) Check(ctx context.Context, store protocol.WorkingCopyStore) error {
	return h.hook.Check(ctx, store)
}

func (h hookCopies) Open(ctx context.Context, store protocol.WorkingCopyStore, name, from string) (serve.WorkingCopy, bool, error) {
	opened, restored, err := h.hook.Open(ctx, store, name, from)
	if err != nil {
		return nil, false, err
	}
	return opened, restored, nil
}

func (h hookCopies) Adopt(name string) (serve.WorkingCopy, bool) {
	adopted, ok := h.hook.Adopt(name)
	if !ok {
		return nil, false
	}
	return adopted, true
}

func (h hookCopies) Left() []string { return h.hook.Left() }

func (h hookCopies) RemoveSnapshot(ctx context.Context, store protocol.WorkingCopyStore, snapshot string) error {
	return h.hook.RemoveSnapshot(ctx, store, snapshot)
}
