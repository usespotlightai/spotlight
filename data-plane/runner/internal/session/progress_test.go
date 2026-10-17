package session

import "testing"

func TestProgressAdvancesThroughLegalSteps(t *testing.T) {
	lifecycle := &progress{state: Preparing}

	for _, trigger := range []Trigger{WorkspaceReady, AgentStarted, AgentExited, Drained} {
		if err := lifecycle.reach(trigger); err != nil {
			t.Fatalf("%s: %v", trigger, err)
		}
	}

	if lifecycle.state != Completed {
		t.Errorf("ended at %s", lifecycle.state)
	}
}

func TestProgressRejectsAnIllegalStepAndStaysPut(t *testing.T) {
	lifecycle := &progress{state: Preparing}

	if err := lifecycle.reach(Drained); err == nil {
		t.Fatal("draining before running should be rejected")
	}

	if lifecycle.state != Preparing {
		t.Errorf("a rejected step moved the run to %s", lifecycle.state)
	}
}
