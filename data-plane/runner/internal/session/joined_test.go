package session

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestTheCheckoutsARestoredWorkspaceDoesNotHaveAreTheOnesItWillClone(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "api", ".git"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "web"), 0o700); err != nil {
		t.Fatal(err)
	}

	missing := missingCheckouts(dir, []protocol.Checkout{{Path: "api"}, {Path: "web"}, {Path: "config"}, {}})

	if !slices.Equal(missing, []string{"web", "config"}) {
		t.Errorf("found %v not checked out, want [web config]", missing)
	}
}

func TestAResumedSessionHearsWhichRepositoriesJoinedTheWorkspace(t *testing.T) {
	if got := newRepositoriesNote(nil); got != "" {
		t.Errorf("no new repository said %q", got)
	}
	if got := newRepositoriesNote([]string{"spotlight-config", "docs"}); !strings.Contains(got, "spotlight-config, docs.") || !strings.HasSuffix(got, "\n\n") {
		t.Errorf("new repositories said %q", got)
	}
}
