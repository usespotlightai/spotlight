package session_test

import (
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/session"
)

func callOrder(t *testing.T, written *journal, names ...string) {
	t.Helper()

	written.mu.Lock()
	calls := slices.Clone(written.calls)
	written.mu.Unlock()

	at := -1
	for _, name := range names {
		next := slices.Index(calls[at+1:], name)
		if next < 0 {
			t.Fatalf("the calls were %v, wanted %v in that order", calls, names)
		}
		at += next + 1
	}
}

func TestReportsTheTurnBeforeItArchivesTheWorkspace(t *testing.T) {
	archives := newArchives(t)
	held := &heldSandbox{archives: archives}

	written := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.held = held
			o.resume = protocol.Resume{Key: resumeKey}
		})

	callOrder(t, written, "hold", "complete", "sandbox archive", "release")
	if slices.Contains(written.calls, "archive") {
		t.Errorf("the run also archived with its own lease: %v", written.calls)
	}
	if len(written.completedBy) != 1 || written.completedBy[0] != 0 {
		t.Errorf("archives completed before the report: %v, wanted none", written.completedBy)
	}
	if archives.count() != 1 {
		t.Errorf("%d archives were completed, wanted the one", archives.count())
	}
	if got := held.sentStep("archive"); !strings.HasPrefix(got, "Captured the workspace") {
		t.Errorf("the sandbox journaled %q about the archive", got)
	}

	var last int
	for _, event := range written.events {
		if event.Seq <= last {
			t.Fatalf("the journal went from seq %d to %d", last, event.Seq)
		}
		last = event.Seq
	}
}

func TestANewSandboxRestoresTheArchiveSealedAfterTheReport(t *testing.T) {
	archives := newArchives(t)

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.held = &heldSandbox{archives: archives}
			o.resume = protocol.Resume{Key: resumeKey}
		})

	next := run(t, harness(t, `output = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.resume = protocol.Resume{Key: resumeKey}
		})

	if got := agentOutput(t, next); got != "halfway" {
		t.Errorf("the run in a new sandbox found %q in the workspace", got)
	}
}

func TestJournalsAnArchiveThatFailsAfterTheReport(t *testing.T) {
	held := &heldSandbox{}

	written := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.held = held
			o.resume = protocol.Resume{Key: resumeKey}
			o.handover = []string{"review"}
		})

	if got := held.sentStep("archive"); !strings.HasPrefix(got, "Skipped: ") || !strings.Contains(got, "nowhere to store") {
		t.Errorf("the sandbox journaled %q about the archive", got)
	}
	if len(written.completions) != 1 || written.completions[0].Failed {
		t.Errorf("the run reported %+v; a failed archive must not change the outcome", written.completions)
	}
	callOrder(t, written, "hold", "complete", "sandbox archive", "release")
}

func TestArchivesBeforeTheReportWhenTheSandboxCannotHoldIt(t *testing.T) {
	archives := newArchives(t)

	written := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.held = &heldSandbox{archives: archives, refuse: true}
			o.resume = protocol.Resume{Key: resumeKey}
		})

	callOrder(t, written, "hold", "release", "archive", "complete")
	if slices.Contains(written.calls, "sandbox archive") {
		t.Errorf("archived through a sandbox that did not hold the workspace: %v", written.calls)
	}
	if len(written.completedBy) != 1 || written.completedBy[0] != 1 {
		t.Errorf("archives completed before the report: %v, wanted the one", written.completedBy)
	}
}

func TestHoldsNoSandboxForARunThatKeepsNoWorkspace(t *testing.T) {
	written := run(t, harness(t, `output = "worked";`, "end_turn"), func(o *runOptions) {
		o.held = &heldSandbox{}
	})

	if slices.Contains(written.calls, "hold") {
		t.Errorf("a run with no resume key held the sandbox: %v", written.calls)
	}
}

func TestTheNextRunInTheLiveSandboxKeepsItsWorkspace(t *testing.T) {
	archives := newArchives(t)
	sandbox := new(session.Sandbox)
	inSandbox := func(o *runOptions) {
		o.archives = archives
		o.held = &heldSandbox{archives: archives}
		o.sandbox = sandbox
		o.resume = protocol.Resume{Key: resumeKey}
	}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"), inSandbox)
	next := run(t, harness(t, `output = require("node:fs").readFileSync("notes.md", "utf8");`, "end_turn"), inSandbox)

	if got := agentOutput(t, next); got != "halfway" {
		t.Errorf("the next run in the sandbox found %q in the workspace", got)
	}
	if next.restores != 0 {
		t.Errorf("the next run in the live sandbox read the stored archive %d times", next.restores)
	}
	if got := step(t, next, "restore"); !strings.HasPrefix(got, "Kept the workspace") {
		t.Errorf("the next run said %q about restoring", got)
	}
	if got := step(t, next, "archive"); !strings.HasPrefix(got, "Coalesced") {
		t.Errorf("the next run, which changed nothing, said %q about archiving", got)
	}
}

func TestFinishesTheArchiveAfterTheReportWhenTheRunnerIsStopped(t *testing.T) {
	archives := newArchives(t)
	held := &heldSandbox{archives: archives}

	written := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.held = held
			o.stopOnArchive = true
			o.resume = protocol.Resume{Key: resumeKey}
		})

	if got := held.sentStep("archive"); !strings.HasPrefix(got, "Captured the workspace") {
		t.Errorf("a runner stopped during the archive journaled %q about it", got)
	}
	callOrder(t, written, "complete", "sandbox archive", "release")
}

func TestHoldsTheArchiveLeaseForTheAttemptInItsTurn(t *testing.T) {
	archives := newArchives(t)
	held := &heldSandbox{archives: archives}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.held = held
			o.attempt = 3
			o.resume = protocol.Resume{Key: resumeKey}
		})

	if len(held.attempts) == 0 {
		t.Fatal("the sandbox took no archive lease")
	}
	for _, attempt := range held.attempts {
		if attempt != 3 {
			t.Errorf("the sandbox held the archive lease for attempts %v, wanted 3", held.attempts)
			break
		}
	}
}

func TestArchivesWithTheRunsOwnLeaseWhenTheReportFailsAfterTheHold(t *testing.T) {
	archives := newArchives(t)
	held := &heldSandbox{archives: archives}

	written := run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.held = held
			o.resume = protocol.Resume{Key: resumeKey}
			o.completeErr = errors.New("503 Service Unavailable")
		})

	callOrder(t, written, "hold", "complete", "archive", "release")
	if slices.Contains(written.calls, "sandbox archive") {
		t.Errorf("archived through the sandbox for a turn it never reported: %v", written.calls)
	}
	if len(held.sent) != 0 {
		t.Errorf("the sandbox journaled %v for a turn it never reported", held.sent)
	}
	if archives.count() != 1 {
		t.Errorf("%d archives were completed, wanted the one", archives.count())
	}
}

func TestRenewsNoRunLeaseWhileItArchivesAfterTheReport(t *testing.T) {
	archives := newArchives(t)
	held := &heldSandbox{archives: archives}
	var atGrant, afterWait int
	held.onGrant = func() {
		held.journal.mu.Lock()
		atGrant = held.journal.renewals
		held.journal.mu.Unlock()
		time.Sleep(100 * time.Millisecond)
		held.journal.mu.Lock()
		afterWait = held.journal.renewals
		held.journal.mu.Unlock()
	}

	run(t, harness(t, `require("node:fs").writeFileSync("notes.md", "halfway"); output = "wrote";`, "end_turn"),
		func(o *runOptions) {
			o.archives = archives
			o.held = held
			o.heartbeat = 10 * time.Millisecond
			o.resume = protocol.Resume{Key: resumeKey}
		})

	if afterWait != atGrant {
		t.Errorf("renewed the reported run's lease %d times while it archived", afterWait-atGrant)
	}
}
