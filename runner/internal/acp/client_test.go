package acp_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"usespotlight.ai/runner/internal/acp"
)

// pretend writes a harness that speaks just enough ACP to answer, so the
// client is tested against the protocol rather than against Claude Code.
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
	// Nothing else in the system has ever been able to say what a run cost.
	if result.Usage == nil || result.Usage.TotalTokens != 8 {
		t.Errorf("usage %+v", result.Usage)
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

// steering never finishes a turn on its own; it ends the one in flight only
// when it is told to cancel, the way a person steering a run cuts it short.
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

// A turn the agent would run for ever ends the moment it is cancelled, so a
// person can steer it without waiting for it to finish.
func TestCancelEndsTheTurnInFlight(t *testing.T) {
	client, _ := start(t, steering, nil)

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	done := make(chan acp.Result, 1)
	go func() {
		result, _ := client.Prompt(ctx, "session_1", "keep working", func(acp.Update) {})
		done <- result
	}()

	// Let the prompt reach the harness before cutting it short.
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

// An unanswered request is a stopped agent, so a station that runs unattended
// has to answer for itself.
func TestAnswersThePermissionTheAgentAsksFor(t *testing.T) {
	for _, expected := range []struct {
		allowed bool
		stopped string
	}{{true, "allowed"}, {false, "refused"}} {
		client, _ := start(t, asking, func(string) bool { return expected.allowed })

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

// The agent was given a workspace, not a machine.
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

// refusing answers session/load with a refusal, and says a missing session for
// one id only, so the two kinds of no can be told apart.
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

/*
A session the harness no longer holds is worth telling apart from every other
refusal: the first is answered by opening a new one, the second by giving up.
*/
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
