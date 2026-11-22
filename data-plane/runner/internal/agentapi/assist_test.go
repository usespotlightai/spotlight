package agentapi_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/agentapi"
)

func upstreamOf(t *testing.T, status int, answer string) (*control.Client, *[]proposedUpstream) {
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

	return client, &seen
}

func submitting(t *testing.T, status int, answer string) (*agentapi.Server, *[]proposedUpstream) {
	t.Helper()

	client, seen := upstreamOf(t, status, answer)
	server := serve(t)
	server.Submits(func(ctx context.Context, result json.RawMessage) (json.RawMessage, error) {
		return client.SubmitAssistResult(ctx, "run_1", result)
	})

	return server, seen
}

const passed = `{"result":{"verdict":"pass","reasons":["The tests cover the retry."]}}`

func TestRelaysAnAssistResultToSpotlightAsTheRunner(t *testing.T) {
	server, seen := submitting(t, http.StatusOK, `{"accepted":true}`)

	status, body := postTo(t, server, protocol.AgentAPISubmitPath, server.Token(), passed)

	if status != http.StatusOK || body != `{"accepted":true}` {
		t.Fatalf("status = %d: %s", status, body)
	}
	if len(*seen) != 1 {
		t.Fatalf("called Spotlight %d times", len(*seen))
	}
	received := (*seen)[0]
	if received.method != http.MethodPost || received.path != "/api/runs/run_1/assist-result" || received.auth != "Bearer runner-token" ||
		received.body != `{"result":{"verdict":"pass","reasons":["The tests cover the retry."]}}` {
		t.Errorf("received %+v", received)
	}
}

func TestRelaysTheFieldErrorsSpotlightFoundWithAResult(t *testing.T) {
	server, _ := submitting(t, http.StatusUnprocessableEntity, `{"status":422,"title":"The result is not valid",
		"detail":"verdict: must be one of pass, fail",
		"errors":[{"path":"verdict","message":"must be one of pass, fail","severity":"error"}]}`)

	status, body := postTo(t, server, protocol.AgentAPISubmitPath, server.Token(), passed)

	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d: %s", status, body)
	}
	var invalid protocol.FieldErrors
	if err := json.Unmarshal([]byte(body), &invalid); err != nil {
		t.Fatalf("body %s: %v", body, err)
	}
	if !slices.Equal(invalid.Errors, []protocol.FieldError{{Path: "verdict", Message: "must be one of pass, fail", Severity: "error"}}) {
		t.Errorf("relayed %+v", invalid.Errors)
	}
}

func TestSaysWhenSpotlightTakesNoFurtherResult(t *testing.T) {
	server, _ := submitting(t, http.StatusConflict, `{}`)

	status, body := postTo(t, server, protocol.AgentAPISubmitPath, server.Token(), passed)

	if status != http.StatusUnprocessableEntity || !strings.Contains(body, "accepted its result already") {
		t.Errorf("status = %d: %s", status, body)
	}
}

func TestRejectsASubmissionWithoutAResult(t *testing.T) {
	server, seen := submitting(t, http.StatusOK, `{"accepted":true}`)

	for _, body := range []string{`{}`, `{"result":null}`, `not json`, `["pass"]`} {
		if status, _ := postTo(t, server, protocol.AgentAPISubmitPath, server.Token(), body); status != http.StatusUnprocessableEntity && status != http.StatusBadRequest {
			t.Errorf("status = %d for %s", status, body)
		}
	}
	if len(*seen) != 0 {
		t.Errorf("called Spotlight anyway: %+v", *seen)
	}
}

func TestSaysWhenTheRunCannotSubmitAResult(t *testing.T) {
	server := serve(t)

	status, body := postTo(t, server, protocol.AgentAPISubmitPath, server.Token(), passed)

	if status != http.StatusNotImplemented || !strings.Contains(body, "only an assist session does") {
		t.Fatalf("status = %d: %s", status, body)
	}
}

func deciding(t *testing.T, status int, answer string) (*agentapi.Server, *[]proposedUpstream) {
	t.Helper()

	client, seen := upstreamOf(t, status, answer)
	server := serve(t)
	server.Decisions(func(ctx context.Context, decision protocol.ProposedDecision) (json.RawMessage, error) {
		return client.ProposeDecisions(ctx, "run_1", []protocol.ProposedDecision{decision})
	})

	return server, seen
}

const tradedOff = `{"kind":"trade-off","title":" Retry in the client ","why":"The queue has no backoff.","alternatives":["Retry in the queue"]}`

func TestRelaysADecisionToSpotlightAsTheRunner(t *testing.T) {
	server, seen := deciding(t, http.StatusCreated, `{"recorded":1}`)

	status, body := postTo(t, server, protocol.AgentAPIDecisionPath, server.Token(), tradedOff)

	if status != http.StatusOK || body != `{"recorded":1}` {
		t.Fatalf("status = %d: %s", status, body)
	}
	if len(*seen) != 1 {
		t.Fatalf("called Spotlight %d times", len(*seen))
	}
	received := (*seen)[0]
	want := `{"decisions":[{"kind":"trade-off","title":"Retry in the client","why":"The queue has no backoff.","alternatives":["Retry in the queue"],"paths":[]}]}`
	if received.method != http.MethodPost || received.path != "/api/runs/run_1/decisions" || received.auth != "Bearer runner-token" || received.body != want {
		t.Errorf("received %+v", received)
	}
}

func TestRelaysTheFieldErrorsSpotlightFoundWithADecision(t *testing.T) {
	server, _ := deciding(t, http.StatusUnprocessableEntity, `{"status":422,
		"errors":[{"path":"decisions.0.paths","message":"must name between 1 and 20 paths","severity":"error"}]}`)

	status, body := postTo(t, server, protocol.AgentAPIDecisionPath, server.Token(), tradedOff)

	var invalid protocol.FieldErrors
	if status != http.StatusUnprocessableEntity || json.Unmarshal([]byte(body), &invalid) != nil ||
		len(invalid.Errors) != 1 || invalid.Errors[0].Path != "decisions.0.paths" {
		t.Errorf("status = %d: %s", status, body)
	}
}

func TestRejectsADecisionSpotlightWouldNotRecord(t *testing.T) {
	server, seen := deciding(t, http.StatusCreated, `{}`)
	long := strings.Repeat("x", protocol.MaxDecisionTitle+1)

	for _, body := range []string{
		`{"kind":"hunch","title":"x","why":"x"}`,
		`{"title":"x","why":"x"}`,
		`{"kind":"assumption","title":"  ","why":"x"}`,
		`{"kind":"assumption","title":"` + long + `","why":"x"}`,
		`{"kind":"assumption","title":"x","why":""}`,
		`{"kind":"assumption","title":"x","why":"x","alternatives":["a","b","c","d","e","f"]}`,
		`{"kind":"assumption","title":"x","why":"x","alternatives":[" "]}`,
		`{"kind":"assumption","title":"x","why":"x","paths":[""]}`,
	} {
		if status, _ := postTo(t, server, protocol.AgentAPIDecisionPath, server.Token(), body); status != http.StatusUnprocessableEntity {
			t.Errorf("status = %d for %s", status, body)
		}
	}
	if len(*seen) != 0 {
		t.Errorf("called Spotlight anyway: %+v", *seen)
	}
}

func TestSaysWhyTheRunMayNotDecide(t *testing.T) {
	server := serve(t)
	server.Decisions(func(context.Context, protocol.ProposedDecision) (json.RawMessage, error) {
		return nil, &agentapi.Error{Because: "a search may not record a decision"}
	})

	status, body := postTo(t, server, protocol.AgentAPIDecisionPath, server.Token(), tradedOff)

	if status != http.StatusUnprocessableEntity || body != "a search may not record a decision" {
		t.Errorf("status = %d: %s", status, body)
	}
}

func TestARefusedHandoverSaysWhy(t *testing.T) {
	server := serve(t)
	server.RefuseHandover(errors.New("an assist session may not hand over"))

	status, body := post(t, server, server.Token(), `{"next":"spec"}`)

	if status != http.StatusUnprocessableEntity || strings.TrimSpace(body) != "an assist session may not hand over" {
		t.Errorf("status = %d: %s", status, body)
	}
	if handover := server.TakeHandover(); handover != nil {
		t.Errorf("took %+v", handover)
	}
}
