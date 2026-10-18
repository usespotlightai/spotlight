package session_test

import (
	"slices"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const eachTurn = `globalThis.turns = (globalThis.turns ?? 0) + 1;
output = [globalThis.turns, process.pid, sessionId, msg.params.prompt[0].text].join("|") + "\n";`

type agentTurn struct {
	number, process, session, prompt string
}

func turns(t *testing.T, written *journal) []agentTurn {
	t.Helper()

	var got []agentTurn
	for _, line := range strings.Split(strings.TrimSpace(agentOutput(t, written)), "\n") {
		parts := strings.SplitN(line, "|", 4)
		if len(parts) != 4 {
			t.Fatalf("the harness wrote %q", line)
		}
		got = append(got, agentTurn{parts[0], parts[1], parts[2], parts[3]})
	}
	return got
}

func escalatesToAPerson(o *runOptions) {
	o.briefing = "review the queue"
	o.waits = []bool{true}
}

func TestAnAnswerWithinTheGraceIsSentIntoTheSameLiveSession(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.answers = [][]protocol.Message{{{Position: 4, Body: "yes, go ahead"}}}
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	got := turns(t, written)
	if len(got) != 2 || got[0].prompt != "review the queue" || got[1].prompt != "yes, go ahead" {
		t.Fatalf("the agent got %+v", got)
	}
	if got[1].number != "2" || got[1].process != got[0].process || got[1].session != got[0].session {
		t.Errorf("the answer went to another harness or session: %+v", got)
	}
	if !slices.Equal(written.acked, []int{4}) {
		t.Errorf("acknowledged %v, wanted [4]", written.acked)
	}
	if written.suspends != 0 {
		t.Errorf("suspended %d times a run that was answered in time", written.suspends)
	}
	if len(written.completions) != 2 || written.done.Failed || written.done.Stopped {
		t.Errorf("completions %+v", written.completions)
	}
}

func TestARunNobodyAnswersInTimeIsSuspendedAndCompletesNoMore(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.answerWait = 30 * time.Millisecond
		o.heartbeat = 5 * time.Millisecond
	})

	if written.suspends != 1 {
		t.Errorf("suspended %d times, wanted once", written.suspends)
	}
	if len(written.completions) != 1 {
		t.Errorf("completed %d times, wanted the turn's one: %+v", len(written.completions), written.completions)
	}
	if len(written.acked) != 0 {
		t.Errorf("acknowledged %v with no message", written.acked)
	}
}

func TestAGraceOfNothingSuspendsAtOnce(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.answerWait = 0
		o.heartbeat = time.Hour
	})

	if written.suspends != 1 || len(written.completions) != 1 {
		t.Errorf("suspended %d times after %d completions", written.suspends, len(written.completions))
	}
}

func TestAnAnswerThatArrivesWhileSuspendingIsSentIntoTheLiveSession(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.suspending = []bool{false}
		o.answers = [][]protocol.Message{{{Position: 5, Body: "just in time"}}}
		o.answerWait = 10 * time.Millisecond
		o.heartbeat = time.Hour
	})

	got := turns(t, written)
	if len(got) != 2 || got[1].prompt != "just in time" || got[1].process != got[0].process {
		t.Fatalf("the agent got %+v", got)
	}
	if !slices.Equal(written.acked, []int{5}) {
		t.Errorf("acknowledged %v, wanted [5]", written.acked)
	}
	if written.suspends != 1 || len(written.completions) != 2 {
		t.Errorf("suspended %d times, completed %d times", written.suspends, len(written.completions))
	}
}

func TestAStopWhileWaitingCompletesTheRunAsStopped(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), escalatesToAPerson, func(o *runOptions) {
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
	if written.suspends != 0 {
		t.Errorf("suspended %d times a run that was stopped", written.suspends)
	}
}

func TestAPermissionEscalatedToAPersonIsAskedForAgainOnceAnswered(t *testing.T) {
	written := run(t, permitting(t), escalatesToAPerson, func(o *runOptions) {
		o.setup = protocol.HarnessSetup{AskKinds: []string{"execute"}}
		o.decision = protocol.PermissionEscalated
		o.answers = [][]protocol.Message{{{Position: 2, Body: "go ahead"}}}
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if len(written.asked) != 2 {
		t.Errorf("asked for permission %d times, wanted once a turn", len(written.asked))
	}
	if len(written.completions) != 2 || written.done.Failed {
		t.Errorf("completions %+v", written.completions)
	}
}

func TestEachTurnReportsOnlyWhatItHandedOver(t *testing.T) {
	handingOverFirst := `if ((globalThis.turns = (globalThis.turns ?? 0) + 1) === 1) execSync(` + "`" +
		`node -e '
      fetch(process.env.SPOTLIGHT_AGENT_API_URL, {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_AGENT_API_TOKEN },
        body: JSON.stringify({ next: "review", note: "is this right?" }),
      }).then(() => process.exit(0));
    '` + "`" + `); output = "turn " + globalThis.turns;`

	written := run(t, harness(t, handingOverFirst, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.handover = []string{"review"}
		o.answers = [][]protocol.Message{{{Position: 1, Body: "yes"}}}
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if len(written.completions) != 2 {
		t.Fatalf("completions %+v", written.completions)
	}
	if first := written.completions[0].Handover; first == nil || first.Next != "review" {
		t.Errorf("the asking turn reported %+v", first)
	}
	if second := written.completions[1].Handover; second != nil {
		t.Errorf("the answered turn reported the asking turn's handover again: %+v", second)
	}
}

func TestTheWorkspaceIsArchivedBeforeEachTurnIsReportedAndOnlyWhenItChanged(t *testing.T) {
	archives := newArchives(t)

	written := run(t, harness(t, `if ((globalThis.turns = (globalThis.turns ?? 0) + 1) === 1)
  require("node:fs").writeFileSync("notes.md", "asked");
output = "turn " + globalThis.turns;`, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.archives = archives
		o.resume = protocol.Resume{Key: resumeKey}
		o.answers = [][]protocol.Message{{{Position: 1, Body: "carry on"}}}
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if !slices.Equal(written.completedBy, []int{1, 1}) {
		t.Errorf("archives completed by each completion %v, wanted [1 1]", written.completedBy)
	}
	if got := step(t, written, "archive"); !strings.HasPrefix(got, "Captured the workspace") {
		t.Errorf("the asking turn said %q about archiving its workspace", got)
	}
}

func TestAResumedRunGetsFirstTheMessagesSentSinceItWasSuspended(t *testing.T) {
	written := run(t, harness(t, `output = msg.params.prompt[0].text;`, "end_turn"), func(o *runOptions) {
		o.briefing = "review the queue"
		o.resume = protocol.Resume{SessionID: "session_known", ResumeSession: true}
		o.messages = [][]protocol.Message{{{Position: 7, Body: "yes, ship it"}}}
	})

	if output := agentOutput(t, written); output != "yes, ship it" {
		t.Errorf("the resumed agent got %q", output)
	}
	if !slices.Equal(written.acked, []int{7}) {
		t.Errorf("acknowledged %v, wanted [7]", written.acked)
	}
}

func TestAResumedRunWhoseSessionIsGoneIsBriefedThenGetsTheMessages(t *testing.T) {
	written := run(t, harness(t, `output = msg.params.prompt[0].text;`, "end_turn"), func(o *runOptions) {
		o.briefing = "review the queue"
		o.resume = protocol.Resume{SessionID: "session_long_gone", ResumeSession: true}
		o.messages = [][]protocol.Message{{{Position: 7, Body: "yes, ship it"}}}
	})

	if output := agentOutput(t, written); output != "review the queue\n\nyes, ship it" {
		t.Errorf("the agent in a fresh session got %q", output)
	}
}

func TestAResumedRunWithNoMessageCarriesOnRatherThanBeingBriefedAgain(t *testing.T) {
	written := run(t, harness(t, `output = msg.params.prompt[0].text;`, "end_turn"), func(o *runOptions) {
		o.briefing = "review the queue"
		o.resume = protocol.Resume{SessionID: "session_known", ResumeSession: true}
	})

	if output := agentOutput(t, written); strings.Contains(output, "review the queue") || !strings.Contains(output, "Carry on") {
		t.Errorf("the agent got %q", output)
	}
	if len(written.acked) != 0 {
		t.Errorf("acknowledged %v with no message", written.acked)
	}
}

func TestAPermissionAnsweredBeforeTheTurnEndsIsSentAtOnceWithoutWaiting(t *testing.T) {
	written := run(t, permitting(t), func(o *runOptions) {
		o.briefing = "push the fix"
		o.setup = protocol.HarnessSetup{AskKinds: []string{"execute"}}
		o.decision = protocol.PermissionEscalated
		o.messages = [][]protocol.Message{{{Position: 2, Body: "go ahead"}}}
		o.answerWait = time.Minute
		o.heartbeat = time.Hour
	})

	if !slices.Equal(written.acked, []int{2}) {
		t.Errorf("acknowledged %v, wanted [2]", written.acked)
	}
	if len(written.asked) != 2 {
		t.Errorf("asked for permission %d times, wanted again once answered", len(written.asked))
	}
	if len(written.completions) != 1 || written.suspends != 0 {
		t.Errorf("completed %d times and suspended %d times", len(written.completions), written.suspends)
	}
}

func TestAResumedRunInAFreshSessionWithNoMessageIsBriefed(t *testing.T) {
	written := run(t, harness(t, `output = msg.params.prompt[0].text;`, "end_turn"), func(o *runOptions) {
		o.briefing = "review the queue"
		o.resume = protocol.Resume{SessionID: "session_long_gone", ResumeSession: true}
	})

	if output := agentOutput(t, written); output != "review the queue" {
		t.Errorf("the agent got %q", output)
	}
}

func TestATurnSaysWhetherItsWorkspaceIsArchived(t *testing.T) {
	archived := run(t, harness(t, eachTurn, "end_turn"), func(o *runOptions) {
		o.archives = newArchives(t)
		o.resume = protocol.Resume{Key: resumeKey}
	})
	unarchived := run(t, harness(t, eachTurn, "end_turn"), func(o *runOptions) {
		o.resume = protocol.Resume{Key: resumeKey}
	})

	if !archived.done.Archived || unarchived.done.Archived {
		t.Errorf("reported archived %v with somewhere to store it and %v without", archived.done.Archived, unarchived.done.Archived)
	}
}

func TestATurnReadsWhetherItWaitsBeforeItArchivesTheWorkspace(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), func(o *runOptions) {
		o.archives = newArchives(t)
		o.resume = protocol.Resume{Key: resumeKey}
	})

	if !slices.Equal(written.calls, []string{"awaits-person", "archive", "complete"}) {
		t.Errorf("the turn end went %v", written.calls)
	}
}

func TestAWaitingRunItNoLongerLeasesReleasesTheSandboxWithoutCompletingAgain(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.lostWaiting = true
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if len(written.completions) != 1 || written.suspends != 0 {
		t.Errorf("completed %d times and suspended %d times a run it no longer leased", len(written.completions), written.suspends)
	}
}

func TestAnAnswerNeverThereWhileSuspendingReleasesTheRunAfterAFewTries(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.suspending = []bool{false, false, false, false}
		o.answerWait = 5 * time.Millisecond
		o.heartbeat = 5 * time.Millisecond
	})

	if written.suspends != 3 {
		t.Errorf("suspended %d times, wanted to stop after 3", written.suspends)
	}
	if len(written.completions) != 1 {
		t.Errorf("completions %+v", written.completions)
	}
}

func TestAPausedRunsWorkspaceIsRestoredForTheRunnerThatClaimsIt(t *testing.T) {
	archives := newArchives(t)

	paused := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "asked"); output = "asked";`, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.archives = archives
		o.resume = protocol.Resume{Key: resumeKey}
		o.answerWait = 0
		o.heartbeat = time.Hour
	})
	if paused.suspends != 1 || !paused.done.Archived {
		t.Fatalf("suspended %d times, archived %v", paused.suspends, paused.done.Archived)
	}

	resumed := run(t, harness(t, `output = require("node:fs").readFileSync("notes.md", "utf8") + " | " + msg.params.prompt[0].text;`, "end_turn"), func(o *runOptions) {
		o.archives = archives
		o.resume = protocol.Resume{Key: resumeKey, SessionID: "session_known", ResumeSession: true}
		o.messages = [][]protocol.Message{{{Position: 3, Body: "go ahead"}}}
	})

	if got := agentOutput(t, resumed); got != "asked | go ahead" {
		t.Errorf("the runner that claimed it found %q", got)
	}
}

func TestARenewalThatConflictsWhileWaitingKeepsTheRunAndItsAnswer(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.conflicts = 3
		o.answers = [][]protocol.Message{nil, nil, nil, nil, {{Position: 4, Body: "go ahead"}}}
		o.answerWait = time.Minute
		o.heartbeat = 10 * time.Millisecond
	})

	if !slices.Equal(written.acked, []int{4}) || written.suspends != 0 {
		t.Errorf("acknowledged %v and suspended %d times", written.acked, written.suspends)
	}
}

func TestAnAnswerThatBeatsSuspendingAClosedHarnessRequeuesTheRun(t *testing.T) {
	written := run(t, harness(t, eachTurn, "end_turn"), escalatesToAPerson, func(o *runOptions) {
		o.noWait = true
		o.suspending = []bool{false}
		o.answerWait = time.Minute
		o.heartbeat = time.Hour
	})

	if written.requeueSuspends != 1 || len(written.acked) != 0 {
		t.Errorf("suspended with requeue %d times and acknowledged %v", written.requeueSuspends, written.acked)
	}
}
