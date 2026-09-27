package session_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/session"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

type drafted struct {
	repository string
	diff       string
	base       string
}

type journal struct {
	mu         sync.Mutex
	events     []protocol.Event
	renewals   int
	done       *protocol.Completion
	stopAfter  int
	said       [][]protocol.Said
	delivered  []int
	files      map[string]string
	drafted    []drafted
	decision   string
	asked      []protocol.PermissionAsked
	archives   *keptArchives
	remembered []remembered
	memory     []protocol.MemoryFile
	memoryErr  error
}

type remembered struct {
	asked   protocol.Remembering
	journal []protocol.Event
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
	if j.archives != nil {
		j.archives.renewed()
	}
	return j.stopAfter > 0 && j.renewals >= j.stopAfter, nil
}

func (j *journal) Complete(_ context.Context, _ string, done protocol.Completion) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.done = &done
	return nil
}

func (j *journal) UseTool(
	_ context.Context, _ string, _ string, _ json.RawMessage,
) (json.RawMessage, error) {
	return json.RawMessage(`{"output":"https://github.com/acme/widgets/pull/1"}`), nil
}

func (j *journal) DraftChangeStack(
	_ context.Context, _ string, repository, diff, base string,
) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.drafted = append(j.drafted, drafted{repository: repository, diff: diff, base: base})
	return nil
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

func (j *journal) RecallMemories(
	_ context.Context, _ string, words string,
) (json.RawMessage, error) {
	return json.Marshal([]map[string]string{{"handle": "M-1", "body": words}})
}

func (j *journal) RecallMemory(
	_ context.Context, _ string, handle string,
) (json.RawMessage, error) {
	return json.Marshal(map[string]string{"handle": handle})
}

func (j *journal) Remember(
	_ context.Context, _ string, asked protocol.Remembering,
) (json.RawMessage, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.remembered = append(j.remembered, remembered{asked: asked, journal: slices.Clone(j.events)})
	return json.Marshal(map[string]string{"kind": asked.Kind, "body": asked.Body})
}

func (j *journal) MemoryFiles(context.Context, string) ([]protocol.MemoryFile, error) {
	return j.memory, j.memoryErr
}

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

func (j *journal) Attachment(_ context.Context, _ string, id string, into io.Writer) error {
	j.mu.Lock()
	content, held := j.files[id]
	j.mu.Unlock()

	if !held {
		return errors.New("404 Not Found: no such attachment")
	}
	_, err := io.WriteString(into, content)
	return err
}

func (j *journal) AskPermission(
	_ context.Context, _ string, asked protocol.PermissionAsked,
) (protocol.PermissionAnswer, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.asked = append(j.asked, asked)
	if j.decision == "" {
		return protocol.PermissionAnswer{}, errors.New("503 Service Unavailable")
	}
	return protocol.PermissionAnswer{Decision: j.decision}, nil
}

func (j *journal) WorkspaceArchive(_ context.Context, _ string) (*protocol.HeldArchive, error) {
	if j.archives == nil {
		return nil, nil
	}
	return j.archives.newest(), nil
}

func (j *journal) GrantArchive(
	_ context.Context, _ string, size int64, sha256 string,
) (protocol.ArchiveGrant, error) {
	if j.archives == nil {
		return protocol.ArchiveGrant{}, errors.New("422 Unprocessable Entity: nowhere to keep one")
	}
	return j.archives.grant(size, sha256), nil
}

func (j *journal) SealArchive(_ context.Context, _ string, archiveID string) error {
	return j.archives.seal(archiveID)
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
	said        [][]protocol.Said
	briefing    string
	handover    []string
	agentUser   *account.User
	root        string
	env         map[string]string
	continuity  protocol.Continuity
	stopAfter   int
	attachments []protocol.Attachment
	skills      []protocol.SkillFile
	files       map[string]string
	setup       protocol.HarnessSetup
	decision    string
	archives    *keptArchives
	memory      []protocol.MemoryFile
	memoryErr   error
}

func run(t *testing.T, executable string, over ...func(*runOptions)) *journal {
	t.Helper()

	settings := runOptions{root: t.TempDir()}
	for _, adjust := range over {
		adjust(&settings)
	}

	written := &journal{
		said:      settings.said,
		stopAfter: settings.stopAfter,
		files:     settings.files,
		decision:  settings.decision,
		archives:  settings.archives,
		memory:    settings.memory,
		memoryErr: settings.memoryErr,
	}
	err := session.Execute(context.Background(), protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Command:      protocol.Command{Executable: executable, Env: settings.env},
			Briefing:     settings.briefing,
			Handover:     protocol.Handover{Options: settings.handover},
			Continuity:   settings.continuity,
			Attachments:  settings.attachments,
			Skills:       settings.skills,
			HarnessSetup: settings.setup,
		},
	}, session.Options{
		Workspace: settings.root,
		Journal:   written,
		Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
		AgentUser: settings.agentUser,
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	return written
}

func said(t *testing.T, written *journal) string {
	t.Helper()

	var heard strings.Builder
	for _, event := range written.typed(protocol.EventOutput) {
		if event.Message != "" {
			continue
		}
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

func TestATurnThatEndsBadlyIsReportedAsFailed(t *testing.T) {
	written := run(t, harness(t, `said = "refused";`, "refusal"))

	if written.done == nil || !written.done.Failed {
		t.Fatalf("completion %+v", written.done)
	}
}

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
		Workspace: t.TempDir(),
		Journal:   written,
		Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	})

	if err == nil {
		t.Fatal("expected the run to fail")
	}
	if written.done == nil || !written.done.Failed {
		t.Fatalf("completion %+v", written.done)
	}
}

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

func TestTheAgentRemembersThroughItsRunAfterItsStepsAreJournalled(t *testing.T) {
	remembering := `send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update: {
        sessionUpdate: "tool_call", toolCallId: "toolu_remember", title: "spotlight remember" } } });
      execSync(` + "`" +
		`node -e '
      const body = JSON.stringify({ kind: "rationale", body: "Retry in the request." });
      fetch(process.env.SPOTLIGHT_HANDOVER_URL + "remember", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_HANDOVER_TOKEN },
        body,
      }).then((answer) => process.exit(answer.ok ? 0 : 1));
    '` + "`" + `); said = "remembered";`

	written := run(t, harness(t, remembering, "end_turn"))

	written.mu.Lock()
	defer written.mu.Unlock()

	if len(written.remembered) != 1 {
		t.Fatalf("remembered %+v", written.remembered)
	}
	if got := written.remembered[0].asked; got.Kind != "rationale" || got.Body != "Retry in the request." {
		t.Errorf("remembered %+v", got)
	}
	stepped := slices.ContainsFunc(written.remembered[0].journal, func(event protocol.Event) bool {
		return strings.Contains(string(event.Data), "toolu_remember")
	})
	if !stepped {
		t.Error("the step the agent remembered from should reach the journal before the memory does")
	}
}

func TestARecallReachesSpotlightAndTheTraceAsASpan(t *testing.T) {
	recalling := `execSync(` + "`" +
		`node -e '
      fetch(process.env.SPOTLIGHT_HANDOVER_URL + "recall", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_HANDOVER_TOKEN },
        body: JSON.stringify({ words: "upload retries" }),
      }).then((answer) => process.exit(answer.ok ? 0 : 1));
    '` + "`" + `); said = "recalled";`

	written := run(t, harness(t, recalling, "end_turn"))

	spans := written.typed(protocol.EventSpan)
	if len(spans) != 1 || !strings.Contains(string(spans[0].Data), `"spotlight.recall"`) ||
		!strings.Contains(string(spans[0].Data), "upload retries") {
		t.Fatalf("spans %v", spans)
	}
}

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

func TestReportsTheSessionItOpened(t *testing.T) {
	written := run(t, harness(t, `said = "worked";`, "end_turn"))

	if written.done.SessionID != "session_opened" {
		t.Errorf("reported session %q", written.done.SessionID)
	}
}

func TestDisposesOfTheWorkspaceAfterTheRun(t *testing.T) {
	root := t.TempDir()

	run(t, harness(t, `said = "worked";`, "end_turn"), func(o *runOptions) { o.root = root })

	if _, err := os.Stat(filepath.Join(root, "run_1")); !os.IsNotExist(err) {
		t.Errorf("the workspace outlived the run: %v", err)
	}
}

func TestExpandsTheStateDirectoryIntoWhatTheHarnessIsTold(t *testing.T) {
	root := t.TempDir()

	written := run(t, harness(t, `said = process.env.HARNESS_STATE_DIR ?? "unset";`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.continuity = protocol.Continuity{Key: "task_1"}
		o.env = map[string]string{"HARNESS_STATE_DIR": "${" + session.StateVar + "}/somewhere"}
	})

	want := filepath.Join(root, workspace.StatePath, "somewhere")
	if got := said(t, written); got != want {
		t.Errorf("the harness was told %q, wanted %q", got, want)
	}
}

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

func reading(path string) string {
	return `said = require("node:fs").readFileSync("` + path + `", "utf8");`
}

func TestWhatWasAttachedIsThereBeforeTheAgentStarts(t *testing.T) {
	const path = ".spotlight/attachments/att_1/notes.txt"

	written := run(t, harness(t, reading(path), "end_turn"), func(o *runOptions) {
		o.attachments = []protocol.Attachment{{ID: "att_1", Path: path}}
		o.files = map[string]string{"att_1": "the notes"}
	})

	if heard := said(t, written); heard != "the notes" {
		t.Errorf("the agent found %q", heard)
	}
}

func TestARunWhoseAttachmentCannotBeFetchedFails(t *testing.T) {
	written := &journal{}
	err := session.Execute(context.Background(), protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Command: protocol.Command{Executable: harness(t, `said = "worked";`, "end_turn")},
			Attachments: []protocol.Attachment{
				{ID: "att_gone", Path: ".spotlight/attachments/att_gone/notes.txt"},
			},
		},
	}, session.Options{
		Workspace: t.TempDir(),
		Journal:   written,
		Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	})

	if err == nil || !strings.Contains(err.Error(), "fetch attachment att_gone") {
		t.Fatalf("expected the fetch to fail the run, got %v", err)
	}
	if written.done == nil || !written.done.Failed {
		t.Fatalf("completion %+v", written.done)
	}
	if heard := said(t, written); heard != "" {
		t.Errorf("the agent was started anyway and said %q", heard)
	}
}

func TestWhatIsAttachedMidRunIsThereBeforeItsTurn(t *testing.T) {
	const path = ".spotlight/attachments/att_2/log.txt"

	written := run(t, harness(t, reading(path), "end_turn"), func(o *runOptions) {
		o.said = [][]protocol.Said{{{
			Position:    1,
			Body:        "see " + path,
			Attachments: []protocol.Attachment{{ID: "att_2", Path: path}},
		}}}
		o.files = map[string]string{"att_2": "the log"}
	})

	heard := said(t, written)
	if !strings.HasSuffix(heard, "the log") {
		t.Errorf("the second turn did not find the file: %q", heard)
	}
	if strings.HasPrefix(heard, "the log") {
		t.Errorf("the file was there before anyone attached it: %q", heard)
	}
}

func TestWordsAreDeliveredEvenWhenTheirAttachmentIsNot(t *testing.T) {
	written := run(t, harness(t, `said = JSON.stringify(msg.params.prompt);`, "end_turn"),
		func(o *runOptions) {
			o.said = [][]protocol.Said{{{
				Position:    2,
				Body:        "see the log",
				Attachments: []protocol.Attachment{{ID: "att_gone", Path: "log.txt"}},
			}}}
		})

	if heard := said(t, written); !strings.Contains(heard, "see the log") {
		t.Errorf("what the person said never arrived: %q", heard)
	}
	if len(written.delivered) != 1 || written.delivered[0] != 2 {
		t.Errorf("marked delivered %v, wanted [2]", written.delivered)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}
}

func TestARunEndsWhenNobodyHasSaidAnything(t *testing.T) {
	written := run(t, harness(t, `said = "worked";`, "end_turn"),
		func(o *runOptions) { o.briefing = "the only thing" })

	if len(written.delivered) != 0 {
		t.Errorf("marked delivered %v, wanted nothing", written.delivered)
	}
}

func TestSkillsAreLaidBeforeTheAgentStarts(t *testing.T) {
	const path = ".claude/skills/spotlight-handover/SKILL.md"

	written := run(t, harness(t, reading(path), "end_turn"), func(o *runOptions) {
		o.skills = []protocol.SkillFile{{Path: path, Text: "how to hand over"}}
	})

	if heard := said(t, written); heard != "how to hand over" {
		t.Errorf("the agent found %q", heard)
	}
}

func TestTheTeamsMemoryIsLaidOutBeforeTheAgentStarts(t *testing.T) {
	root := t.TempDir()
	stale := filepath.Join(root, "task_1", ".spotlight/memory/team/M-1.md")
	if err := os.MkdirAll(filepath.Dir(stale), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(stale, []byte("retired since"), 0o600); err != nil {
		t.Fatal(err)
	}

	written := run(t, harness(t, `const fs = require("node:fs");
said = JSON.stringify([
  fs.readFileSync(".spotlight/memory/repositories/acme/api/src/uploads/M-18.md", "utf8"),
  fs.existsSync(".spotlight/memory/team/M-1.md"),
  fs.existsSync("elsewhere.md"),
]);`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.continuity = protocol.Continuity{Key: "task_1"}
		o.memory = []protocol.MemoryFile{
			{Path: ".spotlight/memory/repositories/acme/api/src/uploads/M-18.md", Body: "# M-18 · rationale"},
			{Path: "elsewhere.md", Body: "not memory"},
		}
	})

	if heard := said(t, written); heard != `["# M-18 · rationale",false,false]` {
		t.Errorf("the agent found %s", heard)
	}
}

func TestARunStartsWithANoteWhenTheTeamsMemoryCannotBeRead(t *testing.T) {
	written := run(t, harness(t, `const fs = require("node:fs");
said = JSON.stringify([fs.readdirSync(".spotlight/memory"), fs.readFileSync(".spotlight/memory/README.md", "utf8")]);`, "end_turn"),
		func(o *runOptions) { o.memoryErr = errors.New("control plane down") })

	if heard := said(t, written); !strings.Contains(heard, `["README.md"]`) || !strings.Contains(heard, "could not be read") {
		t.Errorf("the agent found %s", heard)
	}
}

func TestTheMemoryFolderIsLaidEvenWhereARestoredWorkspaceLeftAFileInItsPlace(t *testing.T) {
	root := t.TempDir()
	blocking := filepath.Join(root, "task_1", ".spotlight/memory")
	if err := os.MkdirAll(filepath.Dir(blocking), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(blocking, []byte("not a folder"), 0o600); err != nil {
		t.Fatal(err)
	}

	written := run(t, harness(t, reading(".spotlight/memory/team/M-1.md"), "end_turn"), func(o *runOptions) {
		o.root = root
		o.continuity = protocol.Continuity{Key: "task_1"}
		o.memory = []protocol.MemoryFile{{Path: ".spotlight/memory/team/M-1.md", Body: "# M-1"}}
	})

	if heard := said(t, written); heard != "# M-1" {
		t.Errorf("the agent found %q", heard)
	}
}

func TestAMemoryFileThatWouldLeaveTheFolderIsLeftOut(t *testing.T) {
	written := run(t, harness(t, `said = String(require("node:fs").existsSync("escaped.md"));`, "end_turn"),
		func(o *runOptions) {
			o.memory = []protocol.MemoryFile{{Path: ".spotlight/memory/../../escaped.md", Body: "out"}}
		})

	if heard := said(t, written); heard != "false" {
		t.Errorf("a memory file escaped the folder: %s", heard)
	}
}

func TestARestoredWorkspaceHoldsOnlyTheSkillsThisRunWasGiven(t *testing.T) {
	root := t.TempDir()

	handingOver := protocol.SkillFile{Path: ".claude/skills/spotlight-handover/SKILL.md", Text: "how to hand over"}
	migrating := protocol.SkillFile{Path: ".claude/skills/our-migrations/SKILL.md", Text: "how we migrate"}
	example := protocol.SkillFile{Path: ".claude/skills/our-migrations/examples/add-column.md", Text: "add it"}
	opening := protocol.SkillFile{Path: ".claude/skills/spotlight-pull-request/SKILL.md", Text: "how to open one"}

	space := filepath.Join(root, "task_1")
	for _, left := range []protocol.SkillFile{handingOver, migrating, example, opening} {
		if err := os.MkdirAll(filepath.Dir(filepath.Join(space, left.Path)), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(space, left.Path), []byte("stale"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	written := run(t, harness(t, `const fs = require("node:fs");
said = JSON.stringify([
  fs.readFileSync(".claude/skills/our-migrations/SKILL.md", "utf8"),
  fs.existsSync(".claude/skills/spotlight-handover/SKILL.md"),
  fs.existsSync(".claude/skills/our-migrations/examples"),
  fs.existsSync(".claude/skills/spotlight-pull-request"),
]);`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.continuity = protocol.Continuity{Key: "task_1"}
		o.skills = []protocol.SkillFile{handingOver, migrating}
	})

	if heard := said(t, written); heard != `["how we migrate",true,false,false]` {
		t.Errorf("the agent found %s", heard)
	}
}

func droppingAfterCancel(t *testing.T) string {
	t.Helper()

	script := `#!/usr/bin/env node
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
let buffered = "";
let prompts = 0;
process.stdin.on("data", (chunk) => {
  buffered += chunk.toString();
  const lines = buffered.split("\n");
  buffered = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1 } });
    if (msg.method === "session/new") send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_opened" } });
    if (msg.method === "session/prompt") {
      prompts += 1;
      if (prompts === 1) {
        send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "cancelled" } });
      } else if (prompts === 2) {
        send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "end_turn" } });
      } else {
        send({ jsonrpc: "2.0", method: "session/update",
               params: { update: { sessionUpdate: "agent_message_chunk",
                                   content: { type: "text", text: "took up: " + msg.params.prompt[0].text } } } });
        send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "end_turn" } });
      }
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

func TestWhatWasSaidIsSaidAgainWhereTheHarnessLetsItGoUnread(t *testing.T) {
	written := run(t, droppingAfterCancel(t), func(o *runOptions) {
		o.said = [][]protocol.Said{
			{{Position: 1, Body: "actually, do this instead"}},
		}
	})

	if written.done == nil || written.done.Failed {
		t.Fatalf("the run should finish: %+v", written.done)
	}

	for _, event := range written.typed(protocol.EventOutput) {
		if strings.Contains(string(event.Data), "took up: actually, do this instead") {
			return
		}
	}
	t.Fatal("what the person said never reached the agent")
}

func TestHarnessFilesAreLaidInTheStateDirectory(t *testing.T) {
	written := run(t, harness(t, reading(workspace.StatePath+"/claude/settings.json"), "end_turn"), func(o *runOptions) {
		o.setup = protocol.HarnessSetup{Files: []protocol.SetupFile{
			{Path: "claude/settings.json", Text: `{"permissions":{"deny":["Bash(rm *)"]}}`},
		}}
	})

	if heard := said(t, written); heard != `{"permissions":{"deny":["Bash(rm *)"]}}` {
		t.Errorf("the agent found %q", heard)
	}
}

func TestAHarnessFileOutsideTheStateDirectoryFailsTheRun(t *testing.T) {
	written := &journal{}
	err := session.Execute(context.Background(), protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Command: protocol.Command{Executable: harness(t, `said = "worked";`, "end_turn")},
			HarnessSetup: protocol.HarnessSetup{Files: []protocol.SetupFile{
				{Path: "../settings.json", Text: "{}"},
			}},
		},
	}, session.Options{
		Workspace: t.TempDir(),
		Journal:   written,
		Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	})

	if err == nil || !strings.Contains(err.Error(), "escapes the state directory") {
		t.Fatalf("expected the file to fail the run, got %v", err)
	}
	if written.done == nil || !written.done.Failed {
		t.Fatalf("completion %+v", written.done)
	}
	if heard := said(t, written); heard != "" {
		t.Errorf("the agent was started anyway and said %q", heard)
	}
}

func permitting(t *testing.T) string {
	t.Helper()

	script := `#!/usr/bin/env node
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
let buffered = "", promptId = null;
process.stdin.on("data", (chunk) => {
  buffered += chunk.toString();
  const lines = buffered.split("\n");
  buffered = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1 } });
    if (msg.method === "session/new") send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_opened" } });
    if (msg.method === "session/prompt") {
      promptId = msg.id;
      send({ jsonrpc: "2.0", id: 900, method: "session/request_permission",
             params: { sessionId: msg.params.sessionId,
                       toolCall: { toolCallId: "toolu_1", kind: "execute", title: "rm -rf build",
                                   rawInput: { command: "rm -rf build" } },
                       options: [{ optionId: "allowed", kind: "allow_once" },
                                 { optionId: "refused", kind: "reject_once" }] } });
    }
    if (msg.id === 900) {
      const outcome = msg.result.outcome;
      const told = outcome.outcome === "selected" ? outcome.optionId : outcome.outcome;
      send({ jsonrpc: "2.0", method: "session/update",
             params: { update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: told } } } });
      send({ jsonrpc: "2.0", id: promptId, result: { stopReason: told === "cancelled" ? "cancelled" : "end_turn" } });
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

func TestAPermissionIsAnsweredAsTheControlPlaneDecides(t *testing.T) {
	for _, expected := range []struct {
		name     string
		asks     []string
		decision string
		told     string
		asked    int
	}{
		{"no profile", nil, protocol.PermissionReject, "allowed", 0},
		{"a kind the profile never asks about", []string{"edit", "delete"}, protocol.PermissionReject, "allowed", 0},
		{"allowed", []string{"execute"}, protocol.PermissionAllow, "allowed", 1},
		{"rejected", []string{"execute"}, protocol.PermissionReject, "refused", 1},
		{"unreachable", []string{"execute"}, "", "refused", 1},
	} {
		written := run(t, permitting(t), func(o *runOptions) {
			o.setup = protocol.HarnessSetup{Asks: expected.asks}
			o.decision = expected.decision
		})

		if heard := said(t, written); heard != expected.told {
			t.Errorf("%s: the agent was told %q, wanted %q", expected.name, heard, expected.told)
		}
		if len(written.asked) != expected.asked {
			t.Fatalf("%s: asked the control plane %d times, wanted %d", expected.name, len(written.asked), expected.asked)
		}
		if written.done == nil || written.done.Failed {
			t.Errorf("%s: completion %+v", expected.name, written.done)
		}
		if expected.asked == 0 {
			continue
		}

		want := protocol.PermissionAsked{
			SessionID: "session_opened",
			Kind:      "execute",
			Title:     "rm -rf build",
			Input:     json.RawMessage(`{"command":"rm -rf build"}`),
		}
		if got := written.asked[0]; got.SessionID != want.SessionID ||
			got.Kind != want.Kind || got.Title != want.Title || string(got.Input) != string(want.Input) {
			t.Errorf("%s: asked %+v, wanted %+v", expected.name, got, want)
		}
	}
}

func TestAPermissionPutToAPersonLetsTheRunGo(t *testing.T) {
	written := run(t, permitting(t), func(o *runOptions) {
		o.setup = protocol.HarnessSetup{Asks: []string{"execute"}}
		o.decision = protocol.PermissionPutToPerson
		o.said = [][]protocol.Said{{{Position: 1, Body: "not yet"}}}
	})

	if heard := said(t, written); heard != "cancelled" {
		t.Errorf("the agent was told %q", heard)
	}
	if written.done == nil || written.done.Failed || written.done.Stopped {
		t.Fatalf("completion %+v", written.done)
	}
	if written.done.SessionID != "session_opened" {
		t.Errorf("reported session %q", written.done.SessionID)
	}
	if len(written.delivered) != 0 {
		t.Errorf("waited on what was said: delivered %v", written.delivered)
	}
}
