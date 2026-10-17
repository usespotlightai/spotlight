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

func walk(t *testing.T, from session.State, triggers ...session.Trigger) session.State {
	t.Helper()

	state := from
	for _, trigger := range triggers {
		next, err := session.Next(state, trigger)
		if err != nil {
			t.Fatalf("%s while %s: %v", trigger, state, err)
		}
		state = next
	}
	return state
}

func TestARunEscalatedToAPersonWaitsAndRunsAgainOnceAnswered(t *testing.T) {
	state := walk(t, session.Running, session.PersonAsked)
	if state != session.Waiting {
		t.Fatalf("a run escalated to a person is %s", state)
	}

	state = walk(t, state, session.PersonAnswered, session.PersonAsked, session.PersonAnswered,
		session.AgentExited, session.Drained)
	if state != session.Completed {
		t.Errorf("a run answered twice then finished is %s", state)
	}
}

func TestAWaitingRunNobodyAnsweredIsSuspendedAndOver(t *testing.T) {
	state := walk(t, session.Running, session.PersonAsked, session.RunSuspended)
	if state != session.Suspended {
		t.Fatalf("a run suspended while waiting is %s", state)
	}

	for _, trigger := range []session.Trigger{session.PersonAnswered, session.AgentExited, session.Errored} {
		if _, err := session.Next(state, trigger); err == nil {
			t.Errorf("a suspended run could still be %s", trigger)
		}
	}
}

func TestAWaitingRunStoppedDrainsLikeAnyOther(t *testing.T) {
	if state := walk(t, session.Running, session.PersonAsked, session.AgentExited, session.Drained); state != session.Completed {
		t.Errorf("a run stopped while it waited is %s", state)
	}
}

func TestAnythingCanGoWrongUntilItIsOver(t *testing.T) {
	for _, from := range []session.State{session.Preparing, session.Running, session.Waiting, session.Draining} {
		next, err := session.Next(from, session.Errored)
		if err != nil {
			t.Fatalf("failing while %s: %v", from, err)
		}
		if next != session.Failed {
			t.Errorf("failing while %s gave %s", from, next)
		}
	}
}

func TestNextRejectsWhatCannotHappen(t *testing.T) {
	for _, impossible := range []struct {
		from    session.State
		trigger session.Trigger
	}{
		{session.Preparing, session.AgentExited},
		{session.Preparing, session.Drained},
		{session.Running, session.AgentStarted},
		{session.Running, session.Drained},
		{session.Running, session.PersonAnswered},
		{session.Running, session.RunSuspended},
		{session.Preparing, session.PersonAsked},
		{session.Waiting, session.PersonAsked},
		{session.Waiting, session.Drained},
		{session.Draining, session.AgentExited},
		{session.Completed, session.Drained},
		{session.Failed, session.Errored},
	} {
		if _, err := session.Next(impossible.from, impossible.trigger); err == nil {
			t.Errorf("%s while %s should be rejected", impossible.trigger, impossible.from)
		}
	}
}
