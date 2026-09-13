package otel_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"testing"

	"usespotlight.ai/runner/internal/otel"
)

type taken struct {
	mu    sync.Mutex
	spans []json.RawMessage
}

func (t *taken) record(span json.RawMessage) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.spans = append(t.spans, span)
}

func (t *taken) all() []json.RawMessage {
	t.mu.Lock()
	defer t.mu.Unlock()
	return append([]json.RawMessage(nil), t.spans...)
}

func collector(t *testing.T, seen *taken) *otel.Serving {
	t.Helper()

	served, err := otel.Serve(seen.record)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = served.Close() })

	return served
}

func export(t *testing.T, url, body string) *http.Response {
	t.Helper()

	response, err := http.Post(url+"/v1/traces", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	t.Cleanup(func() { _ = response.Body.Close() })

	return response
}

const twoSpans = `{"resourceSpans":[{"scopeSpans":[{"spans":[
	{"name":"claude_code.llm_request","spanId":"a1","attributes":[{"key":"gen_ai.request.model","value":{"stringValue":"claude-opus-5"}}]},
	{"name":"claude_code.tool","spanId":"a2"}
]}]}]}`

func TestKeepsEachSpanAsItArrived(t *testing.T) {
	seen := &taken{}
	served := collector(t, seen)

	export(t, served.URL, twoSpans)

	spans := seen.all()
	if len(spans) != 2 {
		t.Fatalf("took %d spans, wanted 2", len(spans))
	}

	var first struct {
		Name       string `json:"name"`
		Attributes []struct {
			Key string `json:"key"`
		} `json:"attributes"`
	}
	if err := json.Unmarshal(spans[0], &first); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if first.Name != "claude_code.llm_request" {
		t.Errorf("kept %q, wanted the span's own name", first.Name)
	}
	if len(first.Attributes) != 1 || first.Attributes[0].Key != "gen_ai.request.model" {
		t.Errorf("lost the span's attributes: %s", spans[0])
	}
}

func TestWalksEveryResourceAndScope(t *testing.T) {
	seen := &taken{}
	served := collector(t, seen)

	export(t, served.URL, `{"resourceSpans":[
		{"scopeSpans":[{"spans":[{"name":"one"}]},{"spans":[{"name":"two"}]}]},
		{"scopeSpans":[{"spans":[{"name":"three"}]}]}
	]}`)

	if got := len(seen.all()); got != 3 {
		t.Errorf("took %d spans, wanted 3", got)
	}
}

func TestAcceptsWhatItCannotRead(t *testing.T) {
	seen := &taken{}
	served := collector(t, seen)

	response := export(t, served.URL, "\x00\x01not json at all")

	if response.StatusCode != http.StatusOK {
		t.Errorf("answered %d, wanted 200", response.StatusCode)
	}
	if got := len(seen.all()); got != 0 {
		t.Errorf("took %d spans from something unreadable", got)
	}
}

func TestAnswersWithABodyAnExporterCanDecode(t *testing.T) {
	seen := &taken{}
	served := collector(t, seen)

	response := export(t, served.URL, `{"resourceSpans":[]}`)

	if got := response.Header.Get("Content-Type"); got != "application/json" {
		t.Errorf("answered as %q, wanted application/json", got)
	}
}

func TestServesNobodyOnceTheRunIsOver(t *testing.T) {
	seen := &taken{}
	served := collector(t, seen)
	url := served.URL

	if err := served.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	if _, err := http.Post(url+"/v1/traces", "application/json", strings.NewReader("{}")); err == nil {
		t.Error("still answering after the run ended")
	}
}
