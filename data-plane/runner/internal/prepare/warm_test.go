package prepare_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/prepare"
)

func mirrorOf(t *testing.T, mirrors, name string) string {
	t.Helper()

	source := t.TempDir()
	git(t, source, "init", "--quiet", "--initial-branch", "trunk")
	write(t, filepath.Join(source, "package-lock.json"), "{}")
	git(t, source, "add", ".")
	git(t, source, "commit", "--quiet", "-m", "one")

	mirror := filepath.Join(mirrors, name+".git")
	git(t, mirrors, "clone", "--quiet", "--bare", source, mirror)
	return mirror
}

func TestAWarmCheckoutIsClonedFromTheHostsMirrorAtItsDefaultBranch(t *testing.T) {
	mirrors, dir := t.TempDir(), t.TempDir()
	mirrorOf(t, mirrors, "web")

	if err := prepare.FromMirror(context.Background(), mirrors, dir, protocol.WarmCheckout{Path: "web"}); err != nil {
		t.Fatal(err)
	}

	if got := git(t, filepath.Join(dir, "web"), "branch", "--show-current"); got != "trunk" {
		t.Errorf("the warm checkout is on %q, want trunk", got)
	}
	if _, err := os.Stat(filepath.Join(dir, "web", "package-lock.json")); err != nil {
		t.Errorf("the warm checkout has no files: %v", err)
	}
}

func TestAWarmCheckoutRefusesAMissingMirrorOrAMirrorWithNoDefaultBranch(t *testing.T) {
	mirrors, dir := t.TempDir(), t.TempDir()

	err := prepare.FromMirror(context.Background(), mirrors, dir, protocol.WarmCheckout{Path: "web"})
	if err == nil || !strings.Contains(err.Error(), "no mirror of web") {
		t.Errorf("a missing mirror gave %v", err)
	}

	mirror := mirrorOf(t, mirrors, "api")
	git(t, mirror, "symbolic-ref", "HEAD", "refs/heads/gone")

	err = prepare.FromMirror(context.Background(), mirrors, dir, protocol.WarmCheckout{Path: "api"})
	if err == nil || !strings.Contains(err.Error(), "names no default branch") {
		t.Errorf("a mirror with a dangling HEAD gave %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "api")); !os.IsNotExist(err) {
		t.Errorf("the empty clone stayed: %v", err)
	}
}

func TestAWarmCheckoutRefusesAPathOutsideTheWorkspace(t *testing.T) {
	for _, path := range []string{"../web", "a/b", ""} {
		if err := prepare.FromMirror(context.Background(), t.TempDir(), t.TempDir(), protocol.WarmCheckout{Path: path}); err == nil {
			t.Errorf("the path %q was taken", path)
		}
	}
}
