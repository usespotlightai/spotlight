package session

import (
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestUsesAPISetsTheControlPlaneAndAStandInForTheToken(t *testing.T) {
	got := usesAPI(protocol.Spec{SpotlightAPI: true}, "https://spotlight.example.com")

	if got[APIURLVar] != "https://spotlight.example.com" {
		t.Fatalf("%s = %q", APIURLVar, got[APIURLVar])
	}
	if got[APITokenVar] != protocol.SpotlightAPIStandIn {
		t.Fatalf("%s = %q, want the stand-in egress replaces", APITokenVar, got[APITokenVar])
	}
}

func TestUsesAPISetsNothingForARunThatDoesNotUseIt(t *testing.T) {
	if got := usesAPI(protocol.Spec{}, "https://spotlight.example.com"); got != nil {
		t.Fatalf("got %v, want nothing", got)
	}
}
