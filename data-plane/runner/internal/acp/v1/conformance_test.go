package v1_test

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
	v1 "usespotlight.ai/data-plane/runner/internal/acp/v1"
)

var update = flag.Bool("update", false, "write the expected events of each recording")

const replaying = `
const fs = require("node:fs");
const frames = fs.readFileSync(process.env.FRAMES, "utf8").split("\n").filter(Boolean);
const send = (line) => process.stdout.write(line + "\n");
let buffered = "";
process.stdin.on("data", (chunk) => {
  buffered += chunk.toString();
  const lines = buffered.split("\n");
  buffered = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1 } }));
    if (msg.method === "session/new") send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "session_1" } }));
    if (msg.method === "session/prompt") {
      for (const frame of frames) send(frame.replace('"id":"PROMPT"', '"id":' + msg.id));
    }
  }
});
`

type journalled struct {
	Type protocol.EventType `json:"type"`
	Data json.RawMessage    `json:"data"`
}

func TestEveryRecordingReadsAsItsExpectedEvents(t *testing.T) {
	recordings, err := filepath.Glob(filepath.Join("..", "testdata", "*", "acp-1", "*.frames.jsonl"))
	if err != nil || len(recordings) == 0 {
		t.Fatalf("no recordings: %v", err)
	}

	for _, recording := range recordings {
		name := strings.TrimSuffix(recording, ".frames.jsonl")
		t.Run(name, func(t *testing.T) {
			got := played(t, recording)
			expected := name + ".events.jsonl"

			if *update {
				if err := os.WriteFile(expected, got, 0o644); err != nil {
					t.Fatal(err)
				}
				return
			}

			want, err := os.ReadFile(expected)
			if err != nil {
				t.Fatalf("no expected events, run with -update: %v", err)
			}
			if !sameEvents(t, got, want) {
				t.Errorf("read as\n%s\nwanted\n%s", got, want)
			}
		})
	}
}

func played(t *testing.T, recording string) []byte {
	t.Helper()

	frames, err := filepath.Abs(recording)
	if err != nil {
		t.Fatal(err)
	}

	client, err := v1.Start(context.Background(), acp.Options{
		Executable:  pretend(t, replaying),
		Env:         map[string]string{"FRAMES": frames, "PATH": os.Getenv("PATH")},
		Root:        t.TempDir(),
		SettleQuiet: 50 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = client.Close() })

	ctx, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()

	_, err = client.NewSession(ctx)
	if err != nil {
		t.Fatal(err)
	}

	var mu sync.Mutex
	var out bytes.Buffer
	client.Watch(func(event protocol.Event) {
		if event.Type == protocol.EventHarnessFrame {
			return
		}
		line, _ := json.Marshal(journalled{Type: event.Type, Data: event.Data})
		mu.Lock()
		defer mu.Unlock()
		out.Write(append(line, '\n'))
	})

	if _, err := client.Prompt(ctx, "go"); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if _, settled := client.Settle(ctx); !settled {
		t.Fatal("the recording never settled")
	}

	mu.Lock()
	defer mu.Unlock()
	return bytes.Clone(out.Bytes())
}

func sameEvents(t *testing.T, got, want []byte) bool {
	t.Helper()
	return reflect.DeepEqual(decodedLines(t, got), decodedLines(t, want))
}

func decodedLines(t *testing.T, lines []byte) []any {
	t.Helper()

	var decoded []any
	for _, line := range bytes.Split(bytes.TrimSpace(lines), []byte("\n")) {
		var value any
		if err := json.Unmarshal(line, &value); err != nil {
			t.Fatalf("%s: %v", line, err)
		}
		decoded = append(decoded, value)
	}
	return decoded
}
