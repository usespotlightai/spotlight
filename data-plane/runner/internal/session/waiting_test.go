package session_test

import (
	"slices"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const eachTurn = `globalThis.turns = (globalThis.turns ?? 0) + 1;
said = [globalThis.turns, process.pid, sessionId, msg.params.prompt[0].text].join("|") + "\n";`

type heardTurn struct {
	number, process, session, prompt string
}

func turns(t *testing.T, written *journal) []heardTurn {
	t.Helper()

	var heard []heardTurn
	for _, line := range strings.Split(strings.TrimSpace(said(t, written)), "\n") {
		parts := strings.SplitN(line, "|", 4)
		if len(parts) != 4 {
			t.Fatalf("the harness said %q", line)
		}
		heard = append(heard, heardTurn{parts[0], parts[1], parts[2], parts[3]})
	}
	return heard
}

func putToAPerson(o *runOptions) {
	o.briefing = "review the queue"
	o.waits = []bool{true}
}

func TestAnAnswerWithinTheGraceIsSaidIntoTheSameLiveSession(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), putToAPerson, func(o *runOptions) {
		o.answers = [][]protocol.Said{{{Position: 4, Body: "yes, go ahead"}}}
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	heard := turns(t, written)
	if len(heard) != 2 || heard[0].prompt != "review the queue" || heard[1].prompt != "yes, go ahead" {
		t.Fatalf("the agent heard %+v", heard)
	}
	if heard[1].number != "2" || heard[1].process != heard[0].process || heard[1].session != heard[0].session {
		t.Errorf("the answer reached another harness or session: %+v", heard)
	}
	if !slices.Equal(written.delivered, []int{4}) {
		t.Errorf("marked delivered %v, wanted [4]", written.delivered)
	}
	if written.parks != 0 {
		t.Errorf("parked %d times a run that was answered in time", written.parks)
	}
	if len(written.completions) != 2 || written.done.Failed || written.done.Stopped {
		t.Errorf("completions %+v", written.completions)
	}
}

func TestNobodyAnsweringInTimeParksTheRunAndCompletesItNoMore(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), putToAPerson, func(o *runOptions) {
		o.answerWait = 30 * time.Millisecond
		o.heartbeat = 5 * time.Millisecond
	})

	if written.parks != 1 {
		t.Errorf("parked %d times, wanted once", written.parks)
	}
	if len(written.completions) != 1 {
		t.Errorf("completed %d times, wanted the turn's one: %+v", len(written.completions), written.completions)
	}
	if len(written.delivered) != 0 {
		t.Errorf("marked delivered %v with nothing said", written.delivered)
	}
}

func TestAGraceOfNothingParksAtOnce(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), putToAPerson, func(o *runOptions) {
		o.answerWait = 0
		o.heartbeat = time.Hour
	})

	if written.parks != 1 || len(written.completions) != 1 {
		t.Errorf("parked %d times after %d completions", written.parks, len(written.completions))
	}
}

func TestAnAnswerThatArrivesWhileParkingIsSaidIntoTheLiveSession(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), putToAPerson, func(o *runOptions) {
		o.parking = []bool{false}
		o.answers = [][]protocol.Said{{{Position: 5, Body: "just in time"}}}
		o.answerWait = 10 * time.Millisecond
		o.heartbeat = time.Hour
	})

	heard := turns(t, written)
	if len(heard) != 2 || heard[1].prompt != "just in time" || heard[1].process != heard[0].process {
		t.Fatalf("the agent heard %+v", heard)
	}
	if !slices.Equal(written.delivered, []int{5}) {
		t.Errorf("marked delivered %v, wanted [5]", written.delivered)
	}
	if written.parks != 1 || len(written.completions) != 2 {
		t.Errorf("parked %d times, completed %d times", written.parks, len(written.completions))
	}
}

func TestAStopWhileWaitingCompletesTheRunAsStopped(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), putToAPerson, func(o *runOptions) {
		o.stopWaiting = true
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if len(written.completions) != 2 {
		t.Fatalf("completions %+v", written.completions)
	}
	if last := written.completions[1]; !last.Stopped || last.Failed {
		t.Errorf("a run stopped while it waited completed as %+v", last)
	}
	if written.parks != 0 {
		t.Errorf("parked %d times a run that was stopped", written.parks)
	}
}

func TestAPermissionPutToAPersonIsAskedForAgainOnceAnswered(t *testing.T) {
	written := run(t, permitting(t), putToAPerson, func(o *runOptions) {
		o.setup = protocol.HarnessSetup{Asks: []string{"execute"}}
		o.decision = protocol.PermissionPutToPerson
		o.answers = [][]protocol.Said{{{Position: 2, Body: "go ahead"}}}
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if len(written.asked) != 2 {
		t.Errorf("asked the control plane %d times, wanted once a turn", len(written.asked))
	}
	if len(written.completions) != 2 || written.done.Failed {
		t.Errorf("completions %+v", written.completions)
	}
}

func TestEachTurnReportsOnlyWhatItDeclared(t *testing.T) {
	declaringFirst := `if ((globalThis.turns = (globalThis.turns ?? 0) + 1) === 1) execSync(` + "`" +
		`node -e '
      fetch(process.env.SPOTLIGHT_HANDOVER_URL, {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_HANDOVER_TOKEN },
        body: JSON.stringify({ next: "review", note: "is this right?" }),
      }).then(() => process.exit(0));
    '` + "`" + `); said = "turn " + globalThis.turns;`

	written := run(t, harness(t, declaringFirst, "end_turn"), putToAPerson, func(o *runOptions) {
		o.handover = []string{"review"}
		o.answers = [][]protocol.Said{{{Position: 1, Body: "yes"}}}
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if len(written.completions) != 2 {
		t.Fatalf("completions %+v", written.completions)
	}
	if first := written.completions[0].Outcome; first == nil || first.Next != "review" {
		t.Errorf("the asking turn reported %+v", first)
	}
	if second := written.completions[1].Outcome; second != nil {
		t.Errorf("the answered turn reported the asking turn's declaration again: %+v", second)
	}
}

func TestTheWorkspaceIsKeptBeforeEachTurnIsReportedAndOnlyWhenItChanged(t *testing.T) {
	kept := newKeptArchives(t)

	written := run(t, harness(t, `if ((globalThis.turns = (globalThis.turns ?? 0) + 1) === 1)
  require("node:fs").writeFileSync("notes.md", "asked");
said = "turn " + globalThis.turns;`, "end_turn"), putToAPerson, func(o *runOptions) {
		o.archives = kept
		o.continuity = protocol.Continuity{Key: carriedOn}
		o.answers = [][]protocol.Said{{{Position: 1, Body: "carry on"}}}
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if !slices.Equal(written.sealedBy, []int{1, 1}) {
		t.Errorf("archives sealed by each completion %v, wanted [1 1]", written.sealedBy)
	}
	if got := step(t, written, "archive"); !strings.HasPrefix(got, "Captured the workspace") {
		t.Errorf("the asking turn said %q about keeping its workspace", got)
	}
}

func TestAResumedRunIsToldFirstWhatWasSaidSinceItWasParked(t *testing.T) {
	written := run(t, harness(t, `said = msg.params.prompt[0].text;`, "end_turn"), func(o *runOptions) {
		o.briefing = "review the queue"
		o.continuity = protocol.Continuity{SessionID: "session_known", Resumes: true}
		o.said = [][]protocol.Said{{{Position: 7, Body: "yes, ship it"}}}
	})

	if heard := said(t, written); heard != "yes, ship it" {
		t.Errorf("the resumed agent was told %q", heard)
	}
	if !slices.Equal(written.delivered, []int{7}) {
		t.Errorf("marked delivered %v, wanted [7]", written.delivered)
	}
}

func TestAResumedRunWhoseSessionIsGoneIsBriefedThenToldWhatWasSaid(t *testing.T) {
	written := run(t, harness(t, `said = msg.params.prompt[0].text;`, "end_turn"), func(o *runOptions) {
		o.briefing = "review the queue"
		o.continuity = protocol.Continuity{SessionID: "session_long_gone", Resumes: true}
		o.said = [][]protocol.Said{{{Position: 7, Body: "yes, ship it"}}}
	})

	if heard := said(t, written); heard != "review the queue\n\nyes, ship it" {
		t.Errorf("the agent in a fresh session was told %q", heard)
	}
}

func TestAResumedRunWithNothingSaidCarriesOnRatherThanBeingBriefedAgain(t *testing.T) {
	written := run(t, harness(t, `said = msg.params.prompt[0].text;`, "end_turn"), func(o *runOptions) {
		o.briefing = "review the queue"
		o.continuity = protocol.Continuity{SessionID: "session_known", Resumes: true}
	})

	if heard := said(t, written); strings.Contains(heard, "review the queue") || !strings.Contains(heard, "Carry on") {
		t.Errorf("the agent was told %q", heard)
	}
	if len(written.delivered) != 0 {
		t.Errorf("marked delivered %v with nothing said", written.delivered)
	}
}

func TestAPermissionAnsweredBeforeTheTurnEndsIsSaidAtOnceWithoutWaiting(t *testing.T) {
	written := run(t, permitting(t), func(o *runOptions) {
		o.briefing = "push the fix"
		o.setup = protocol.HarnessSetup{Asks: []string{"execute"}}
		o.decision = protocol.PermissionPutToPerson
		o.said = [][]protocol.Said{{{Position: 2, Body: "go ahead"}}}
		o.answerWait = time.Minute
		o.heartbeat = time.Hour
	})

	if !slices.Equal(written.delivered, []int{2}) {
		t.Errorf("marked delivered %v, wanted [2]", written.delivered)
	}
	if len(written.asked) != 2 {
		t.Errorf("asked the control plane %d times, wanted again once answered", len(written.asked))
	}
	if len(written.completions) != 1 || written.parks != 0 {
		t.Errorf("completed %d times and parked %d times", len(written.completions), written.parks)
	}
}

func TestAResumedRunInAFreshSessionWithNothingSaidIsBriefed(t *testing.T) {
	written := run(t, harness(t, `said = msg.params.prompt[0].text;`, "end_turn"), func(o *runOptions) {
		o.briefing = "review the queue"
		o.continuity = protocol.Continuity{SessionID: "session_long_gone", Resumes: true}
	})

	if heard := said(t, written); heard != "review the queue" {
		t.Errorf("the agent was told %q", heard)
	}
}

func TestATurnSaysWhetherItsWorkspaceIsKept(t *testing.T) {
	kept := run(t, harness(t, eachTurn, "end_turn"), func(o *runOptions) {
		o.archives = newKeptArchives(t)
		o.continuity = protocol.Continuity{Key: carriedOn}
	})
	unkept := run(t, harness(t, eachTurn, "end_turn"), func(o *runOptions) {
		o.continuity = protocol.Continuity{Key: carriedOn}
	})

	if !kept.done.Kept || unkept.done.Kept {
		t.Errorf("reported kept %v with somewhere to keep it and %v without", kept.done.Kept, unkept.done.Kept)
	}
}

func TestATurnAsksWhetherItWaitsBeforeItKeepsTheWorkspace(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), func(o *runOptions) {
		o.archives = newKeptArchives(t)
		o.continuity = protocol.Continuity{Key: carriedOn}
	})

	if !slices.Equal(written.calls, []string{"asks", "archive", "complete"}) {
		t.Errorf("the turn end went %v", written.calls)
	}
}

func TestAWaitingRunItsTaskLetGoOfLetsTheSandboxGoWithoutCompletingAgain(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), putToAPerson, func(o *runOptions) {
		o.lostWaiting = true
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if len(written.completions) != 1 || written.parks != 0 {
		t.Errorf("completed %d times and parked %d times a run it no longer leased", len(written.completions), written.parks)
	}
}

func TestAnAnswerNeverThereWhileParkingLetsTheRunGoAfterAFewTries(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), putToAPerson, func(o *runOptions) {
		o.parking = []bool{false, false, false, false}
		o.answerWait = 5 * time.Millisecond
		o.heartbeat = 5 * time.Millisecond
	})

	if written.parks != 3 {
		t.Errorf("parked %d times, wanted to give up after 3", written.parks)
	}
	if len(written.completions) != 1 {
		t.Errorf("completions %+v", written.completions)
	}
}

func TestAPausedRunsWorkspaceIsRestoredForTheRunnerThatTakesItUp(t *testing.T) {
	kept := newKeptArchives(t)

	paused := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "asked"); said = "asked";`, "end_turn"), putToAPerson, func(o *runOptions) {
		o.archives = kept
		o.continuity = protocol.Continuity{Key: carriedOn}
		o.answerWait = 0
		o.heartbeat = time.Hour
	})
	if paused.parks != 1 || !paused.done.Kept {
		t.Fatalf("parked %d times, kept %v", paused.parks, paused.done.Kept)
	}

	resumed := run(t, harness(t, `said = require("node:fs").readFileSync("notes.md", "utf8") + " | " + msg.params.prompt[0].text;`, "end_turn"), func(o *runOptions) {
		o.archives = kept
		o.continuity = protocol.Continuity{Key: carriedOn, SessionID: "session_known", Resumes: true}
		o.said = [][]protocol.Said{{{Position: 3, Body: "go ahead"}}}
	})

	if got := said(t, resumed); got != "asked | go ahead" {
		t.Errorf("the runner that took it up found %q", got)
	}
}

func TestARenewalThatConflictsWhileWaitingKeepsTheRunAndItsAnswer(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), putToAPerson, func(o *runOptions) {
		o.conflicts = 3
		o.answers = [][]protocol.Said{nil, nil, nil, nil, {{Position: 4, Body: "go ahead"}}}
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if !slices.Equal(written.delivered, []int{4}) || written.parks != 0 {
		t.Errorf("delivered %v and parked %d times", written.delivered, written.parks)
	}
}

func TestAnAnswerThatBeatsParkingAClosedHarnessSendsTheRunBackOnTheQueue(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), putToAPerson, func(o *runOptions) {
		o.saysNoWait = true
		o.parking = []bool{false}
		o.answerWait = time.Minute
		o.heartbeat = time.Hour
	})

	if written.coldParks != 1 || len(written.delivered) != 0 {
		t.Errorf("parked cold %d times and delivered %v", written.coldParks, written.delivered)
	}
}
