package session_test

import (
	"testing"

	"usespotlight.ai/data-plane/runner/internal/session"
)

func TestNextFollowsTheHappyPath(t *testing.T) {
	state := session.Preparing

	for _, step := range []struct {
		trigger session.Trigger
		want    session.State
	}{
		{session.WorkspaceReady, session.Preparing},
		{session.AgentStarted, session.Running},
		{session.AgentExited, session.Draining},
		{session.Drained, session.Completed},
	} {
		next, err := session.Next(state, step.trigger)
		if err != nil {
			t.Fatalf("%s while %s: %v", step.trigger, state, err)
		}
		if next != step.want {
			t.Fatalf("%s while %s gave %s, want %s", step.trigger, state, next, step.want)
		}
		state = next
	}

	if state != session.Completed {
		t.Errorf("%s should be completed", state)
	}
}

func TestAnythingCanGoWrongUntilItIsOver(t *testing.T) {
	for _, from := range []session.State{session.Preparing, session.Running, session.Draining} {
		next, err := session.Next(from, session.WentWrong)
		if err != nil {
			t.Fatalf("failing while %s: %v", from, err)
		}
		if next != session.Failed {
			t.Errorf("failing while %s gave %s", from, next)
		}
	}
}

func TestNextRefusesWhatCannotHappen(t *testing.T) {
	for _, impossible := range []struct {
		from    session.State
		trigger session.Trigger
	}{
		{session.Preparing, session.AgentExited},
		{session.Preparing, session.Drained},
		{session.Running, session.AgentStarted},
		{session.Running, session.Drained},
		{session.Draining, session.AgentExited},
		{session.Completed, session.Drained},
		{session.Failed, session.WentWrong},
	} {
		if _, err := session.Next(impossible.from, impossible.trigger); err == nil {
			t.Errorf("%s while %s should be refused", impossible.trigger, impossible.from)
		}
	}
}
