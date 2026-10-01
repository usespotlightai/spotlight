package acp_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"usespotlight.ai/data-plane/runner/internal/acp"
)

func pretend(t *testing.T, script string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "harness")
	if err := os.WriteFile(path, []byte("#!/usr/bin/env node\n"+script), 0o755); err != nil {
		t.Fatal(err)
	}

	return path
}

const answering = `
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

func start(t *testing.T, script string, answer acp.Permission) (*acp.Client, string) {
	t.Helper()

	root := t.TempDir()
	client, err := acp.Start(context.Background(), acp.Options{
		Executable: pretend(t, script),
		Root:       root,
		Answer:     answer,
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = client.Close() })

	return client, root
}

func TestOpensASessionAndReportsWhatWasSaid(t *testing.T) {
	client, _ := start(t, answering, nil)

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	sessionID, err := client.NewSession(ctx)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	if sessionID != "session_1" {
		t.Fatalf("got %q", sessionID)
	}

	var said string
	result, err := client.Prompt(ctx, sessionID, "do the thing", func(update acp.Update) {
		said += update.Text
	})
	if err != nil {
		t.Fatalf("prompt: %v", err)
	}

	if said != "half done" {
		t.Errorf("heard %q", said)
	}
	if result.StopReason != "end_turn" {
		t.Errorf("stopped for %q", result.StopReason)
	}
	if !result.Used() || string(result.Usage) != `{"inputTokens":3,"outputTokens":5,"totalTokens":8}` {
		t.Errorf("the turn's usage came back as %s", result.Usage)
	}
}

const asking = `
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

const reaching = `
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
      send({ jsonrpc: "2.0", id: promptId, result: { stopReason: "refused" } });
    }
    if (msg.id === 902) send({ jsonrpc: "2.0", id: promptId, result: { stopReason: "end_turn" } });
  }
});
`

const reachingOut = `
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
      send({ jsonrpc: "2.0", id: promptId, result: { stopReason: msg.error ? "refused" : "leaked" } });
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

	done := make(chan acp.Result, 1)
	go func() {
		result, _ := client.Prompt(ctx, "session_1", "keep working", func(acp.Update) {})
		done <- result
	}()

	time.Sleep(200 * time.Millisecond)
	if err := client.Cancel("session_1"); err != nil {
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

func TestAnswersThePermissionTheAgentAsksFor(t *testing.T) {
	for _, expected := range []struct {
		allowed bool
		stopped string
	}{{true, "allowed"}, {false, "refused"}} {
		client, _ := start(t, asking, func(context.Context, acp.Asked) acp.Verdict {
			if expected.allowed {
				return acp.Allow
			}
			return acp.Reject
		})

		ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
		result, err := client.Prompt(ctx, "session_1", "do it", func(acp.Update) {})
		stop()

		if err != nil {
			t.Fatalf("allowed=%v: %v", expected.allowed, err)
		}
		if result.StopReason != expected.stopped {
			t.Errorf("allowed=%v: the agent was told %q", expected.allowed, result.StopReason)
		}
	}
}

func TestReadsAndWritesWithinTheWorkspace(t *testing.T) {
	client, root := start(t, reaching, nil)
	if err := os.WriteFile(filepath.Join(root, "hello.txt"), []byte("in the workspace"), 0o644); err != nil {
		t.Fatal(err)
	}

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	if _, err := client.Prompt(ctx, "session_1", "read it", func(acp.Update) {}); err != nil {
		t.Fatalf("prompt: %v", err)
	}

	echoed, err := os.ReadFile(filepath.Join(root, "echo.txt"))
	if err != nil || string(echoed) != "IN THE WORKSPACE" {
		t.Fatalf("got %q, %v", echoed, err)
	}
}

func TestRefusesAPathOutsideTheWorkspace(t *testing.T) {
	client, root := start(t, reachingOut, nil)
	if err := os.WriteFile(filepath.Join(filepath.Dir(root), "outside.txt"), []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	result, err := client.Prompt(ctx, "session_1", "reach out", func(acp.Update) {})
	if err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if result.StopReason != "refused" {
		t.Errorf("the agent got outside the workspace: %q", result.StopReason)
	}
}

const refusing = `
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

func TestForgottenTellsAMissingSessionFromAnyOtherRefusal(t *testing.T) {
	client, _ := start(t, refusing, nil)

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	missing := client.Resume(ctx, "gone")
	if missing == nil || !acp.Forgotten(missing) {
		t.Errorf("a missing session did not read as forgotten: %v", missing)
	}

	other := client.Resume(ctx, "held")
	if other == nil || acp.Forgotten(other) {
		t.Errorf("an unrelated refusal read as forgotten: %v", other)
	}
}

const permitting = `
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
let buffered = "", promptId = null, cancelled = "untold";
process.stdin.on("data", (chunk) => {
  buffered += chunk.toString();
  const lines = buffered.split("\n");
  buffered = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1 } });
    if (msg.method === "session/cancel") cancelled = "told " + msg.params.sessionId;
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
		told    string
	}{
		{acp.Allow, "once"},
		{acp.Reject, "not now"},
		{acp.Cancel, "cancelled, told session_1"},
	} {
		var asked acp.Asked
		client, _ := start(t, permitting, func(_ context.Context, seen acp.Asked) acp.Verdict {
			asked = seen
			return expected.verdict
		})

		ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
		result, err := client.Prompt(ctx, "session_1", "clean up", func(acp.Update) {})
		stop()

		if err != nil {
			t.Fatalf("verdict %v: %v", expected.verdict, err)
		}
		if result.StopReason != expected.told {
			t.Errorf("verdict %v: the agent was told %q, wanted %q", expected.verdict, result.StopReason, expected.told)
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

	result, err := client.Prompt(ctx, "session_1", "clean up", func(acp.Update) {})
	if err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if result.StopReason != "not now" {
		t.Errorf("the agent was told %q", result.StopReason)
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

			client, err := acp.Start(context.Background(), options)
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

			var heard string
			if _, err := client.Prompt(ctx, "session_1", "go", func(update acp.Update) { heard += update.Text }); err != nil {
				t.Fatalf("%s, resuming=%v: prompt: %v", expected.name, resuming, err)
			}
			stop()
			_ = client.Close()

			var got, want any
			if err := json.Unmarshal([]byte(heard), &got); err != nil {
				t.Fatalf("%s, resuming=%v: heard %q: %v", expected.name, resuming, heard, err)
			}
			_ = json.Unmarshal([]byte(expected.opened), &want)
			if !reflect.DeepEqual(got, want) {
				t.Errorf("%s, resuming=%v: opened with %s, wanted %s", expected.name, resuming, heard, expected.opened)
			}
		}
	}
}
