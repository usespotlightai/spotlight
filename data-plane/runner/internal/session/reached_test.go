package session

import (
	"testing"

	"usespotlight.ai/data-plane/internal/protocol"
)

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

func TestReachedLeavesAnyOtherRemoteAlone(t *testing.T) {
	checkouts := []protocol.Checkout{
		{Remote: "https://example.com/acme/api.git", Path: "api"},
	}

	resolved := reached(checkouts, "http://127.0.0.1:9000/run_1")

	if got := resolved[0].Remote; got != "https://example.com/acme/api.git" {
		t.Fatalf("left-alone remote became %q", got)
	}
}
