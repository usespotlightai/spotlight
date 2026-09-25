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

func TestProgressRefusesAnIllegalStepAndStaysPut(t *testing.T) {
	lifecycle := &progress{state: Preparing}

	if err := lifecycle.reach(Drained); err == nil {
		t.Fatal("draining before running should be refused")
	}

	if lifecycle.state != Preparing {
		t.Errorf("a refused step moved the run to %s", lifecycle.state)
	}
}
