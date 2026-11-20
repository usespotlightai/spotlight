package session

import (
	"context"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestAResumedConversationHearsOnlyTheFollowUp(t *testing.T) {
	talk := &conversation{
		run: protocol.Run{Spec: protocol.Spec{
			Briefing: "You are planning work.\n\nDo the whole set.",
			Resume:   protocol.Resume{SessionID: "session_1", FollowUp: "Do the whole set."},
		}},
		sessionID: "session_1",
	}

	if got := talk.opening(context.Background()); got != "Do the whole set." {
		t.Errorf("the opening is %q", got)
	}
}

func TestAConversationTheHarnessLostHearsTheWholeBriefing(t *testing.T) {
	talk := &conversation{
		run: protocol.Run{Spec: protocol.Spec{
			Briefing: "You are planning work.\n\nDo the whole set.",
			Resume:   protocol.Resume{SessionID: "session_1", FollowUp: "Do the whole set."},
		}},
		sessionID: "session_2",
	}

	if got := talk.opening(context.Background()); got != "You are planning work.\n\nDo the whole set." {
		t.Errorf("the opening is %q", got)
	}
}
