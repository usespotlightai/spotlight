package session_test

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/session"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

type generated struct {
	repository string
	diff       string
	base       string
}

type journal struct {
	mu                     sync.Mutex
	events                 []protocol.Event
	afterStoppedCompletion []protocol.Event
	renewals               int
	done                   *protocol.Completion
	completions            []protocol.Completion
	completedBy            []int
	calls                  []string
	restores               int
	stopAfter              int
	messages               [][]protocol.Message
	acked                  []int
	files                  map[string]string
	generated              []generated
	decision               string
	asked                  []protocol.PermissionRequest
	archives               *archives
	remembered             []remembered
	memory                 []protocol.MemoryFile
	memoryErr              error
	memoryTakes            time.Duration
	renewedWhileReading    int
	starts                 []protocol.StartingPoint
	startErr               error
	proposed               []protocol.CandidateProposal
	caused                 []protocol.CauseRecord
}

type remembered struct {
	received protocol.RememberRequest
	journal  []protocol.Event
}

func (j *journal) AppendEvents(_ context.Context, _ string, events []protocol.Event) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.done != nil && j.done.Stopped {
		j.afterStoppedCompletion = append(j.afterStoppedCompletion, events...)
	}
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
	j.calls = append(j.calls, "complete")
	j.done = &done
	j.completions = append(j.completions, done)
	if j.archives != nil {
		j.completedBy = append(j.completedBy, j.archives.count())
	}
	return nil
}

func (j *journal) UseTool(
	_ context.Context, _ string, _ string, _ json.RawMessage,
) (json.RawMessage, error) {
	return json.RawMessage(`{"output":"https://github.com/acme/widgets/pull/1"}`), nil
}

func (j *journal) GenerateChangeStack(
	_ context.Context, _ string, repository, diff, base string,
) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.calls = append(j.calls, "generate")
	j.generated = append(j.generated, generated{repository: repository, diff: diff, base: base})
	return nil
}

func (j *journal) ReplyToReviewComment(
	_ context.Context, _ string, _ protocol.ReviewCommentReply,
) error {
	return nil
}

func (j *journal) Trace(
	_ context.Context, _ string, _ string,
) (json.RawMessage, error) {
	return nil, nil
}

func (j *journal) History(
	_ context.Context, _ string, _ protocol.HistoryRequest,
) (json.RawMessage, error) {
	return nil, nil
}

func (j *journal) SearchView(_ context.Context, _ string) (json.RawMessage, error) {
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
	_ context.Context, _ string, received protocol.RememberRequest,
) (json.RawMessage, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.remembered = append(j.remembered, remembered{received: received, journal: slices.Clone(j.events)})
	return json.Marshal(map[string]string{"kind": received.Kind, "body": received.Body})
}

func (j *journal) ProposeCandidate(
	_ context.Context, _ string, proposal protocol.CandidateProposal,
) (json.RawMessage, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.proposed = append(j.proposed, proposal)
	return json.Marshal(protocol.ProposedCandidate{CandidateID: "cand_1", Name: proposal.Name, ReplayID: "replay_1"})
}

func (j *journal) RecordCause(
	_ context.Context, _ string, record protocol.CauseRecord,
) (json.RawMessage, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.caused = append(j.caused, record)
	return json.Marshal(protocol.RecordCauseResponse{TaskID: record.TaskID, Cause: record.Cause, ReplayRunID: "replayed_1"})
}

func (j *journal) MemoryFiles(context.Context, string) ([]protocol.MemoryFile, error) {
	if j.memoryTakes > 0 {
		before := j.renewed()
		time.Sleep(j.memoryTakes)
		j.mu.Lock()
		j.renewedWhileReading = j.renewals - before
		j.mu.Unlock()
	}
	return j.memory, j.memoryErr
}

func (j *journal) renewed() int {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.renewals
}

func (j *journal) Messages(context.Context, string) ([]protocol.Message, error) {
	j.mu.Lock()
	defer j.mu.Unlock()

	if len(j.messages) == 0 {
		return nil, nil
	}

	next := j.messages[0]
	j.messages = j.messages[1:]
	return next, nil
}

func (j *journal) AckMessages(_ context.Context, _ string, upTo int) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.acked = append(j.acked, upTo)
	return nil
}

func (j *journal) Attachment(_ context.Context, _ string, id string, into io.Writer) error {
	j.mu.Lock()
	content, found := j.files[id]
	j.mu.Unlock()

	if !found {
		return errors.New("404 Not Found: no such attachment")
	}
	_, err := io.WriteString(into, content)
	return err
}

func (j *journal) AskPermission(
	_ context.Context, _ string, asked protocol.PermissionRequest,
) (protocol.PermissionResponse, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.asked = append(j.asked, asked)
	if j.decision == "" {
		return protocol.PermissionResponse{}, errors.New("503 Service Unavailable")
	}
	return protocol.PermissionResponse{Decision: j.decision}, nil
}

func (j *journal) WorkingCopyArchive(_ context.Context, _ string) (*protocol.StoredArchive, error) {
	j.mu.Lock()
	j.restores++
	j.mu.Unlock()
	if j.archives == nil {
		return nil, nil
	}
	return j.archives.newest(), nil
}

func (j *journal) GrantArchive(
	_ context.Context, _ string, size int64, sha256 string,
) (protocol.ArchiveGrant, error) {
	j.mu.Lock()
	j.calls = append(j.calls, "archive")
	j.mu.Unlock()
	if j.archives == nil {
		return protocol.ArchiveGrant{}, errors.New("422 Unprocessable Entity: nowhere to store one")
	}
	return j.archives.grant(size, sha256), nil
}

func (j *journal) GrantAttachment(
	_ context.Context, _ string, request protocol.AttachmentRequest,
) (protocol.AttachmentGrant, error) {
	j.mu.Lock()
	j.calls = append(j.calls, "attachment "+request.Name)
	j.mu.Unlock()
	return protocol.AttachmentGrant{}, errors.New("422 Unprocessable Entity: nowhere to store one")
}

func (j *journal) CompleteArchive(_ context.Context, _ string, archiveID string) error {
	return j.archives.complete(archiveID)
}

func (j *journal) RecordStartingPoint(_ context.Context, _ string, point protocol.StartingPoint) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.startErr != nil {
		return j.startErr
	}
	j.starts = append(j.starts, point)
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
      if (msg.params.sessionId === "session_known") send({ jsonrpc: "2.0", id: msg.id, result: {} });
      else send({ jsonrpc: "2.0", id: msg.id,
                  error: { code: -32002, message: "Resource not found: " + msg.params.sessionId } });
    }
    if (msg.method === "session/prompt") {
      const sessionId = msg.params.sessionId;
      let output = "";
      let usage;
      try { ` + doing + ` } catch (e) { output = String(e.message ?? e); }
      send({ jsonrpc: "2.0", method: "session/update",
             params: { update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: output } } } });
      send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "` + stopReason + `", ...(usage ? { usage } : {}) } });
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
	return stallingAfter(t, "")
}

func stallingAfter(t *testing.T, doing string) string {
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
    if (msg.method === "session/prompt") { ` + doing + ` }
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
	messages    [][]protocol.Message
	heartbeat   time.Duration
	sandbox     *session.Sandbox
	runID       string
	briefing    string
	handover    []string
	agentUser   *account.User
	root        string
	env         map[string]string
	resume      protocol.Resume
	stopAfter   int
	attachments []protocol.Attachment
	skills      []protocol.SkillFile
	skillHomes  []string
	settings    []string
	files       map[string]string
	setup       protocol.HarnessSetup
	decision    string
	archives    *archives
	memory      []protocol.MemoryFile
	memoryErr   error
	memoryTakes time.Duration
	starting    bool
	startErr    error
	replay      *protocol.Replay
	search      *protocol.SearchSpec
	checkouts   []protocol.Checkout
	proxyEnv    map[string]string
	enforced    func(context.Context) bool
	stopOnce    string
	wait        time.Duration
	quiet       time.Duration
	log         *slog.Logger
}

func run(t *testing.T, executable string, over ...func(*runOptions)) *journal {
	t.Helper()

	settings := runOptions{root: t.TempDir()}
	for _, adjust := range over {
		adjust(&settings)
	}

	written := &journal{
		messages:    settings.messages,
		stopAfter:   settings.stopAfter,
		files:       settings.files,
		decision:    settings.decision,
		archives:    settings.archives,
		memory:      settings.memory,
		memoryErr:   settings.memoryErr,
		memoryTakes: settings.memoryTakes,
		startErr:    settings.startErr,
	}
	if settings.sandbox == nil {
		settings.sandbox = new(session.Sandbox)
	}
	if settings.runID == "" {
		settings.runID = "run_1"
	}
	ctx, stop := context.WithCancel(context.Background())
	defer stop()
	if settings.stopOnce != "" {
		go stopOnceWritten(ctx, stop, filepath.Join(settings.root, settings.stopOnce))
	}

	err := settings.sandbox.Execute(ctx, protocol.Run{
		ID: settings.runID,
		Spec: protocol.Spec{
			Command:       protocol.Command{Executable: executable, Env: settings.env},
			Briefing:      settings.briefing,
			Handover:      protocol.HandoverSpec{Options: settings.handover},
			Resume:        settings.resume,
			Attachments:   settings.attachments,
			Skills:        settings.skills,
			SkillHomes:    settings.skillHomes,
			HarnessSetup:  settings.setup,
			SettingFiles:  settings.settings,
			StartingPoint: settings.starting,
			Replay:        settings.replay,
			Search:        settings.search,
			Checkouts:     settings.checkouts,
		},
	}, session.Options{
		Workspace:      settings.root,
		Journal:        written,
		Log:            cmp.Or(settings.log, slog.New(slog.NewTextHandler(io.Discard, nil))),
		AgentUser:      settings.agentUser,
		Heartbeat:      settings.heartbeat,
		ProxyEnv:       settings.proxyEnv,
		Enforced:       settings.enforced,
		BackgroundWait: settings.wait,
		SettleQuiet:    settings.quiet,
	})
	if err != nil && settings.stopOnce == "" {
		t.Fatalf("execute: %v", err)
	}

	return written
}

func stopOnceWritten(ctx context.Context, stop context.CancelFunc, path string) {
	for ctx.Err() == nil {
		if _, err := os.Stat(path); err == nil {
			stop()
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func agentOutput(t *testing.T, written *journal) string {
	t.Helper()

	var output strings.Builder
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
			t.Fatalf("the journal recorded something that is not an update: %v", err)
		}
		output.WriteString(update.Update.Content.Text)
	}

	return output.String()
}

func TestTakesARunFromNothingToAnOutcome(t *testing.T) {
	written := run(t, harness(t, `output = "worked";`, "end_turn"))

	if ready := written.typed(protocol.EventWorkingCopyReady); len(ready) != 1 {
		t.Errorf("expected the workspace to be reported once, got %d", len(ready))
	}
	if output := agentOutput(t, written); output != "worked" {
		t.Errorf("output %q", output)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}
}

func TestRecordsTheAgentsOutputAsItWasWritten(t *testing.T) {
	written := run(t, harness(t, `output = "structured";`, "end_turn"))

	output := written.typed(protocol.EventOutput)
	if len(output) == 0 {
		t.Fatal("nothing was recorded")
	}

	var update map[string]any
	if err := json.Unmarshal(output[0].Data, &update); err != nil {
		t.Fatalf("not readable as an update: %v", err)
	}
	if _, ok := update["update"]; !ok {
		t.Errorf("recorded %v, which is not a session update", update)
	}
}

func TestWhatATurnUsedIsRecordedAsTheHarnessReportedIt(t *testing.T) {
	written := run(t, harness(t, `output = "cached"; usage = { totalTokens: 20, inputTokens: 3, outputTokens: 5, cachedReadTokens: 12 };`, "end_turn"))

	used := written.typed(protocol.EventUsage)
	if len(used) != 1 {
		t.Fatalf("expected one usage per turn, got %d", len(used))
	}

	var usage map[string]any
	if err := json.Unmarshal(used[0].Data, &usage); err != nil {
		t.Fatalf("not readable as usage: %v", err)
	}
	if usage["cachedReadTokens"] != float64(12) {
		t.Errorf("recorded %v", usage)
	}
	if _, found := usage["cachedWriteTokens"]; found {
		t.Errorf("recorded a cache write the harness never reported: %v", usage)
	}
}

func TestATurnThatReportsNoUsageRecordsNone(t *testing.T) {
	written := run(t, harness(t, `output = "quiet";`, "end_turn"))

	if used := written.typed(protocol.EventUsage); len(used) != 0 {
		t.Errorf("recorded usage nobody reported: %v", used)
	}
}

func TestEventsAreNumberedWithoutGaps(t *testing.T) {
	written := run(t, harness(t, `output = "one";`, "end_turn"))

	for at, event := range written.events {
		if event.Seq != at+1 {
			t.Fatalf("event %d is numbered %d", at, event.Seq)
		}
	}
}

func TestATurnThatEndsBadlyIsReportedAsFailed(t *testing.T) {
	written := run(t, harness(t, `output = "refused";`, "refusal"))

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
	if len(written.typed(protocol.EventAgentStopped)) != 1 || slices.ContainsFunc(written.afterStoppedCompletion, stoppedAgent) {
		t.Error("the journal should say that the agent was stopped, before the run completed")
	}
}

func TestASteeredTurnIsTakenUpNotFailed(t *testing.T) {
	written := run(t, harness(t, `output = "working";`, "cancelled"),
		func(o *runOptions) {
			o.messages = [][]protocol.Message{
				{{Position: 1, Body: "actually, do this instead"}},
			}
		})

	if written.done == nil || written.done.Failed {
		t.Fatalf("a steered run should finish, not fail: %+v", written.done)
	}
	if len(written.acked) == 0 {
		t.Error("the message that the person sent mid-turn was never acknowledged")
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

func TestARunWithoutItsLocalProxyFailsBeforeTheAgentStarts(t *testing.T) {
	written := &journal{}
	err := session.Execute(context.Background(), protocol.Run{
		ID:   "run_1",
		Spec: protocol.Spec{Command: protocol.Command{Executable: harness(t, `output = "went out";`, "end_turn")}},
	}, session.Options{
		Workspace: t.TempDir(),
		Journal:   written,
		Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
		Unready:   errors.New("the local proxy did not open"),
	})

	if err == nil || written.done == nil || !written.done.Failed || !written.done.SetupFailed {
		t.Fatalf("completion %+v: %v", written.done, err)
	}
	if !strings.Contains(written.done.Message, "the local proxy did not open") {
		t.Errorf("got %q", written.done.Message)
	}
	if agentOutput(t, written) != "" {
		t.Error("the agent started")
	}
}

func TestTheAgentGetsItsOwnAccount(t *testing.T) {
	if os.Getuid() != 0 {
		t.Skip("dropping to another user needs root")
	}
	as, err := account.LookupUser("agent")
	if err != nil {
		t.Skipf("no agent account here: %v", err)
	}

	t.Setenv("SPOTLIGHT_RUN_TOKEN", "the-runners-control-plane-token")

	root, err := os.MkdirTemp("", "account")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(root) })

	written := run(t, harness(t,
		`output = [process.getuid(), process.env.HOME, process.env.USER, process.env.SHELL,
                 process.env.SPOTLIGHT_RUN_TOKEN ?? "no-token"].join(" ");`, "end_turn"),
		func(o *runOptions) { o.agentUser = as; o.root = root })

	output := agentOutput(t, written)
	for _, wanted := range []string{"2000", "/home/agent", "agent", "no-token"} {
		if !strings.Contains(output, wanted) {
			t.Errorf("%q missing from %q", wanted, output)
		}
	}
}

func TestWhatTheAgentHandsOverGoesIntoTheCompletion(t *testing.T) {
	handingOver := `execSync(` + "`" +
		`${process.env.SPOTLIGHT_AGENT_API_URL ? "" : "no url"} node -e '
      const body = JSON.stringify({ next: "Spec", note: "needs a spec" });
      fetch(process.env.SPOTLIGHT_AGENT_API_URL, {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_AGENT_API_TOKEN },
        body,
      }).then(() => process.exit(0));
    '` + "`" + `); output = "handed over";`

	written := run(t, harness(t, handingOver, "end_turn"),
		func(o *runOptions) { o.handover = []string{"Spec", "review"} })

	handover := written.done.Handover
	if handover == nil || handover.Next != "Spec" || handover.Note != "needs a spec" {
		t.Fatalf("got %+v", handover)
	}
}

func TestTheAgentRemembersThroughItsRunAfterItsStepsAreJournalled(t *testing.T) {
	remembering := `send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update: {
        sessionUpdate: "tool_call", toolCallId: "toolu_remember", title: "spotlight remember" } } });
      execSync(` + "`" +
		`node -e '
      const body = JSON.stringify({ kind: "rationale", body: "Retry in the request." });
      fetch(process.env.SPOTLIGHT_AGENT_API_URL + "remember", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_AGENT_API_TOKEN },
        body,
      }).then((answer) => process.exit(answer.ok ? 0 : 1));
    '` + "`" + `); output = "remembered";`

	written := run(t, harness(t, remembering, "end_turn"))

	written.mu.Lock()
	defer written.mu.Unlock()

	if len(written.remembered) != 1 {
		t.Fatalf("remembered %+v", written.remembered)
	}
	if got := written.remembered[0].received; got.Kind != "rationale" || got.Body != "Retry in the request." {
		t.Errorf("remembered %+v", got)
	}
	stepped := slices.ContainsFunc(written.remembered[0].journal, func(event protocol.Event) bool {
		return strings.Contains(string(event.Data), "toolu_remember")
	})
	if !stepped {
		t.Error("the step the agent remembered from should be in the journal before the memory is")
	}
}

func TestARecallGoesToSpotlightAndToTheTraceAsASpan(t *testing.T) {
	recalling := `execSync(` + "`" +
		`node -e '
      fetch(process.env.SPOTLIGHT_AGENT_API_URL + "recall", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_AGENT_API_TOKEN },
        body: JSON.stringify({ words: "upload retries" }),
      }).then((answer) => process.exit(answer.ok ? 0 : 1));
    '` + "`" + `); output = "recalled";`

	written := run(t, harness(t, recalling, "end_turn"))

	spans := written.typed(protocol.EventSpan)
	if len(spans) != 1 || !strings.Contains(string(spans[0].Data), `"spotlight.recall"`) ||
		!strings.Contains(string(spans[0].Data), "upload retries") {
		t.Fatalf("spans %v", spans)
	}
}

func TestTheBriefingGoesToTheAgent(t *testing.T) {
	written := run(t, harness(t, `output = msg.params.prompt[0].text;`, "end_turn"),
		func(o *runOptions) { o.briefing = "## Fix the queue" })

	if output := agentOutput(t, written); output != "## Fix the queue" {
		t.Errorf("the agent was prompted with %q", output)
	}
}

func TestTheWorkspaceGoesWithTheRun(t *testing.T) {
	root := t.TempDir()
	run(t, harness(t, `output = "done";`, "end_turn"), func(o *runOptions) { o.root = root })

	if _, err := os.Stat(filepath.Join(root, "run_1")); !os.IsNotExist(err) {
		t.Error("the workspace should be gone")
	}
}

func TestTakesUpTheSessionInTheSpec(t *testing.T) {
	written := run(t, harness(t, `output = sessionId;`, "end_turn"), func(o *runOptions) {
		o.resume = protocol.Resume{SessionID: "session_known"}
	})

	if got := agentOutput(t, written); got != "session_known" {
		t.Errorf("worked in session %q", got)
	}
	if written.done.SessionID != "session_known" {
		t.Errorf("reported session %q", written.done.SessionID)
	}
}

func TestOpensAFreshSessionWhenTheHarnessHasNoSuchSession(t *testing.T) {
	written := run(t, harness(t, `output = sessionId;`, "end_turn"), func(o *runOptions) {
		o.resume = protocol.Resume{SessionID: "session_long_gone"}
	})

	if got := agentOutput(t, written); got != "session_opened" {
		t.Errorf("worked in session %q", got)
	}
	if written.done.SessionID != "session_opened" {
		t.Errorf("reported session %q", written.done.SessionID)
	}
}

func TestReportsTheSessionItOpened(t *testing.T) {
	written := run(t, harness(t, `output = "worked";`, "end_turn"))

	if written.done.SessionID != "session_opened" {
		t.Errorf("reported session %q", written.done.SessionID)
	}
}

func TestDisposesOfTheWorkspaceAfterTheRun(t *testing.T) {
	root := t.TempDir()

	run(t, harness(t, `output = "worked";`, "end_turn"), func(o *runOptions) { o.root = root })

	if _, err := os.Stat(filepath.Join(root, "run_1")); !os.IsNotExist(err) {
		t.Errorf("the workspace outlived the run: %v", err)
	}
}

func TestExpandsTheStateDirectoryIntoWhatTheHarnessGets(t *testing.T) {
	root := t.TempDir()

	written := run(t, harness(t, `output = process.env.HARNESS_STATE_DIR ?? "unset";`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.resume = protocol.Resume{Key: "task_1"}
		o.env = map[string]string{"HARNESS_STATE_DIR": "${" + session.StateVar + "}/somewhere"}
	})

	want := filepath.Join(root, workspace.StatePath, "somewhere")
	if got := agentOutput(t, written); got != want {
		t.Errorf("the harness got %q, wanted %q", got, want)
	}
}

func TestTheHarnessConnectsThroughTheLocalProxy(t *testing.T) {
	written := run(t, harness(t, `output = [process.env.HTTPS_PROXY, process.env.NODE_USE_ENV_PROXY].join(" ");`, "end_turn"),
		func(o *runOptions) {
			o.env = map[string]string{"HTTPS_PROXY": "http://elsewhere:8080"}
			o.proxyEnv = map[string]string{"HTTPS_PROXY": "http://127.0.0.1:3128", "NODE_USE_ENV_PROXY": "1"}
		})

	if got := agentOutput(t, written); got != "http://127.0.0.1:3128 1" {
		t.Errorf("the harness got %q", got)
	}
}

func TestJournalsWhetherEgressIsEnforcedBeforeTheHarnessStarts(t *testing.T) {
	for _, enforced := range []bool{true, false} {
		written := run(t, harness(t, `output = "worked";`, "end_turn"), func(o *runOptions) {
			o.enforced = func(context.Context) bool { return enforced }
		})

		checked := written.typed(protocol.EventEgressChecked)
		if len(checked) != 1 || string(checked[0].Data) != fmt.Sprintf(`{"enforced":%t}`, enforced) {
			t.Errorf("journalled %+v", checked)
		}
	}

	if checked := run(t, harness(t, `output = "worked";`, "end_turn")).typed(protocol.EventEgressChecked); len(checked) != 0 {
		t.Errorf("journalled a check without egress: %+v", checked)
	}
}

func TestWhatAPersonSaysGoesToTheAgentAsAnotherTurn(t *testing.T) {
	written := run(t, harness(t, `output = JSON.stringify(msg.params.prompt);`, "end_turn"),
		func(o *runOptions) {
			o.briefing = "the first thing"
			o.messages = [][]protocol.Message{{{Position: 3, Body: "and one more thing"}}}
		})

	output := agentOutput(t, written)

	if !strings.Contains(output, "and one more thing") {
		t.Errorf("the message that the person sent never arrived: %q", output)
	}
	if len(written.acked) != 1 || written.acked[0] != 3 {
		t.Errorf("acknowledged %v, wanted [3]", written.acked)
	}
}

func reading(path string) string {
	return `output = require("node:fs").readFileSync("` + path + `", "utf8");`
}

func TestWhatWasAttachedIsThereBeforeTheAgentStarts(t *testing.T) {
	const path = ".spotlight/attachments/att_1/notes.txt"

	written := run(t, harness(t, reading(path), "end_turn"), func(o *runOptions) {
		o.attachments = []protocol.Attachment{{ID: "att_1", Path: path}}
		o.files = map[string]string{"att_1": "the notes"}
	})

	if output := agentOutput(t, written); output != "the notes" {
		t.Errorf("the agent found %q", output)
	}
}

func TestARunWhoseAttachmentCannotBeFetchedFails(t *testing.T) {
	written := &journal{}
	err := session.Execute(context.Background(), protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Command: protocol.Command{Executable: harness(t, `output = "worked";`, "end_turn")},
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
	if output := agentOutput(t, written); output != "" {
		t.Errorf("the agent was started anyway and wrote %q", output)
	}
}

func TestWhatIsAttachedMidRunIsThereBeforeItsTurn(t *testing.T) {
	const path = ".spotlight/attachments/att_2/log.txt"

	written := run(t, harness(t, reading(path), "end_turn"), func(o *runOptions) {
		o.messages = [][]protocol.Message{{{
			Position:    1,
			Body:        "see " + path,
			Attachments: []protocol.Attachment{{ID: "att_2", Path: path}},
		}}}
		o.files = map[string]string{"att_2": "the log"}
	})

	output := agentOutput(t, written)
	if !strings.HasSuffix(output, "the log") {
		t.Errorf("the second turn did not find the file: %q", output)
	}
	if strings.HasPrefix(output, "the log") {
		t.Errorf("the file was there before anyone attached it: %q", output)
	}
}

func TestMessagesAreAcknowledgedEvenWhenTheirAttachmentIsNot(t *testing.T) {
	written := run(t, harness(t, `output = JSON.stringify(msg.params.prompt);`, "end_turn"),
		func(o *runOptions) {
			o.messages = [][]protocol.Message{{{
				Position:    2,
				Body:        "see the log",
				Attachments: []protocol.Attachment{{ID: "att_gone", Path: "log.txt"}},
			}}}
		})

	if output := agentOutput(t, written); !strings.Contains(output, "see the log") {
		t.Errorf("the message that the person sent never arrived: %q", output)
	}
	if len(written.acked) != 1 || written.acked[0] != 2 {
		t.Errorf("acknowledged %v, wanted [2]", written.acked)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}
}

func TestARunEndsWhenNobodyHasSentAMessage(t *testing.T) {
	written := run(t, harness(t, `output = "worked";`, "end_turn"),
		func(o *runOptions) { o.briefing = "the only thing" })

	if len(written.acked) != 0 {
		t.Errorf("acknowledged %v, wanted nothing", written.acked)
	}
}

func TestSkillsAreLaidBeforeTheAgentStarts(t *testing.T) {
	const path = ".claude/skills/spotlight-handover/SKILL.md"

	written := run(t, harness(t, reading(path), "end_turn"), func(o *runOptions) {
		o.skills = []protocol.SkillFile{{Path: path, Text: "how to hand over"}}
	})

	if output := agentOutput(t, written); output != "how to hand over" {
		t.Errorf("the agent found %q", output)
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
output = JSON.stringify([
  fs.readFileSync(".spotlight/memory/repositories/acme/api/src/uploads/M-18.md", "utf8"),
  fs.existsSync(".spotlight/memory/team/M-1.md"),
  fs.existsSync("elsewhere.md"),
]);`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.resume = protocol.Resume{Key: "task_1"}
		o.memory = []protocol.MemoryFile{
			{Path: ".spotlight/memory/repositories/acme/api/src/uploads/M-18.md", Body: "# M-18 · rationale"},
			{Path: "elsewhere.md", Body: "not memory"},
		}
	})

	if output := agentOutput(t, written); output != `["# M-18 · rationale",false,false]` {
		t.Errorf("the agent found %s", output)
	}
}

func TestARunStartsWithANoteWhenTheTeamsMemoryCannotBeRead(t *testing.T) {
	written := run(t, harness(t, `const fs = require("node:fs");
output = JSON.stringify([fs.readdirSync(".spotlight/memory"), fs.readFileSync(".spotlight/memory/README.md", "utf8")]);`, "end_turn"),
		func(o *runOptions) { o.memoryErr = errors.New("control plane down") })

	if output := agentOutput(t, written); !strings.Contains(output, `["README.md"]`) || !strings.Contains(output, "could not be read") {
		t.Errorf("the agent found %s", output)
	}
}

func TestTheRunKeepsItsLeaseWhileItPreparesTheWorkspace(t *testing.T) {
	written := run(t, harness(t, `output = "ready";`, "end_turn"), func(o *runOptions) {
		o.heartbeat = 10 * time.Millisecond
		o.memoryTakes = 200 * time.Millisecond
	})

	if written.renewedWhileReading == 0 {
		t.Error("nothing renewed the lease before the agent started")
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
		o.resume = protocol.Resume{Key: "task_1"}
		o.memory = []protocol.MemoryFile{{Path: ".spotlight/memory/team/M-1.md", Body: "# M-1"}}
	})

	if output := agentOutput(t, written); output != "# M-1" {
		t.Errorf("the agent found %q", output)
	}
}

func TestAMemoryFileThatWouldLeaveTheFolderIsLeftOut(t *testing.T) {
	written := run(t, harness(t, `output = String(require("node:fs").existsSync("escaped.md"));`, "end_turn"),
		func(o *runOptions) {
			o.memory = []protocol.MemoryFile{{Path: ".spotlight/memory/../../escaped.md", Body: "out"}}
		})

	if output := agentOutput(t, written); output != "false" {
		t.Errorf("a memory file escaped the folder: %s", output)
	}
}

func TestARestoredWorkspaceHasOnlyTheSkillsEnabledForThisRun(t *testing.T) {
	root := t.TempDir()

	handingOver := protocol.SkillFile{Path: ".claude/skills/spotlight-handover/SKILL.md", Text: "how to hand over"}
	migrating := protocol.SkillFile{Path: ".claude/skills/our-migrations/SKILL.md", Text: "how we migrate"}
	example := protocol.SkillFile{Path: ".claude/skills/our-migrations/examples/add-column.md", Text: "add it"}
	opening := protocol.SkillFile{Path: ".claude/skills/spotlight-pull-request/SKILL.md", Text: "how to open one"}

	leaveSkills(t, root, handingOver, migrating, example, opening)

	written := run(t, harness(t, `const fs = require("node:fs");
output = JSON.stringify([
  fs.readFileSync(".claude/skills/our-migrations/SKILL.md", "utf8"),
  fs.existsSync(".claude/skills/spotlight-handover/SKILL.md"),
  fs.existsSync(".claude/skills/our-migrations/examples"),
  fs.existsSync(".claude/skills/spotlight-pull-request"),
]);`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.resume = protocol.Resume{Key: "task_1"}
		o.skills = []protocol.SkillFile{handingOver, migrating}
	})

	if output := agentOutput(t, written); output != `["how we migrate",true,false,false]` {
		t.Errorf("the agent found %s", output)
	}
}

func TestARestoredWorkspaceHasNoSkillsOfAnEarlierStationWhenThisRunHasNoneEnabled(t *testing.T) {
	root := t.TempDir()

	leaveSkills(t, root,
		protocol.SkillFile{Path: ".claude/skills/our-migrations/SKILL.md"},
		protocol.SkillFile{Path: ".spotlight/skills/our-migrations/SKILL.md"},
		protocol.SkillFile{Path: "notes/SKILL.md"},
	)

	written := run(t, harness(t, `const fs = require("node:fs");
output = JSON.stringify([
  fs.existsSync(".claude/skills/our-migrations"),
  fs.existsSync(".spotlight/skills/our-migrations"),
  fs.existsSync("notes/SKILL.md"),
]);`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.resume = protocol.Resume{Key: "task-task_1"}
		o.skillHomes = []string{".claude/skills", ".spotlight/skills"}
	})

	if output := agentOutput(t, written); output != `[false,false,true]` {
		t.Errorf("the agent found %s", output)
	}
}

func TestARestoredWorkspaceHasOnlyTheHarnessSettingsOfThisRun(t *testing.T) {
	root := t.TempDir()

	leaveSkills(t, root,
		protocol.SkillFile{Path: ".spotlight/state/claude/settings.json"},
		protocol.SkillFile{Path: ".spotlight/state/codex/config.toml"},
		protocol.SkillFile{Path: ".spotlight/state/claude/projects/-workspace/session_1.jsonl"},
	)

	written := run(t, harness(t, `const fs = require("node:fs");
output = JSON.stringify([
  fs.existsSync(".spotlight/state/claude/settings.json"),
  fs.readFileSync(".spotlight/state/codex/config.toml", "utf8"),
  fs.existsSync(".spotlight/state/claude/projects/-workspace/session_1.jsonl"),
]);`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.resume = protocol.Resume{Key: "task-task_1"}
		o.settings = []string{"claude/settings.json", "codex/config.toml", "codex/rules/spotlight.rules"}
		o.setup = protocol.HarnessSetup{Files: []protocol.SetupFile{{Path: "codex/config.toml", Text: "model = \"given\""}}}
	})

	if output := agentOutput(t, written); output != `[false,"model = \"given\"",true]` {
		t.Errorf("the agent found %s", output)
	}
}

func TestAnOutcomeAnEarlierRunLeftIsNotTakenForThisRuns(t *testing.T) {
	root := t.TempDir()

	leaveSkills(t, root, protocol.SkillFile{Path: ".spotlight/outcome.json"})
	if err := os.WriteFile(filepath.Join(root, ".spotlight/outcome.json"), []byte(`{"next":"review","note":"from the last station"}`), 0o600); err != nil {
		t.Fatal(err)
	}

	written := run(t, harness(t, `output = "handed over nothing";`, "end_turn"), func(o *runOptions) {
		o.root = root
		o.handover = []string{"review"}
	})

	if written.done == nil || written.done.Handover != nil {
		t.Errorf("the run ended with %+v, wanted no outcome", written.done)
	}
}

func leaveSkills(t *testing.T, space string, left ...protocol.SkillFile) {
	t.Helper()

	for _, skill := range left {
		if err := os.MkdirAll(filepath.Dir(filepath.Join(space, skill.Path)), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(space, skill.Path), []byte("stale"), 0o600); err != nil {
			t.Fatal(err)
		}
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
                                   content: { type: "text", text: "got: " + msg.params.prompt[0].text } } } });
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

func TestAMessageIsSentAgainWhereTheHarnessLetsItGoUnread(t *testing.T) {
	written := run(t, droppingAfterCancel(t), func(o *runOptions) {
		o.messages = [][]protocol.Message{
			{{Position: 1, Body: "actually, do this instead"}},
		}
	})

	if written.done == nil || written.done.Failed {
		t.Fatalf("the run should finish: %+v", written.done)
	}

	for _, event := range written.typed(protocol.EventOutput) {
		if strings.Contains(string(event.Data), "got: actually, do this instead") {
			return
		}
	}
	t.Fatal("the message that the person sent never got to the agent")
}

func TestHarnessFilesAreLaidInTheStateDirectory(t *testing.T) {
	written := run(t, harness(t, reading(workspace.StatePath+"/claude/settings.json"), "end_turn"), func(o *runOptions) {
		o.setup = protocol.HarnessSetup{Files: []protocol.SetupFile{
			{Path: "claude/settings.json", Text: `{"permissions":{"deny":["Bash(rm *)"]}}`},
		}}
	})

	if output := agentOutput(t, written); output != `{"permissions":{"deny":["Bash(rm *)"]}}` {
		t.Errorf("the agent found %q", output)
	}
}

func TestAHarnessFileOutsideTheStateDirectoryFailsTheRun(t *testing.T) {
	written := &journal{}
	err := session.Execute(context.Background(), protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Command: protocol.Command{Executable: harness(t, `output = "worked";`, "end_turn")},
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
	if output := agentOutput(t, written); output != "" {
		t.Errorf("the agent was started anyway and wrote %q", output)
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
      const answer = outcome.outcome === "selected" ? outcome.optionId : outcome.outcome;
      send({ jsonrpc: "2.0", method: "session/update",
             params: { update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: answer } } } });
      send({ jsonrpc: "2.0", id: promptId, result: { stopReason: answer === "cancelled" ? "cancelled" : "end_turn" } });
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
		askKinds []string
		decision string
		answer   string
		asked    int
		refused  []string
	}{
		{"no profile", nil, protocol.PermissionReject, "allowed", 0, nil},
		{"a kind the profile never asks about", []string{"edit", "delete"}, protocol.PermissionReject, "allowed", 0, nil},
		{"allowed", []string{"execute"}, protocol.PermissionAllow, "allowed", 1, nil},
		{"rejected", []string{"execute"}, protocol.PermissionReject, "refused", 1, []string{"toolu_1"}},
		{"unreachable", []string{"execute"}, "", "refused", 1, []string{"toolu_1"}},
	} {
		written := run(t, permitting(t), func(o *runOptions) {
			o.setup = protocol.HarnessSetup{AskKinds: expected.askKinds}
			o.decision = expected.decision
		})

		if output := agentOutput(t, written); output != expected.answer {
			t.Errorf("%s: the agent got %q, wanted %q", expected.name, output, expected.answer)
		}
		if len(written.asked) != expected.asked {
			t.Fatalf("%s: asked for permission %d times, wanted %d", expected.name, len(written.asked), expected.asked)
		}
		if got := refusedCalls(t, written); !slices.Equal(got, expected.refused) {
			t.Errorf("%s: journalled refusals %v, wanted %v", expected.name, got, expected.refused)
		}
		if written.done == nil || written.done.Failed {
			t.Errorf("%s: completion %+v", expected.name, written.done)
		}
		if expected.asked == 0 {
			continue
		}

		want := protocol.PermissionRequest{
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

func refusedCalls(t *testing.T, written *journal) []string {
	t.Helper()

	var refused []string
	for _, event := range written.events {
		if event.Type != protocol.EventToolRefused {
			continue
		}
		var call struct {
			ToolCallID string `json:"toolCallId"`
		}
		if err := json.Unmarshal(event.Data, &call); err != nil {
			t.Fatalf("a refusal that is not JSON: %s", event.Data)
		}
		refused = append(refused, call.ToolCallID)
	}
	return refused
}

func TestAPermissionEscalatedToAPersonEndsTheTurnWhileNobodyHasAnswered(t *testing.T) {
	written := run(t, permitting(t), func(o *runOptions) {
		o.setup = protocol.HarnessSetup{AskKinds: []string{"execute"}}
		o.decision = protocol.PermissionPending
	})

	if output := agentOutput(t, written); output != "cancelled" {
		t.Errorf("the agent got %q", output)
	}
	if got := refusedCalls(t, written); !slices.Equal(got, []string{"toolu_1"}) {
		t.Errorf("journalled refusals %v", got)
	}
	if written.done == nil || written.done.Failed || written.done.Stopped {
		t.Fatalf("completion %+v", written.done)
	}
	if written.done.SessionID != "session_opened" {
		t.Errorf("reported session %q", written.done.SessionID)
	}
	if len(written.acked) != 0 {
		t.Errorf("waited on the messages: acknowledged %v", written.acked)
	}
}

func TestAFailureBeforeTheAgentIsHandedTheRunIsReportedAsSetupFailed(t *testing.T) {
	agent := protocol.Command{Executable: "nothing-of-that-name"}
	notADirectory := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(notADirectory, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	for name, at := range map[string]struct {
		workspace string
		spec      protocol.Spec
	}{
		"the workspace cannot be opened": {
			workspace: notADirectory,
			spec:      protocol.Spec{Command: agent},
		},
		"its repositories cannot be checked out": {
			spec: protocol.Spec{
				Command:   agent,
				Checkouts: []protocol.Checkout{{Remote: "/nowhere/at/all.git", Path: "api"}},
			},
		},
		"an attachment cannot be fetched": {
			spec: protocol.Spec{
				Command:     agent,
				Attachments: []protocol.Attachment{{ID: "att_gone", Path: ".spotlight/attachments/att_gone/notes.txt"}},
			},
		},
		"a skill cannot be written": {
			spec: protocol.Spec{
				Command: agent,
				Skills:  []protocol.SkillFile{{Path: "../outside/SKILL.md", Text: "x"}},
			},
		},
		"a setting file escapes the state directory": {
			spec: protocol.Spec{Command: agent, SettingFiles: []string{"../escaped.json"}},
		},
		"a harness file escapes the state directory": {
			spec: protocol.Spec{
				Command:      agent,
				HarnessSetup: protocol.HarnessSetup{Files: []protocol.SetupFile{{Path: "../escaped.json", Text: "{}"}}},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			written := &journal{}
			workspace := at.workspace
			if workspace == "" {
				workspace = t.TempDir()
			}

			err := session.Execute(context.Background(), protocol.Run{ID: "run_1", Spec: at.spec}, session.Options{
				Workspace: workspace,
				Journal:   written,
				Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
			})

			if err == nil {
				t.Fatal("expected the run to fail")
			}
			if written.done == nil || !written.done.Failed || !written.done.SetupFailed {
				t.Fatalf("completion %+v, want it failed before the handover", written.done)
			}
		})
	}
}

func TestAnAgentThatCannotStartIsNoFailureOfPreparation(t *testing.T) {
	written := &journal{}
	_ = session.Execute(context.Background(), protocol.Run{
		ID:   "run_1",
		Spec: protocol.Spec{Command: protocol.Command{Executable: "nothing-of-that-name"}},
	}, session.Options{
		Workspace: t.TempDir(),
		Journal:   written,
		Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	})

	if written.done == nil || !written.done.Failed || written.done.SetupFailed {
		t.Fatalf("completion %+v, want a failure after the handover", written.done)
	}
}

func TestAHarnessThatCannotOpenASessionIsAFailureOfPreparation(t *testing.T) {
	written := &journal{}
	_ = session.Execute(context.Background(), protocol.Run{
		ID:   "run_1",
		Spec: protocol.Spec{Command: protocol.Command{Executable: sessionless(t)}},
	}, session.Options{
		Workspace: t.TempDir(),
		Journal:   written,
		Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	})

	if written.done == nil || !written.done.Failed || !written.done.SetupFailed {
		t.Fatalf("completion %+v, want it failed before the agent could work", written.done)
	}
	if !strings.HasPrefix(written.done.Message, "The runner couldn't start the agent. Error: open a session:") {
		t.Fatalf("message %q, want it to name the session that did not open", written.done.Message)
	}
}

func sessionless(t *testing.T) string {
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
    if (msg.method === "session/new") send({ jsonrpc: "2.0", id: msg.id,
                                             error: { code: -32603, message: "Internal error: ENOSPC" } });
  }
});
`

	dir := t.TempDir()
	if err := os.Chmod(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "harness")
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func stoppedAgent(event protocol.Event) bool {
	return event.Type == protocol.EventAgentStopped
}

const promptText = `const prompt = msg.params.prompt.map((block) => block.text).join("");`

func handingOverWhen(condition string) string {
	return promptText + ` if (` + condition + `) { execSync(` + "`" + `node -e '
      fetch(process.env.SPOTLIGHT_AGENT_API_URL, {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_AGENT_API_TOKEN },
        body: JSON.stringify({ next: "review", note: "done" }),
      }).then(() => process.exit(0));
    '` + "`" + `); } output = "[" + prompt + "]";`
}

func prompts(t *testing.T, written *journal) []string {
	t.Helper()

	var said strings.Builder
	for _, event := range written.typed(protocol.EventOutput) {
		var update struct {
			Update struct {
				SessionUpdate string `json:"sessionUpdate"`
				Content       struct {
					Text string `json:"text"`
				} `json:"content"`
			} `json:"update"`
		}
		if json.Unmarshal(event.Data, &update) == nil && update.Update.SessionUpdate == "agent_message_chunk" {
			said.WriteString(update.Update.Content.Text)
		}
	}

	output := said.String()
	if !strings.HasPrefix(output, "[") || !strings.HasSuffix(output, "]") {
		t.Fatalf("the agent wrote %q", output)
	}
	return strings.Split(output[1:len(output)-1], "][")
}

func TestATurnThatEndsWithoutAHandoverIsAskedOnceForOne(t *testing.T) {
	written := run(t, harness(t, handingOverWhen("false"), "end_turn"), func(o *runOptions) {
		o.briefing = "do the work"
		o.handover = []string{"code-review", "review"}
	})

	got := prompts(t, written)
	if len(got) != 2 || got[0] != "do the work" || !strings.Contains(got[1], "without a handover") {
		t.Fatalf("the agent got %q", got)
	}
	if written.done == nil || written.done.Handover != nil {
		t.Errorf("completion %+v", written.done)
	}
}

func TestAHandoverMadeAfterTheReminderGoesIntoTheCompletion(t *testing.T) {
	written := run(t, harness(t, handingOverWhen(`prompt.includes("without a handover")`), "end_turn"),
		func(o *runOptions) {
			o.briefing = "do the work"
			o.handover = []string{"code-review", "review"}
		})

	if got := prompts(t, written); len(got) != 2 {
		t.Fatalf("the agent got %q", got)
	}
	if handover := written.done.Handover; handover == nil || handover.Next != "review" {
		t.Fatalf("handover %+v", handover)
	}
}

func TestATurnThatHandsOverIsNotReminded(t *testing.T) {
	written := run(t, harness(t, handingOverWhen("true"), "end_turn"), func(o *runOptions) {
		o.briefing = "do the work"
		o.handover = []string{"code-review", "review"}
	})

	if got := prompts(t, written); len(got) != 1 {
		t.Fatalf("the agent got %q", got)
	}
	if handover := written.done.Handover; handover == nil || handover.Next != "review" {
		t.Fatalf("handover %+v", handover)
	}
}

func TestARunWithNowhereToHandOverIsNotReminded(t *testing.T) {
	written := run(t, harness(t, handingOverWhen("false"), "end_turn"),
		func(o *runOptions) { o.briefing = "chat with me" })

	if got := prompts(t, written); len(got) != 1 {
		t.Fatalf("the agent got %q", got)
	}
}

func TestAPersonsMessageGetsItsOwnReminder(t *testing.T) {
	written := run(t, harness(t, handingOverWhen("false"), "end_turn"), func(o *runOptions) {
		o.briefing = "do the work"
		o.handover = []string{"code-review", "review"}
		o.messages = [][]protocol.Message{nil, {{Position: 1, Body: "one more thing"}}}
	})

	got := prompts(t, written)
	if len(got) != 4 || got[2] != "one more thing" || !strings.Contains(got[3], "without a handover") {
		t.Fatalf("the agent got %q", got)
	}
}

func TestTheReminderIsInTheJournal(t *testing.T) {
	written := run(t, harness(t, handingOverWhen("false"), "end_turn"),
		func(o *runOptions) { o.handover = []string{"review"} })

	reminded := written.typed(protocol.EventAgentReminded)
	if len(reminded) != 1 || !strings.Contains(reminded[0].Message, "without a handover") {
		t.Fatalf("reminded %+v", reminded)
	}
}

func backgrounding(t *testing.T, finish string) string {
	t.Helper()

	script := `#!/usr/bin/env node
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const frame = (message) => send({ jsonrpc: "2.0", method: "_claude/sdkMessage",
  params: { sessionId: "session_opened", message: { type: "system", ...message } } });
const state = (value) => frame({ subtype: "session_state_changed", state: value });
const tasks = (list) => frame({ subtype: "background_tasks_changed", tasks: list });
const say = (text) => send({ jsonrpc: "2.0", method: "session/update",
  params: { sessionId: "session_opened", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } } } });
const handOver = () => fetch(process.env.SPOTLIGHT_AGENT_API_URL, {
  method: "POST",
  headers: { Authorization: "Bearer " + process.env.SPOTLIGHT_AGENT_API_TOKEN },
  body: JSON.stringify({ next: "review", note: "tests passed" }),
});
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
    if (msg.method !== "session/prompt") continue;
    const prompt = msg.params.prompt.map((block) => block.text).join("");
    state("running");
    if (!prompt.includes("do the work")) {
      say("[" + prompt + "]");
      send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "end_turn" } });
      state("idle");
      continue;
    }
    tasks([{ task_id: "t1", task_type: "local_bash", description: "npx vitest run" },
           { task_id: "t2", task_type: "dream", description: "housekeeping", ambient: true }]);
    say("started the tests");
    send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "end_turn" } });
    state("idle");
    if ("` + finish + `" === "dies") setTimeout(() => process.exit(0), 100);
    if ("` + finish + `" === "wakes") {
      setTimeout(async () => {
        tasks([]);
        state("running");
        say("the tests passed");
        await handOver();
        state("idle");
      }, 300);
    }
  }
});
`

	dir := t.TempDir()
	if err := os.Chmod(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "harness")
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func backgroundOptions(o *runOptions) {
	o.briefing = "do the work"
	o.handover = []string{"code-review", "review"}
	o.wait = 3 * time.Second
	o.quiet = 100 * time.Millisecond
	o.heartbeat = 50 * time.Millisecond
}

func said(t *testing.T, written *journal) string {
	t.Helper()

	var all strings.Builder
	for _, event := range written.typed(protocol.EventOutput) {
		var update struct {
			Update struct {
				SessionUpdate string `json:"sessionUpdate"`
				Content       struct {
					Text string `json:"text"`
				} `json:"content"`
			} `json:"update"`
		}
		if json.Unmarshal(event.Data, &update) == nil && update.Update.SessionUpdate == "agent_message_chunk" {
			all.WriteString(update.Update.Content.Text + "|")
		}
	}
	return all.String()
}

func TestTheRunWaitsForBackgroundWorkThatWakesTheAgent(t *testing.T) {
	written := run(t, backgrounding(t, "wakes"), backgroundOptions)

	if got := said(t, written); got != "started the tests|the tests passed|" {
		t.Fatalf("the agent said %q", got)
	}
	if handover := written.done.Handover; handover == nil || handover.Note != "tests passed" {
		t.Fatalf("handover %+v", handover)
	}
	waiting := written.typed(protocol.EventBackgroundWait)
	if len(waiting) != 1 || !strings.Contains(string(waiting[0].Data), "npx vitest run") ||
		strings.Contains(string(waiting[0].Data), "housekeeping") {
		t.Errorf("waiting %+v", waiting)
	}
	if settled := written.typed(protocol.EventBackgroundDone); len(settled) != 1 {
		t.Errorf("settled %+v", settled)
	}
	if lost := written.typed(protocol.EventBackgroundLost); len(lost) != 0 {
		t.Errorf("lost %+v", lost)
	}
}

func TestBackgroundWorkStillRunningAtTheLimitIsNamedInTheReminder(t *testing.T) {
	written := run(t, backgrounding(t, "never"), func(o *runOptions) {
		backgroundOptions(o)
		o.wait = 300 * time.Millisecond
	})

	got := said(t, written)
	if !strings.Contains(got, "These background tasks still run: npx vitest run.") || strings.Contains(got, "housekeeping") {
		t.Fatalf("the agent said %q", got)
	}
	if written.done == nil || written.done.Handover != nil {
		t.Errorf("completion %+v", written.done)
	}
	if lost := written.typed(protocol.EventBackgroundLost); len(lost) != 1 {
		t.Errorf("lost %+v", lost)
	}
}

func TestTheNextRunHearsWhichBackgroundTasksStopped(t *testing.T) {
	sandbox := new(session.Sandbox)
	root := t.TempDir()

	run(t, backgrounding(t, "never"), func(o *runOptions) {
		backgroundOptions(o)
		o.wait = 200 * time.Millisecond
		o.sandbox, o.root = sandbox, root
	})
	written := run(t, backgrounding(t, "never"), func(o *runOptions) {
		o.briefing = "next station"
		o.sandbox, o.root = sandbox, root
	})

	if got := said(t, written); !strings.Contains(got, "These background tasks stopped when your last sandbox stopped: npx vitest run.") {
		t.Fatalf("the agent said %q", got)
	}
	third := run(t, backgrounding(t, "never"), func(o *runOptions) {
		o.briefing = "after that"
		o.sandbox, o.root = sandbox, root
	})
	if got := said(t, third); strings.Contains(got, "stopped when your last sandbox stopped") {
		t.Errorf("the note came twice: %q", got)
	}
}

func TestAPersonsMessageDuringTheWaitGoesToTheAgent(t *testing.T) {
	written := run(t, backgrounding(t, "never"), func(o *runOptions) {
		backgroundOptions(o)
		o.wait = time.Second
		o.messages = [][]protocol.Message{nil, nil, nil, {{Position: 1, Body: "stop waiting"}}}
	})

	got := said(t, written)
	if !strings.HasPrefix(got, "started the tests|[stop waiting]|[Your turn ended without a handover.") {
		t.Fatalf("the agent said %q", got)
	}
	if strings.Count(got, "without a handover") != 1 {
		t.Errorf("reminded more than once: %q", got)
	}
}

func TestTheProtocolOfTheHarnessIsJournalled(t *testing.T) {
	written := run(t, harness(t, `output = "worked";`, "end_turn"))

	connected := written.typed(protocol.EventHarnessConnected)
	if len(connected) != 1 || connected[0].Message != "acp/1" {
		t.Fatalf("connected %+v", connected)
	}
}

func TestAnAgentThatStopsDuringTheWaitFailsTheRunAtOnce(t *testing.T) {
	began := time.Now()
	written := run(t, backgrounding(t, "dies"), func(o *runOptions) {
		backgroundOptions(o)
		o.wait = time.Minute
	})

	if took := time.Since(began); took > 20*time.Second {
		t.Errorf("the run waited %s for an agent that had stopped", took)
	}
	if written.done == nil || !written.done.Failed {
		t.Fatalf("completion %+v", written.done)
	}
	settled := written.typed(protocol.EventBackgroundDone)
	if len(settled) != 1 || !strings.Contains(string(settled[0].Data), `"ended":"gone"`) {
		t.Errorf("settled %+v", settled)
	}
}
