package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func tracing(t *testing.T, trace protocol.Trace) {
	t.Helper()

	server, err := serveHandover([]string{"spec"}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	server.Traces(func(_ context.Context, _ string) (json.RawMessage, error) {
		return json.Marshal(trace)
	})

	t.Setenv(protocol.HandoverURLVar, server.URL())
	t.Setenv(protocol.HandoverTokenVar, server.Token())
}

func sampleTrace() protocol.Trace {
	tool, given, returned := "read", "path: main.go", "package main"

	return protocol.Trace{
		Ms: 1500, Rows: 2, Faults: 1,
		Roots: []protocol.TraceNode{{
			ID: "run:1", Kind: "run", Name: "Run", Ms: 1500, Tone: "agent",
			Children: []protocol.TraceNode{{
				ID: "1:step:0", Kind: "step", Name: "Read main.go",
				Ms: 20, Tone: "failed",
				Step: &protocol.TraceStep{
					Kind: "tool", Text: "Read main.go",
					Tool: &tool, Given: &given, Returned: &returned,
				},
			}},
		}},
	}
}

func TestTraceWritesTheWholeTraceToAFile(t *testing.T) {
	tracing(t, sampleTrace())
	path := filepath.Join(t.TempDir(), "trace.json")
	out := new(bytes.Buffer)

	err := run(
		[]string{"trace", "--task", "task_1", "--out", path},
		strings.NewReader(""), out,
	)
	if err != nil {
		t.Fatalf("run: %v", err)
	}

	got := out.String()
	for _, want := range []string{path, "2 nodes", "1 faults"} {
		if !strings.Contains(got, want) {
			t.Fatalf("receipt missing %q in %q", want, got)
		}
	}
	if strings.Contains(got, "package main") {
		t.Fatalf("the receipt leaked trace detail: %q", got)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read the file: %v", err)
	}
	for _, want := range []string{"1:step:0", "path: main.go", "package main"} {
		if !strings.Contains(string(data), want) {
			t.Fatalf("file missing %q", want)
		}
	}
}

func TestTraceDefaultsToATempFile(t *testing.T) {
	tracing(t, sampleTrace())
	out := new(bytes.Buffer)

	if err := run(
		[]string{"trace", "--task", "task_1"}, strings.NewReader(""), out,
	); err != nil {
		t.Fatalf("run: %v", err)
	}

	field := strings.Fields(out.String())
	var path string
	for _, word := range field {
		if strings.HasSuffix(word, ".json") {
			path = word
		}
	}
	if path == "" {
		t.Fatalf("no file path on the receipt: %q", out)
	}
	t.Cleanup(func() { _ = os.Remove(path) })

	if _, err := os.ReadFile(path); err != nil {
		t.Fatalf("temp file not written: %v", err)
	}
}

func TestTraceNeedsATask(t *testing.T) {
	tracing(t, sampleTrace())

	err := run([]string{"trace"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil {
		t.Fatal("expected --task to be required")
	}
}
