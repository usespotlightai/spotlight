package session

import (
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/agentapi"
)

func TestNamesAPathByItsCheckoutWithinTheWorkspace(t *testing.T) {
	dir := t.TempDir()
	checkouts := []protocol.Checkout{{Path: "api"}, {Path: "web"}}

	within, err := checkedOutPaths(dir, checkouts, []string{
		filepath.Join(dir, "api", "src", "uploads"),
		filepath.Join(dir, "web"),
	})
	if err != nil {
		t.Fatal(err)
	}

	if strings.Join(within, " ") != "api/src/uploads web" {
		t.Errorf("named %v", within)
	}
}

func TestRejectsAPathOutsideTheCheckoutsNamingWhereToLook(t *testing.T) {
	dir := t.TempDir()
	checkouts := []protocol.Checkout{{Path: "api"}}

	for _, outside := range []string{
		"/etc/passwd",
		filepath.Join(dir, "notes.md"),
		filepath.Join(dir, "api", "..", "secrets"),
		filepath.Join(dir, "apis", "src"),
	} {
		_, err := checkedOutPaths(dir, checkouts, []string{outside})

		var rejected *agentapi.Error
		if !errors.As(err, &rejected) {
			t.Fatalf("%s: got %v", outside, err)
		}
		if !strings.Contains(rejected.Because, filepath.Join(dir, "api")) {
			t.Errorf("%s: the error names nowhere to look: %s", outside, rejected.Because)
		}
	}
}
