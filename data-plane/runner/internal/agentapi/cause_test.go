package agentapi_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/agentapi"
)

func recording(t *testing.T, status int, answer string) (*agentapi.Server, *[]proposedUpstream) {
	t.Helper()

	var seen []proposedUpstream
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		seen = append(seen, proposedUpstream{r.Method, r.URL.EscapedPath(), r.Header.Get("Authorization"), string(body)})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(answer))
	}))
	t.Cleanup(upstream.Close)

	client, err := control.New(upstream.URL, "runner-token")
	if err != nil {
		t.Fatalf("client: %v", err)
	}

	server := serve(t)
	server.Causes(func(ctx context.Context, record protocol.CauseRecord) (json.RawMessage, error) {
		return client.RecordCause(ctx, "run_1", record)
	})

	return server, &seen
}

const judged = `{"taskId":"task_1","cause":"judge","evidence":"The rubric requires tests.","suggestion":"Drop that line."}`

func TestRelaysACauseToSpotlightAsTheRunner(t *testing.T) {
	server, seen := recording(t, http.StatusCreated, `{"taskId":"task_1","cause":"judge","replayRunId":"replayed_1"}`)

	status, body := postTo(t, server, protocol.AgentAPICausePath, server.Token(), judged)

	if status != http.StatusOK || body != `{"taskId":"task_1","cause":"judge","replayRunId":"replayed_1"}` {
		t.Fatalf("status = %d: %s", status, body)
	}
	if len(*seen) != 1 {
		t.Fatalf("called Spotlight %d times", len(*seen))
	}
	received := (*seen)[0]
	if received.method != http.MethodPost || received.path != "/api/runs/run_1/search-causes" || received.auth != "Bearer runner-token" {
		t.Errorf("received %+v", received)
	}
	var sent protocol.CauseRecord
	if err := json.Unmarshal([]byte(received.body), &sent); err != nil || sent != (protocol.CauseRecord{
		TaskID: "task_1", Cause: "judge", Evidence: "The rubric requires tests.", Suggestion: "Drop that line.",
	}) {
		t.Errorf("sent %s", received.body)
	}
}

func TestSaysWhySpotlightRejectedACause(t *testing.T) {
	for _, rejected := range []struct {
		status int
		answer string
		want   string
	}{
		{http.StatusNotFound, `{"status":404,"detail":"No failing task task_1 among the tasks this reflection looks into"}`, "No failing task task_1"},
		{http.StatusNotFound, `{}`, "the task is none it looks into"},
		{http.StatusConflict, `{}`, "this run proposes candidates"},
	} {
		server, _ := recording(t, rejected.status, rejected.answer)

		status, body := postTo(t, server, protocol.AgentAPICausePath, server.Token(), judged)

		if status != http.StatusUnprocessableEntity || !strings.Contains(body, rejected.want) {
			t.Errorf("status = %d: %s, want %q", status, body, rejected.want)
		}
	}
}

func TestRejectsACauseWithoutATaskAKnownCauseOrEvidence(t *testing.T) {
	server, seen := recording(t, http.StatusCreated, `{}`)

	for _, body := range []string{
		`{"cause":"judge","evidence":"x"}`,
		`{"taskId":"task_1","cause":"luck","evidence":"x"}`,
		`{"taskId":"task_1","evidence":"x"}`,
		`{"taskId":"task_1","cause":"judge","evidence":"  "}`,
	} {
		if status, _ := postTo(t, server, protocol.AgentAPICausePath, server.Token(), body); status != http.StatusUnprocessableEntity {
			t.Errorf("status = %d for %s", status, body)
		}
	}
	if len(*seen) != 0 {
		t.Errorf("called Spotlight anyway: %+v", *seen)
	}
}

func TestSaysWhenTheRunCannotRecordACause(t *testing.T) {
	server := serve(t)

	if status, _ := postTo(t, server, protocol.AgentAPICausePath, server.Token(), judged); status != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", status)
	}
}
