package serve

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"usespotlight.ai/data-plane/host/internal/mirror"
	"usespotlight.ai/data-plane/protocol"
)

func TestAWarmSandboxMountsOnlyTheMirrorsTheHostHas(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "workspace_1", "web.git", "objects"), 0o755); err != nil {
		t.Fatal(err)
	}
	host := &Host{mirrors: mirror.At(root), workspace: "workspace_1"}

	mounts := host.mountMirrors(context.Background(), protocol.Assignment{Work: protocol.ClaimResponse{
		Kind: protocol.ClaimedSandbox,
		Warm: &protocol.WarmSandbox{Checkouts: []protocol.WarmCheckout{{Path: "web"}, {Path: "docs"}}},
	}}, slog.New(slog.NewTextHandler(io.Discard, nil)))

	if len(mounts) != 1 || mounts[0].Target != MirrorRoot+"/web.git" || !mounts[0].ReadOnly {
		t.Errorf("mounted %+v, want only web read-only", mounts)
	}
}
