package v2_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
	v2 "usespotlight.ai/data-plane/runner/internal/acp/v2"
)

const scripted = `
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const update = (sessionUpdate, rest, sessionId = "session_1") =>
  send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update: { sessionUpdate, ...rest } } });
const state = (state, rest = {}) => update("state_update", { state, ...rest });
const plays = SCRIPT;
let buffered = "";
process.stdin.on("data", (chunk) => {
  buffered += chunk.toString();
  const lines = buffered.split("\n");
  buffered = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (plays[msg.method]) plays[msg.method](msg);
    else if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 2 } });
    else if (msg.method === "session/new") send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_1" } });
    else if (msg.id !== undefined && msg.method) send({ jsonrpc: "2.0", id: msg.id, result: {} });
    else if (plays.reply) plays.reply(msg);
  }
});
`

func harness(t *testing.T, script string) string {
	return pretend(t, strings.Replace(scripted, "SCRIPT", script, 1))
}

type watched struct {
	mu     sync.Mutex
	events []protocol.Event
}

func (w *watched) saw(event protocol.Event) {
	if event.Type == protocol.EventHarnessFrame {
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	w.events = append(w.events, event)
}

func (w *watched) of(kind protocol.EventType) []json.RawMessage {
	w.mu.Lock()
	defer w.mu.Unlock()
	var found []json.RawMessage
	for _, event := range w.events {
		if event.Type == kind {
			found = append(found, event.Data)
		}
	}
	return found
}

func started(t *testing.T, script string, answer acp.Permission) (*v2.Client, *watched) {
	t.Helper()

	client, err := v2.Start(context.Background(), acp.Options{
		Executable:  harness(t, script),
		Env:         map[string]string{"PATH": os.Getenv("PATH")},
		Root:        t.TempDir(),
		Answer:      answer,
		SettleQuiet: 50 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = client.Close() })

	seen := &watched{}
	client.Watch(seen.saw)

	if _, err := client.NewSession(context.Background()); err != nil {
		t.Fatal(err)
	}
	return client, seen
}

func within(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	return ctx
}

func TestAnOlderAnswerToTheHandshakeIsTheOlderProtocol(t *testing.T) {
	for name, initialize := range map[string]string{
		"answered with v1": `(m) => send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: 1 } })`,
		"refused":          `(m) => send({ jsonrpc: "2.0", id: m.id, error: { code: -32022, message: "Unsupported protocol version" } })`,
	} {
		t.Run(name, func(t *testing.T) {
			_, err := v2.Start(context.Background(), acp.Options{
				Executable: harness(t, `{ initialize: `+initialize+` }`),
				Env:        map[string]string{"PATH": os.Getenv("PATH")},
				Root:       t.TempDir(),
			})
			if !errors.Is(err, v2.ErrOlderProtocol) {
				t.Fatalf("started with %v, want the older protocol", err)
			}
		})
	}
}

func TestATurnEndsWhenTheSessionIsIdleAgain(t *testing.T) {
	client, seen := started(t, `{
		"session/prompt": (m) => {
			update("user_message", { messageId: "u1", content: [{ type: "text", text: "go" }] });
			send({ jsonrpc: "2.0", id: m.id, result: { messageId: "u1" } });
			state("running", { background: [] });
			update("agent_message_chunk", { messageId: "a1", content: { type: "text", text: "done" } });
			state("idle", { stopReason: "max_tokens", usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 }, background: [] });
		},
	}`, nil)

	result, err := client.Prompt(within(t), "go")
	if err != nil {
		t.Fatal(err)
	}
	if result.StopReason != "max_tokens" || result.Heard == 0 {
		t.Fatalf("the turn ended as %+v", result)
	}

	var ended protocol.TurnEnded
	_ = json.Unmarshal(seen.of(protocol.EventTurnEnded)[0], &ended)
	if ended.Stop != protocol.TurnStopCutShort || ended.Usage == nil || *ended.Usage.Output != 5 {
		t.Fatalf("journaled the end as %+v", ended)
	}
}

func TestAPromptSentDuringASelfStartedTurnEndsWithThatTurn(t *testing.T) {
	client, seen := started(t, `{
		"session/prompt": (m) => {
			update("user_message", { messageId: "u1", content: [{ type: "text", text: "go" }] });
			send({ jsonrpc: "2.0", id: m.id, result: { messageId: "u1" } });
			state("idle", { stopReason: "end_turn", background: [] });
		},
		"session/new": (m) => {
			send({ jsonrpc: "2.0", id: m.id, result: { sessionId: "session_1" } });
			setTimeout(() => state("running", { background: [] }), 50);
		},
	}`, nil)

	waitFor(t, func() bool { return len(seen.of(protocol.EventTurnStarted)) == 1 })

	if _, err := client.Prompt(within(t), "go"); err != nil {
		t.Fatal(err)
	}

	var turn protocol.TurnStarted
	_ = json.Unmarshal(seen.of(protocol.EventTurnStarted)[0], &turn)
	if turn.Origin != protocol.TurnFromSelf {
		t.Fatalf("the first turn started as %+v", turn)
	}
}

func TestSettlesOnlyWhenTheBackgroundWorkIsDone(t *testing.T) {
	client, seen := started(t, `{
		"session/prompt": (m) => {
			update("user_message", { messageId: "u1", content: [] });
			send({ jsonrpc: "2.0", id: m.id, result: { messageId: "u1" } });
			state("running", { background: [] });
			update("terminal_update", { terminalId: "t1", command: "npm test" });
			state("idle", { stopReason: "end_turn", background: [{ type: "terminal", terminalId: "t1" }] });
			setTimeout(() => {
				state("idle", { background: [] });
				state("running", { background: [] });
				update("agent_message_chunk", { messageId: "a2", content: { type: "text", text: "tests pass" } });
				state("idle", { stopReason: "end_turn", background: [] });
			}, 300);
		},
	}`, nil)

	ctx := within(t)
	if _, err := client.Prompt(ctx, "go"); err != nil {
		t.Fatal(err)
	}
	if still := client.Current().Background; len(still) != 1 || still[0].Description != "npm test" || still[0].Kind != protocol.BackgroundCommand {
		t.Fatalf("background after the turn: %+v", still)
	}

	work, settled := client.Settle(ctx)
	if !settled || len(work.Background) != 0 {
		t.Fatalf("settled %v with %+v", settled, work)
	}

	var turns []protocol.TurnStarted
	for _, raw := range seen.of(protocol.EventTurnStarted) {
		var turn protocol.TurnStarted
		_ = json.Unmarshal(raw, &turn)
		turns = append(turns, turn)
	}
	if len(turns) != 2 || turns[1].Origin != protocol.TurnFromSelf || turns[1].Turn != 2 {
		t.Fatalf("turns started: %+v", turns)
	}
}

func TestAsksAboutTheToolCallThePermissionNames(t *testing.T) {
	asked := make(chan acp.Asked, 1)
	client, _ := started(t, `{
		"session/prompt": (m) => {
			update("user_message", { messageId: "u1", content: [] });
			send({ jsonrpc: "2.0", id: m.id, result: { messageId: "u1" } });
			state("running", { background: [] });
			update("tool_call_update", { toolCallId: "c1", name: "Bash", kind: "execute", rawInput: {} });
			send({ jsonrpc: "2.0", id: 0, method: "session/request_permission", params: {
				sessionId: "session_1", title: "Run it?",
				subject: { type: "tool_call", toolCall: { toolCallId: "c1", title: "rm -rf build", rawInput: { command: "rm -rf build" } } },
				options: [{ optionId: "yes", name: "Yes", kind: "allow_once" }, { optionId: "no", name: "No", kind: "reject_once" }],
			} });
		},
		reply: (m) => {
			if (m.id === 0) state("idle", { stopReason: m.result.outcome.optionId === "yes" ? "end_turn" : "refusal", background: [] });
		},
	}`, func(_ context.Context, question acp.Asked) acp.Verdict {
		asked <- question
		return acp.Allow
	})

	result, err := client.Prompt(within(t), "go")
	if err != nil {
		t.Fatal(err)
	}

	question := <-asked
	if question.ToolCallID != "c1" || question.Kind != "execute" || question.Title != "rm -rf build" ||
		string(question.Input) != `{"command":"rm -rf build"}` {
		t.Fatalf("asked %+v", question)
	}
	if result.StopReason != "end_turn" {
		t.Fatalf("the harness read the answer as %q", result.StopReason)
	}
}

func TestStopsAskingWhenTheHarnessCancelsTheRequest(t *testing.T) {
	cancelled := make(chan struct{})
	client, _ := started(t, `{
		"session/prompt": (m) => {
			update("user_message", { messageId: "u1", content: [] });
			send({ jsonrpc: "2.0", id: m.id, result: { messageId: "u1" } });
			state("running", { background: [] });
			send({ jsonrpc: "2.0", id: 7, method: "session/request_permission", params: {
				sessionId: "session_1", title: "Run it?", options: [{ optionId: "no", name: "No", kind: "reject_once" }],
			} });
			setTimeout(() => {
				send({ jsonrpc: "2.0", method: "$/cancel_request", params: { requestId: 7 } });
				setTimeout(() => state("idle", { stopReason: "end_turn", background: [] }), 100);
			}, 50);
		},
		reply: (m) => { if (m.id === 7) state("idle", { stopReason: "refusal", background: [] }); },
	}`, func(ctx context.Context, _ acp.Asked) acp.Verdict {
		<-ctx.Done()
		close(cancelled)
		return acp.Reject
	})

	result, err := client.Prompt(within(t), "go")
	if err != nil {
		t.Fatal(err)
	}
	<-cancelled
	if result.StopReason != "end_turn" {
		t.Fatalf("the cancelled request was answered: %q", result.StopReason)
	}
}

func TestResumingAMissingSessionSaysItIsNotFound(t *testing.T) {
	client, _ := started(t, `{
		"session/resume": (m) => send({ jsonrpc: "2.0", id: m.id, error: { code: -32002, message: "Resource not found" } }),
	}`, nil)

	if err := client.Resume(within(t), "gone"); !acp.IsSessionNotFound(err) {
		t.Fatalf("resumed with %v", err)
	}
}

func waitFor(t *testing.T, done func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !done() {
		if time.Now().After(deadline) {
			t.Fatal("timed out")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestSettlingStopsAtTheDeadline(t *testing.T) {
	client, _ := started(t, `{
		"session/prompt": (m) => {
			update("user_message", { messageId: "u1", content: [] });
			send({ jsonrpc: "2.0", id: m.id, result: { messageId: "u1" } });
			state("running", { background: [] });
			update("terminal_update", { terminalId: "t1", command: "npm test" });
			state("idle", { stopReason: "end_turn", background: [{ type: "terminal", terminalId: "t1" }] });
		},
	}`, nil)

	ctx := within(t)
	if _, err := client.Prompt(ctx, "go"); err != nil {
		t.Fatal(err)
	}

	short, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
	defer cancel()
	work, settled := client.Settle(short)
	if settled || len(work.Background) != 1 {
		t.Fatalf("settled=%v %+v", settled, work)
	}
}
