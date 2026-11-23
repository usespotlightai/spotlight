package protocol_test

import (
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestKnowsTheSnapshotsSpotlightGrants(t *testing.T) {
	for _, name := range []string{"spotlight-0b6f3c2e-6c55-4b8e-9d7a-2f4e1a9c8d31", "spotlight-archive_1"} {
		if !protocol.IsSpotlightSnapshot(name) {
			t.Errorf("%q is a snapshot Spotlight grants", name)
		}
	}
	for _, name := range []string{
		"", "base-v1", "spotlight-", "spotlight-..", "spotlight-../x", "spotlight-a/b", "spotlight-a b",
		"spotlight-a.b", "spotlight-" + strings.Repeat("a", 65),
	} {
		if protocol.IsSpotlightSnapshot(name) {
			t.Errorf("%q is no snapshot Spotlight grants", name)
		}
	}
}
