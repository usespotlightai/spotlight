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

func TestAResumedSessionHearsWhichToolsItGainedAndLost(t *testing.T) {
	if got := changedToolsNote(nil); got != "" {
		t.Errorf("no tool change said %q", got)
	}
	got := changedToolsNote(&protocol.ChangedTools{Added: []string{"sentry.get-issue", "sentry.get-latest-event"}, Removed: []string{"linear.get-issue"}})
	if !strings.Contains(got, "sentry.get-issue, sentry.get-latest-event.") || !strings.Contains(got, "no longer use these tools: linear.get-issue.") || !strings.HasSuffix(got, "\n\n") {
		t.Errorf("a tool change said %q", got)
	}
	if got := changedToolsNote(&protocol.ChangedTools{Removed: []string{"linear.get-issue"}}); strings.Contains(got, "can now use") {
		t.Errorf("a lost tool alone said %q", got)
	}
}
