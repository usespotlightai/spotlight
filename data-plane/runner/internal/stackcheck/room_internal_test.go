package stackcheck

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"syscall"
	"testing"

	"usespotlight.ai/data-plane/runner/internal/account"
)

func TestACheckoutMadeForAnotherUserIsOneTheyCanWorkIn(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("handing a directory to another user needs root")
	}

	nobody := &account.User{UID: 65534, GID: 65534}
	space := t.TempDir()
	for _, dir := range []string{filepath.Dir(space), space} {
		if err := os.Chmod(dir, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	tree := filepath.Join(space, "acme", "widgets")

	o := Options{Log: slog.New(slog.NewTextHandler(io.Discard, nil)), RunAs: nobody}
	if err := o.makeRoom(tree); err != nil {
		t.Fatalf("makeRoom: %v", err)
	}

	for _, dir := range []string{filepath.Join(space, "acme"), tree} {
		info, err := os.Stat(dir)
		if err != nil {
			t.Fatal(err)
		}
		if owner := info.Sys().(*syscall.Stat_t); owner.Uid != nobody.UID || owner.Gid != nobody.GID {
			t.Errorf("%s is owned by %d:%d, want %d:%d", dir, owner.Uid, owner.Gid, nobody.UID, nobody.GID)
		}
	}
	if info, _ := os.Stat(space); info.Sys().(*syscall.Stat_t).Uid != 0 {
		t.Errorf("the workspace itself changed hands; only what makeRoom created should")
	}

	if output, err := o.git(context.Background(), tree, "", "init", "--quiet"); err != nil {
		t.Fatalf("git init as the agent: %v: %s", err, output)
	}
}
