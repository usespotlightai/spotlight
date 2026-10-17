package session

import (
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestViaGitProxyServesEachRepositoryUnderItsOwnPath(t *testing.T) {
	checkouts := []protocol.Checkout{
		{Remote: protocol.ThroughSpotlight, Path: "api", Branch: "spotlight/task_1"},
		{Remote: protocol.ThroughSpotlight, Path: "web", Branch: "spotlight/task_1"},
	}

	resolved := viaGitProxy(checkouts, "http://127.0.0.1:9000/run_1")

	if got := resolved[0].Remote; got != "http://127.0.0.1:9000/run_1/api" {
		t.Fatalf("first repository goes to %q", got)
	}
	if got := resolved[1].Remote; got != "http://127.0.0.1:9000/run_1/web" {
		t.Fatalf("second repository goes to %q", got)
	}
}

func TestViaGitProxyLeavesAnyOtherRemoteAlone(t *testing.T) {
	checkouts := []protocol.Checkout{
		{Remote: "https://example.com/acme/api.git", Path: "api"},
	}

	resolved := viaGitProxy(checkouts, "http://127.0.0.1:9000/run_1")

	if got := resolved[0].Remote; got != "https://example.com/acme/api.git" {
		t.Fatalf("left-alone remote became %q", got)
	}
}
