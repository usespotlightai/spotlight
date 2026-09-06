package session_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/runner/internal/account"
	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/session"
	"usespotlight.ai/runner/internal/workspace"
)

type journal struct {
	mu       sync.Mutex
	events   []protocol.Event
	renewals int
	done     *protocol.Completion
	// stopAfter makes lease renewals report a stop once this many have been
	// asked for; 0 never does.
	stopAfter int
	// What a person has typed at the agent, handed over one batch per turn.
	said      [][]protocol.Said
	delivered []int
}

func (j *journal) AppendEvents(_ context.Context, _ string, events []protocol.Event) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.events = append(j.events, events...)
	return nil
}

func (j *journal) RenewLease(context.Context, string) (bool, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.renewals++
	return j.stopAfter > 0 && j.renewals >= j.stopAfter, nil
}

func (j *journal) Complete(_ context.Context, _ string, done protocol.Completion) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.done = &done
	return nil
}

func (j *journal) OpenPullRequest(
	_ context.Context, _ string, _ protocol.PullRequest,
) (string, error) {
	return "https://github.com/acme/widgets/pull/1", nil
}

func (j *journal) AnswerRemark(
	_ context.Context, _ string, _ protocol.Remark,
) error {
	return nil
}

func (j *journal) Trace(
	_ context.Context, _ string, _ string,
) (json.RawMessage, error) {
	return nil, nil
}

// Said hands back one batch per call, so a fake can end the run by running
// out rather than by saying the same thing for ever.
func (j *journal) Said(context.Context, string) ([]protocol.Said, error) {
	j.mu.Lock()
	defer j.mu.Unlock()

	if len(j.said) == 0 {
		return nil, nil
	}

	next := j.said[0]
	j.said = j.said[1:]
	return next, nil
}

func (j *journal) Delivered(_ context.Context, _ string, upTo int) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.delivered = append(j.delivered, upTo)
	return nil
}

func (j *journal) typed(kind protocol.EventType) []protocol.Event {
	j.mu.Lock()
	defer j.mu.Unlock()

	var found []protocol.Event
	for _, event := range j.events {
		if event.Type == kind {
			found = append(found, event)
		}
	}
	return found
}

func prepareHook(t *testing.T, body string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "prepare")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+body), 0o700); err != nil {
		t.Fatal(err)
	}
	return path
}

/*
harness writes a stand-in that speaks ACP and does whatever the test needs
when it is prompted.

`doing` is JavaScript run at prompt time, with `sessionId` in scope; `stopReason`
is how the turn ends. It answers session/load for one id and refuses every other
the way a harness does, so resuming can be tested both ways. Tests are written
against the protocol rather than against any one agent.
*/
func harness(t *testing.T, doing string, stopReason string) string {
	t.Helper()

	script := `#!/usr/bin/env node
const { execSync } = require("node:child_process");
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
let buffered = "";
process.stdin.on("data", (chunk) => {
  buffered += chunk.toString();
  const lines = buffered.split("\n");
  buffered = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1 } });
    if (msg.method === "session/new") send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_opened" } });
    if (msg.method === "session/load") {
      if (msg.params.sessionId === "session_held") send({ jsonrpc: "2.0", id: msg.id, result: {} });
      else send({ jsonrpc: "2.0", id: msg.id,
                  error: { code: -32002, message: "Resource not found: " + msg.params.sessionId } });
    }
    if (msg.method === "session/prompt") {
      const sessionId = msg.params.sessionId;
      let said = "";
      try { ` + doing + ` } catch (e) { said = String(e.message ?? e); }
      send({ jsonrpc: "2.0", method: "session/update",
             params: { update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: said } } } });
      send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "` + stopReason + `" } });
    }
  }
});
`

	dir, err := os.MkdirTemp("", "harness")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	if err := os.Chmod(dir, 0o755); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(dir, "harness")
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

// stalling speaks ACP but never finishes a turn, so a run on it ends only when
// it is stopped from the console.
func stalling(t *testing.T) string {
	t.Helper()

	script := `#!/usr/bin/env node
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
let buffered = "";
process.stdin.on("data", (chunk) => {
  buffered += chunk.toString();
  const lines = buffered.split("\n");
  buffered = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1 } });
    if (msg.method === "session/new") send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_opened" } });
    // session/prompt is left unanswered: the turn runs until the run is stopped.
  }
});
`

	dir, err := os.MkdirTemp("", "harness")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	if err := os.Chmod(dir, 0o755); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(dir, "harness")
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

type runOptions struct {
	said       [][]protocol.Said
	briefing   string
	handover   []string
	agentUser  *account.User
	root       string
	env        map[string]string
	continuity protocol.Continuity
	stopAfter  int
}

func run(t *testing.T, executable string, over ...func(*runOptions)) *journal {
	t.Helper()

	settings := runOptions{root: t.TempDir()}
	for _, adjust := range over {
		adjust(&settings)
	}

	written := &journal{said: settings.said, stopAfter: settings.stopAfter}
	err := session.Execute(context.Background(), protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Cwd:        "service",
			Command:    protocol.Command{Executable: executable, Env: settings.env},
			Briefing:   settings.briefing,
			Handover:   protocol.Handover{Options: settings.handover},
			Continuity: settings.continuity,
		},
	}, session.Options{
		WorkspaceRoot: settings.root,
		Journal:       written,
		Log:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		AgentUser:     settings.agentUser,
		PrepareHook:   prepareHook(t, "mkdir service"),
		HookTimeout:   30 * time.Second,
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	return written
}

// said gathers the text out of the session updates the journal kept.
func said(t *testing.T, written *journal) string {
	t.Helper()

	var heard strings.Builder
	for _, event := range written.typed(protocol.EventOutput) {
		var update struct {
			Update struct {
				Content struct {
					Text string `json:"text"`
				} `json:"content"`
			} `json:"update"`
		}
		if err := json.Unmarshal(event.Data, &update); err != nil {
			t.Fatalf("the journal kept something that is not an update: %v", err)
		}
		heard.WriteString(update.Update.Content.Text)
	}

	return heard.String()
}

func TestTakesARunFromNothingToAnOutcome(t *testing.T) {
	written := run(t, harness(t, `said = "worked";`, "end_turn"))

	if ready := written.typed(protocol.EventWorkspaceReady); len(ready) != 1 {
		t.Errorf("expected the workspace to be reported once, got %d", len(ready))
	}
	if heard := said(t, written); heard != "worked" {
		t.Errorf("heard %q", heard)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}
}

// The journal is a record of what the agent said, kept whole, so a reader can
// render it rather than replay it.
func TestKeepsWhatTheAgentSaidAsItSaidIt(t *testing.T) {
	written := run(t, harness(t, `said = "structured";`, "end_turn"))

	output := written.typed(protocol.EventOutput)
	if len(output) == 0 {
		t.Fatal("nothing was kept")
	}

	var update map[string]any
	if err := json.Unmarshal(output[0].Data, &update); err != nil {
		t.Fatalf("not readable as an update: %v", err)
	}
	if _, ok := update["update"]; !ok {
		t.Errorf("kept %v, which is not a session update", update)
	}
}

func TestEventsAreNumberedWithoutGaps(t *testing.T) {
	written := run(t, harness(t, `said = "one";`, "end_turn"))

	for at, event := range written.events {
		if event.Seq != at+1 {
			t.Fatalf("event %d is numbered %d", at, event.Seq)
		}
	}
}

// A turn that ends any other way is the agent saying it would not or could
// not, which is a failed run rather than a finished one.
func TestATurnThatEndsBadlyIsReportedAsFailed(t *testing.T) {
	written := run(t, harness(t, `said = "refused";`, "refusal"))

	if written.done == nil || !written.done.Failed {
		t.Fatalf("completion %+v", written.done)
	}
}

// Stopping a run from the console ends a turn that would otherwise run on, and
// the run is reported stopped rather than failed.
func TestARunStoppedFromTheConsoleFinishesAsStopped(t *testing.T) {
	written := run(t, stalling(t), func(o *runOptions) { o.stopAfter = 1 })

	if written.done == nil {
		t.Fatal("nothing was reported")
	}
	if written.done.Failed {
		t.Errorf("a stopped run should not be a failure: %+v", written.done)
	}
	if !written.done.Stopped {
		t.Errorf("a stopped run should say so: %+v", written.done)
	}
}

// A turn cut short to steer it is not a failure: what the person said is taken
// up as the next turn, and the run carries on to finish.
func TestASteeredTurnIsTakenUpNotFailed(t *testing.T) {
	written := run(t, harness(t, `said = "working";`, "cancelled"),
		func(o *runOptions) {
			o.said = [][]protocol.Said{
				{{Position: 1, Body: "actually, do this instead"}},
			}
		})

	if written.done == nil || written.done.Failed {
		t.Fatalf("a steered run should finish, not fail: %+v", written.done)
	}
	if len(written.delivered) == 0 {
		t.Error("what the person said mid-turn was never delivered to the agent")
	}
}

func TestARunThatCannotStartIsStillReported(t *testing.T) {
	written := &journal{}
	err := session.Execute(context.Background(), protocol.Run{
		ID:   "run_1",
		Spec: protocol.Spec{Command: protocol.Command{Executable: "nothing-of-that-name"}},
	}, session.Options{
		WorkspaceRoot: t.TempDir(),
		Journal:       written,
		Log:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		PrepareHook:   prepareHook(t, "true"),
		HookTimeout:   30 * time.Second,
	})

	if err == nil {
		t.Fatal("expected the run to fail")
	}
	if written.done == nil || !written.done.Failed {
		t.Fatalf("completion %+v", written.done)
	}
}

// The agent is given its own account, and an agent CLI reads its
// configuration from HOME and runs commands through SHELL.
func TestTheAgentIsGivenItsOwnAccount(t *testing.T) {
	if os.Getuid() != 0 {
		t.Skip("dropping to another user needs root")
	}
	as, err := account.LookupUser("agent")
	if err != nil {
		t.Skipf("no agent account here: %v", err)
	}

	t.Setenv("SPOTLIGHT_TOKEN", "the-runners-control-plane-token")

	root, err := os.MkdirTemp("", "account")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(root) })

	written := run(t, harness(t,
		`said = [process.getuid(), process.env.HOME, process.env.USER, process.env.SHELL,
                 process.env.SPOTLIGHT_TOKEN ?? "no-token"].join(" ");`, "end_turn"),
		func(o *runOptions) { o.agentUser = as; o.root = root })

	heard := said(t, written)
	for _, wanted := range []string{"2000", "/home/agent", "agent", "no-token"} {
		if !strings.Contains(heard, wanted) {
			t.Errorf("%q missing from %q", wanted, heard)
		}
	}
}

// The declaration channel is not the harness's: any agent that can run a
// command can hand a task on, whatever protocol it speaks.
func TestWhatTheAgentDeclaresReachesTheCompletion(t *testing.T) {
	declaring := `execSync(` + "`" +
		`${process.env.SPOTLIGHT_HANDOVER_URL ? "" : "no url"} node -e '
      const body = JSON.stringify({ next: "Spec", note: "needs a spec" });
      fetch(process.env.SPOTLIGHT_HANDOVER_URL, {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_HANDOVER_TOKEN },
        body,
      }).then(() => process.exit(0));
    '` + "`" + `); said = "declared";`

	written := run(t, harness(t, declaring, "end_turn"),
		func(o *runOptions) { o.handover = []string{"Spec", "review"} })

	spoken := written.done.Outcome
	if spoken == nil || spoken.Next != "Spec" || spoken.Note != "needs a spec" {
		t.Fatalf("got %+v", spoken)
	}
}

// A briefing is what the agent is asked to work on, and it reaches the agent
// as a prompt rather than as an argument.
func TestTheBriefingReachesTheAgent(t *testing.T) {
	written := run(t, harness(t, `said = msg.params.prompt[0].text;`, "end_turn"),
		func(o *runOptions) { o.briefing = "## Fix the queue" })

	if heard := said(t, written); heard != "## Fix the queue" {
		t.Errorf("the agent was asked %q", heard)
	}
}

func TestTheWorkspaceGoesWithTheRun(t *testing.T) {
	root := t.TempDir()
	run(t, harness(t, `said = "done";`, "end_turn"), func(o *runOptions) { o.root = root })

	if _, err := os.Stat(filepath.Join(root, "run_1")); !os.IsNotExist(err) {
		t.Error("the workspace should be gone")
	}
}

func TestTakesUpTheSessionItWasGiven(t *testing.T) {
	written := run(t, harness(t, `said = sessionId;`, "end_turn"), func(o *runOptions) {
		o.continuity = protocol.Continuity{SessionID: "session_held"}
	})

	if got := said(t, written); got != "session_held" {
		t.Errorf("worked in session %q", got)
	}
	if written.done.SessionID != "session_held" {
		t.Errorf("reported session %q", written.done.SessionID)
	}
}

func TestOpensAFreshSessionWhenTheHarnessHasForgotten(t *testing.T) {
	written := run(t, harness(t, `said = sessionId;`, "end_turn"), func(o *runOptions) {
		o.continuity = protocol.Continuity{SessionID: "session_long_gone"}
	})

	if got := said(t, written); got != "session_opened" {
		t.Errorf("worked in session %q", got)
	}
	if written.done.SessionID != "session_opened" {
		t.Errorf("reported session %q", written.done.SessionID)
	}
}

// Reported even when nothing was inherited: it is what the next run needs, and
// the runner will not remember it.
func TestReportsTheSessionItOpened(t *testing.T) {
	written := run(t, harness(t, `said = "worked";`, "end_turn"))

	if written.done.SessionID != "session_opened" {
		t.Errorf("reported session %q", written.done.SessionID)
	}
}

func TestKeepsTheWorkspaceWhenToldTo(t *testing.T) {
	root := t.TempDir()

	run(t, harness(t, `said = "worked";`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.continuity = protocol.Continuity{Key: "task_1", Keep: true}
	})

	if _, err := os.Stat(filepath.Join(root, "task_1", workspace.StatePath)); err != nil {
		t.Errorf("the state directory did not survive the run: %v", err)
	}
}

func TestStillDisposesOfAWorkspaceNobodyAskedToKeep(t *testing.T) {
	root := t.TempDir()

	run(t, harness(t, `said = "worked";`, "end_turn"), func(o *runOptions) { o.root = root })

	if _, err := os.Stat(filepath.Join(root, "run_1")); !os.IsNotExist(err) {
		t.Errorf("the workspace outlived the run: %v", err)
	}
}

/*
The catalogue says where a harness keeps its state; the runner says only where
the durable directory is. Expanding the one into the other is what keeps every
harness's own vocabulary out of the runner.
*/
func TestExpandsTheStateDirectoryIntoWhatTheHarnessIsTold(t *testing.T) {
	root := t.TempDir()

	written := run(t, harness(t, `said = process.env.HARNESS_STATE_DIR ?? "unset";`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.continuity = protocol.Continuity{Key: "task_1"}
		o.env = map[string]string{"HARNESS_STATE_DIR": "${" + session.StateVar + "}/somewhere"}
	})

	want := filepath.Join(root, "task_1", workspace.StatePath, "somewhere")
	if got := said(t, written); got != want {
		t.Errorf("the harness was told %q, wanted %q", got, want)
	}
}

// A person typing at an agent mid-work is the point of a run staying open: the
// words reach it as another turn in the same session, not as a second run.
func TestWhatAPersonSaysReachesTheAgentAsAnotherTurn(t *testing.T) {
	written := run(t, harness(t, `said = JSON.stringify(msg.params.prompt);`, "end_turn"),
		func(o *runOptions) {
			o.briefing = "the first thing"
			o.said = [][]protocol.Said{{{Position: 3, Body: "and one more thing"}}}
		})

	heard := said(t, written)

	if !strings.Contains(heard, "and one more thing") {
		t.Errorf("what the person said never arrived: %q", heard)
	}
	if len(written.delivered) != 1 || written.delivered[0] != 3 {
		t.Errorf("marked delivered %v, wanted [3]", written.delivered)
	}
}

// Nothing said is the ordinary case, and must not cost a second turn.
func TestARunEndsWhenNobodyHasSaidAnything(t *testing.T) {
	written := run(t, harness(t, `said = "worked";`, "end_turn"),
		func(o *runOptions) { o.briefing = "the only thing" })

	if len(written.delivered) != 0 {
		t.Errorf("marked delivered %v, wanted nothing", written.delivered)
	}
}
