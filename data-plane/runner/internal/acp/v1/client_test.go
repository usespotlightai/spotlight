package v1_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
	v1 "usespotlight.ai/data-plane/runner/internal/acp/v1"
)

func said(event protocol.Event) string {
	if event.Type != protocol.EventMessage {
		return ""
	}
	var message protocol.AgentMessage
	_ = json.Unmarshal(event.Data, &message)
	return message.Text
}

func pretend(t *testing.T, script string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "harness")
	if err := os.WriteFile(path, []byte("#!/usr/bin/env node\n"+script), 0o755); err != nil {
		t.Fatal(err)
	}

	return path
}

const responsiveHarness = `
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
    if (msg.method === "session/new") send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_1" } });
    if (msg.method === "session/prompt") {
      send({ jsonrpc: "2.0", method: "session/update",
             params: { update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "half" } } } });
      send({ jsonrpc: "2.0", method: "session/update",
             params: { update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: " done" } } } });
      send({ jsonrpc: "2.0", id: msg.id,
             result: { stopReason: "end_turn", usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 } } });
    }
  }
});
`

func start(t *testing.T, script string, answer acp.Permission) (*v1.Client, string) {
	t.Helper()

	root := t.TempDir()
	client, err := v1.Start(context.Background(), acp.Options{
		Executable: pretend(t, script),
		Root:       root,
		Answer:     answer,
		Frames:     true,
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = client.Close() })

	return client, root
}

func TestOpensASessionAndReportsTheAgentsOutput(t *testing.T) {
	client, _ := start(t, responsiveHarness, nil)

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	sessionID, err := client.NewSession(ctx)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	if sessionID != "session_1" {
		t.Fatalf("got %q", sessionID)
	}

	var output string
	var ended protocol.TurnEnded
	client.Watch(func(event protocol.Event) {
		output += said(event)
		if event.Type == protocol.EventTurnEnded {
			_ = json.Unmarshal(event.Data, &ended)
		}
	})
	result, err := client.Prompt(ctx, "do the thing")
	if err != nil {
		t.Fatalf("prompt: %v", err)
	}

	if output != "half done" {
		t.Errorf("output %q", output)
	}
	if result.StopReason != "end_turn" || result.Heard != 2 {
		t.Errorf("stopped for %q after %d updates", result.StopReason, result.Heard)
	}
	if ended.Turn != 1 || ended.Stop != protocol.TurnStopEnded || ended.Usage == nil || *ended.Usage.Input != 3 || *ended.Usage.Output != 5 {
		t.Errorf("the turn ended as %+v", ended)
	}
}

const permissionRequest = `
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
    if (msg.method === "session/prompt") {
      promptId = msg.id;
      send({ jsonrpc: "2.0", id: 900, method: "session/request_permission",
             params: { options: [{ optionId: "yes", kind: "allow_once" }, { optionId: "no", kind: "reject_once" }] } });
    }
    if (msg.id === 900) {
      send({ jsonrpc: "2.0", id: promptId,
             result: { stopReason: msg.result.outcome.optionId === "yes" ? "allowed" : "refused" } });
    }
  }
});
`

const fileAccess = `
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
    if (msg.method === "session/prompt") {
      promptId = msg.id;
      send({ jsonrpc: "2.0", id: 901, method: "fs/read_text_file", params: { path: "hello.txt" } });
    }
    if (msg.id === 901 && msg.result) {
      send({ jsonrpc: "2.0", id: 902, method: "fs/write_text_file",
             params: { path: "echo.txt", content: msg.result.content.toUpperCase() } });
    }
    if (msg.id === 901 && msg.error) {
      send({ jsonrpc: "2.0", id: promptId, result: { stopReason: "rejected" } });
    }
    if (msg.id === 902) send({ jsonrpc: "2.0", id: promptId, result: { stopReason: "end_turn" } });
  }
});
`

const fileAccessOutside = `
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
    if (msg.method === "session/prompt") {
      promptId = msg.id;
      send({ jsonrpc: "2.0", id: 903, method: "fs/read_text_file", params: { path: "../outside.txt" } });
    }
    if (msg.id === 903) {
      send({ jsonrpc: "2.0", id: promptId, result: { stopReason: msg.error ? "rejected" : "leaked" } });
    }
  }
});
`

const steering = `
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
    if (msg.method === "session/prompt") { promptId = msg.id; }
    if (msg.method === "session/cancel") {
      send({ jsonrpc: "2.0", id: promptId, result: { stopReason: "cancelled" } });
    }
  }
});
`

func TestCancelEndsTheTurnInFlight(t *testing.T) {
	client, _ := start(t, steering, nil)

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	done := make(chan v1.Result, 1)
	go func() {
		result, _ := client.Prompt(ctx, "keep working")
		done <- result
	}()

	time.Sleep(200 * time.Millisecond)
	if err := client.Cancel(); err != nil {
		t.Fatalf("cancel: %v", err)
	}

	select {
	case result := <-done:
		if result.StopReason != "cancelled" {
			t.Errorf("the turn stopped for %q, not a cancellation", result.StopReason)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the turn did not end after it was cancelled")
	}
}

func TestAnswersThePermissionTheAgentRequests(t *testing.T) {
	for _, expected := range []struct {
		allowed bool
		stopped string
	}{{true, "allowed"}, {false, "refused"}} {
		client, _ := start(t, permissionRequest, func(context.Context, acp.Asked) acp.Verdict {
			if expected.allowed {
				return acp.Allow
			}
			return acp.Reject
		})

		ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
		result, err := client.Prompt(ctx, "do it")
		stop()

		if err != nil {
			t.Fatalf("allowed=%v: %v", expected.allowed, err)
		}
		if result.StopReason != expected.stopped {
			t.Errorf("allowed=%v: the agent got %q", expected.allowed, result.StopReason)
		}
	}
}

func TestReadsAndWritesWithinTheWorkspace(t *testing.T) {
	client, root := start(t, fileAccess, nil)
	if err := os.WriteFile(filepath.Join(root, "hello.txt"), []byte("in the workspace"), 0o644); err != nil {
		t.Fatal(err)
	}

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	if _, err := client.Prompt(ctx, "read it"); err != nil {
		t.Fatalf("prompt: %v", err)
	}

	echoed, err := os.ReadFile(filepath.Join(root, "echo.txt"))
	if err != nil || string(echoed) != "IN THE WORKSPACE" {
		t.Fatalf("got %q, %v", echoed, err)
	}
}

func TestRejectsAPathOutsideTheWorkspace(t *testing.T) {
	client, root := start(t, fileAccessOutside, nil)
	if err := os.WriteFile(filepath.Join(filepath.Dir(root), "outside.txt"), []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	result, err := client.Prompt(ctx, "read outside")
	if err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if result.StopReason != "rejected" {
		t.Errorf("the agent got outside the workspace: %q", result.StopReason)
	}
}

const failingLoads = `
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
    if (msg.method === "session/load") {
      const code = msg.params.sessionId === "gone" ? -32002 : -32000;
      send({ jsonrpc: "2.0", id: msg.id, error: { code, message: "no" } });
    }
  }
});
`

func TestIsSessionNotFoundTellsAMissingSessionFromAnyOtherError(t *testing.T) {
	client, _ := start(t, failingLoads, nil)

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	missing := client.Resume(ctx, "gone")
	if missing == nil || !acp.IsSessionNotFound(missing) {
		t.Errorf("a missing session did not read as not found: %v", missing)
	}

	other := client.Resume(ctx, "other")
	if other == nil || acp.IsSessionNotFound(other) {
		t.Errorf("an unrelated error read as a missing session: %v", other)
	}
}

const permitting = `
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
let buffered = "", promptId = null, cancelled = "not cancelled";
process.stdin.on("data", (chunk) => {
  buffered += chunk.toString();
  const lines = buffered.split("\n");
  buffered = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1 } });
    if (msg.method === "session/new") send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_1" } });
    if (msg.method === "session/cancel") cancelled = "cancel sent to " + msg.params.sessionId;
    if (msg.method === "session/prompt") {
      promptId = msg.id;
      send({ jsonrpc: "2.0", id: 900, method: "session/request_permission",
             params: { sessionId: msg.params.sessionId,
                       toolCall: { toolCallId: "toolu_1", kind: "execute", title: "rm -rf build",
                                   rawInput: { command: "rm -rf build" } },
                       options: [{ optionId: "always", kind: "allow_always" },
                                 { optionId: "once", kind: "allow_once" },
                                 { optionId: "never", kind: "reject_always" },
                                 { optionId: "not now", kind: "reject_once" }] } });
    }
    if (msg.id === 900) {
      const outcome = msg.result.outcome;
      send({ jsonrpc: "2.0", id: promptId,
             result: { stopReason: outcome.outcome === "selected" ? outcome.optionId : outcome.outcome + ", " + cancelled } });
    }
  }
});
`

func TestAPermissionIsAnsweredOnceNotForever(t *testing.T) {
	for _, expected := range []struct {
		verdict acp.Verdict
		answer  string
	}{
		{acp.Allow, "once"},
		{acp.Reject, "not now"},
		{acp.Cancel, "cancelled, cancel sent to session_1"},
	} {
		var asked acp.Asked
		client, _ := start(t, permitting, func(_ context.Context, seen acp.Asked) acp.Verdict {
			asked = seen
			return expected.verdict
		})

		ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
		if _, err := client.NewSession(ctx); err != nil {
			t.Fatal(err)
		}
		result, err := client.Prompt(ctx, "clean up")
		stop()

		if err != nil {
			t.Fatalf("verdict %v: %v", expected.verdict, err)
		}
		if result.StopReason != expected.answer {
			t.Errorf("verdict %v: the agent got %q, wanted %q", expected.verdict, result.StopReason, expected.answer)
		}
		if asked.SessionID != "session_1" || asked.ToolCallID != "toolu_1" ||
			asked.Kind != "execute" || asked.Title != "rm -rf build" ||
			string(asked.Input) != `{"command":"rm -rf build"}` {
			t.Errorf("verdict %v: asked %+v", expected.verdict, asked)
		}
	}
}

func TestAPermissionIsRefusedWhenNobodyAnswers(t *testing.T) {
	client, _ := start(t, permitting, nil)

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	result, err := client.Prompt(ctx, "clean up")
	if err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if result.StopReason != "not now" {
		t.Errorf("the agent got %q", result.StopReason)
	}
}

const opening = `
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
let buffered = "", opened = null;
process.stdin.on("data", (chunk) => {
  buffered += chunk.toString();
  const lines = buffered.split("\n");
  buffered = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1 } });
    if (msg.method === "session/new" || msg.method === "session/load") {
      opened = JSON.stringify({ meta: msg.params._meta, servers: msg.params.mcpServers });
      send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_1" } });
    }
    if (msg.method === "session/prompt") {
      send({ jsonrpc: "2.0", method: "session/update",
             params: { update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: opened } } } });
      send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "end_turn" } });
    }
  }
});
`

func TestASessionOpensWithWhatTheHarnessIsSetUpWith(t *testing.T) {
	setUp := acp.Options{
		Session: json.RawMessage(`{"claudeCode":{"options":{"managedSettings":{"permissions":{"deny":["Bash(rm *)"]}}}}}`),
		McpServers: []acp.McpServer{
			{Name: "linear", Command: "npx", Args: []string{"-y", "linear-mcp"},
				Env: []acp.EnvVariable{{Name: "LINEAR_TEAM", Value: "core"}}},
			{Name: "bare", Command: "bare-mcp"},
		},
	}
	setUpWith := `{"meta":{"claudeCode":{"options":{"managedSettings":{"permissions":{"deny":["Bash(rm *)"]}}}}},` +
		`"servers":[{"name":"linear","command":"npx","args":["-y","linear-mcp"],"env":[{"name":"LINEAR_TEAM","value":"core"}]},` +
		`{"name":"bare","command":"bare-mcp","args":[],"env":[]}]}`

	for _, expected := range []struct {
		name   string
		setUp  acp.Options
		opened string
	}{
		{"set up", setUp, setUpWith},
		{"not set up", acp.Options{}, `{"servers":[]}`},
	} {
		for _, resuming := range []bool{false, true} {
			options := expected.setUp
			options.Executable = pretend(t, opening)
			options.Root = t.TempDir()

			client, err := v1.Start(context.Background(), options)
			if err != nil {
				t.Fatalf("start: %v", err)
			}

			ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
			if resuming {
				err = client.Resume(ctx, "session_1")
			} else {
				_, err = client.NewSession(ctx)
			}
			if err != nil {
				t.Fatalf("%s, resuming=%v: %v", expected.name, resuming, err)
			}

			var output string
			client.Watch(func(event protocol.Event) { output += said(event) })
			if _, err := client.Prompt(ctx, "go"); err != nil {
				t.Fatalf("%s, resuming=%v: prompt: %v", expected.name, resuming, err)
			}
			stop()
			_ = client.Close()

			var got, want any
			if err := json.Unmarshal([]byte(output), &got); err != nil {
				t.Fatalf("%s, resuming=%v: output %q: %v", expected.name, resuming, output, err)
			}
			_ = json.Unmarshal([]byte(expected.opened), &want)
			if !reflect.DeepEqual(got, want) {
				t.Errorf("%s, resuming=%v: opened with %s, wanted %s", expected.name, resuming, output, expected.opened)
			}
		}
	}
}

const configurableHarness = `
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
    if (msg.method === "session/new") send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_1" } });
    if (msg.method === "session/set_config_option") {
      const p = msg.params;
      if (p.sessionId !== "session_1" || p.configId !== "effort") {
        send({ jsonrpc: "2.0", id: msg.id, error: { code: -32602, message: "Unknown config option: " + p.configId } });
      } else {
        send({ jsonrpc: "2.0", id: msg.id, result: { configOptions: [{ id: "effort", currentValue: p.value }] } });
      }
    }
  }
});
`

func TestSetsASessionConfigOption(t *testing.T) {
	client, _ := start(t, configurableHarness, nil)

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	_, err := client.NewSession(ctx)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	if err := client.SetConfigOption(ctx, "effort", "high"); err != nil {
		t.Fatalf("set effort: %v", err)
	}
	if err := client.SetConfigOption(ctx, "colour", "blue"); err == nil {
		t.Fatal("an option the harness refuses did not fail")
	}
}

const wakingHarness = `
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const say = (text) => send({ jsonrpc: "2.0", method: "session/update",
  params: { sessionId: "session_1", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } } } });
let buffered = "";
process.stdin.on("data", (chunk) => {
  buffered += chunk.toString();
  const lines = buffered.split("\n");
  buffered = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1 } });
    if (msg.method === "session/load") { say("from before"); send({ jsonrpc: "2.0", id: msg.id, result: {} }); }
    if (msg.method === "session/prompt") {
      send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "end_turn" } });
      setTimeout(() => say("woke up"), 100);
    }
  }
});
`

func TestUpdatesOutsideATurnReachTheWatcherButNotTheReplay(t *testing.T) {
	client, err := v1.Start(context.Background(), acp.Options{
		Executable: pretend(t, wakingHarness),
		Root:       t.TempDir(),
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Close() })

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	heard := make(chan string, 4)
	client.Watch(func(event protocol.Event) {
		if text := said(event); text != "" {
			heard <- text
		}
	})

	if err := client.Resume(ctx, "session_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := client.Prompt(ctx, "go"); err != nil {
		t.Fatal(err)
	}

	select {
	case text := <-heard:
		if text != "woke up" {
			t.Errorf("the watcher heard %q first", text)
		}
	case <-ctx.Done():
		t.Fatal("the watcher heard nothing after the turn")
	}
}

func TestAV1HarnessSettlesAtOnce(t *testing.T) {
	client, _ := start(t, responsiveHarness, nil)

	work, settled := client.Settle(context.Background())
	if !settled || work.Seen {
		t.Fatalf("settled=%v %+v", settled, work)
	}
}

const tellingWhoIsSignedIn = `
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
    if (msg.method === "session/new") send({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_1" } });
    if (msg.method === "session/prompt") {
      send({ jsonrpc: "2.0", method: "_auth/status_update", params: { authStatus: { account: { email: "someone@example.com" } } } });
      send({ jsonrpc: "2.0", method: "session/update",
             params: { sessionId: "session_1", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } } } });
      send({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "end_turn" } });
    }
  }
});
`

func TestKeepsOnlyTheFramesOfTheSession(t *testing.T) {
	client, _ := start(t, tellingWhoIsSignedIn, nil)

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	_, err := client.NewSession(ctx)
	if err != nil {
		t.Fatal(err)
	}

	var frames []string
	client.Watch(func(event protocol.Event) {
		if event.Type == protocol.EventHarnessFrame {
			frames = append(frames, string(event.Data))
		}
	})
	if _, err := client.Prompt(ctx, "go"); err != nil {
		t.Fatal(err)
	}

	if len(frames) != 2 {
		t.Fatalf("kept %d frames: %q", len(frames), frames)
	}
	for _, frame := range frames {
		if strings.Contains(frame, "someone@example.com") {
			t.Errorf("kept who is signed in: %s", frame)
		}
	}
}
