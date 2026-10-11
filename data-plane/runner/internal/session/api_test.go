package session

import (
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestReachingAPIGivesTheControlPlaneAndAStandInForTheToken(t *testing.T) {
	got := reachingAPI(protocol.Spec{SpotlightAPI: true}, "https://spotlight.example.com")

	if got[APIURLVar] != "https://spotlight.example.com" {
		t.Fatalf("%s = %q", APIURLVar, got[APIURLVar])
	}
	if got[APITokenVar] != protocol.SpotlightAPIStandIn {
		t.Fatalf("%s = %q, want the stand-in egress replaces", APITokenVar, got[APITokenVar])
	}
}

func TestReachingAPIGivesNothingToARunThatDoesNotReachIt(t *testing.T) {
	if got := reachingAPI(protocol.Spec{}, "https://spotlight.example.com"); got != nil {
		t.Fatalf("got %v, want nothing", got)
	}
}
