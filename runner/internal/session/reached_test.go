package session

import (
	"testing"

	"usespotlight.ai/runner/internal/protocol"
)

// A run may work several repositories. Each is served under its own path, so
// the control plane can tell which one a git call is for.
func TestReachedServesEachRepositoryUnderItsOwnPath(t *testing.T) {
	checkouts := []protocol.Checkout{
		{Remote: protocol.ThroughSpotlight, Path: "api", Branch: "spotlight/task_1"},
		{Remote: protocol.ThroughSpotlight, Path: "web", Branch: "spotlight/task_1"},
	}

	resolved := reached(checkouts, "http://127.0.0.1:9000/run_1")

	if got := resolved[0].Remote; got != "http://127.0.0.1:9000/run_1/api" {
		t.Fatalf("first repository reached %q", got)
	}
	if got := resolved[1].Remote; got != "http://127.0.0.1:9000/run_1/web" {
		t.Fatalf("second repository reached %q", got)
	}
}

// A remote that is not the stand-in is the hook's to make sense of, so it is
// left exactly as it came.
func TestReachedLeavesAnyOtherRemoteAlone(t *testing.T) {
	checkouts := []protocol.Checkout{
		{Remote: "https://example.com/acme/api.git", Path: "api"},
	}

	resolved := reached(checkouts, "http://127.0.0.1:9000/run_1")

	if got := resolved[0].Remote; got != "https://example.com/acme/api.git" {
		t.Fatalf("left-alone remote became %q", got)
	}
}
