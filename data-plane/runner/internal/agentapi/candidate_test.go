package agentapi_test

import (
	"context"
	"encoding/json"
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

type proposedUpstream struct {
	method string
	path   string
	auth   string
	body   string
}

func proposing(t *testing.T, status int, answer string) (*agentapi.Server, *[]proposedUpstream) {
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
	server.Candidates(func(ctx context.Context, proposal protocol.CandidateProposal) (json.RawMessage, error) {
		return client.ProposeCandidate(ctx, "run_1", proposal)
	})

	return server, &seen
}

const terse = `{"name":"terse","hypothesis":"Shorter prompts finish sooner.","station":{"prompt":"Be brief.","effort":"low"}}`

func TestRelaysACandidateToSpotlightAsTheRunner(t *testing.T) {
	server, seen := proposing(t, http.StatusCreated, `{"candidateId":"cand_1","name":"terse","replayId":"replay_1"}`)

	status, body := postTo(t, server, protocol.AgentAPICandidatePath, server.Token(), terse)

	if status != http.StatusOK || body != `{"candidateId":"cand_1","name":"terse","replayId":"replay_1"}` {
		t.Fatalf("status = %d: %s", status, body)
	}
	if len(*seen) != 1 {
		t.Fatalf("called Spotlight %d times", len(*seen))
	}
	received := (*seen)[0]
	if received.method != http.MethodPost || received.path != "/api/runs/run_1/search-candidates" || received.auth != "Bearer runner-token" {
		t.Errorf("received %+v", received)
	}
	var sent protocol.CandidateProposal
	if err := json.Unmarshal([]byte(received.body), &sent); err != nil {
		t.Fatalf("sent %s: %v", received.body, err)
	}
	if sent.Name != "terse" || sent.Hypothesis != "Shorter prompts finish sooner." ||
		string(sent.Station) != `{"prompt":"Be brief.","effort":"low"}` {
		t.Errorf("sent %+v", sent)
	}
}

const invalidCandidate = `{
	"type":"https://usespotlight.ai/problems/invalid","title":"The candidate is not valid","status":422,
	"detail":"station.check: a search may not change the check\nstation.effort: effort is one of low, medium, high\nstation.prompt: the prompt is long",
	"errors":[
		{"path":"station.check","message":"a search may not change the check","severity":"error"},
		{"path":"station.effort","message":"effort is one of low, medium, high","severity":"error"},
		{"path":"station.prompt","message":"the prompt is long","severity":"warning"}
	]
}`

func TestRelaysTheFieldErrorsSpotlightFoundWithACandidate(t *testing.T) {
	server, _ := proposing(t, http.StatusUnprocessableEntity, invalidCandidate)

	status, body := postTo(t, server, protocol.AgentAPICandidatePath, server.Token(), terse)

	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d: %s", status, body)
	}
	var invalid protocol.FieldErrors
	if err := json.Unmarshal([]byte(body), &invalid); err != nil {
		t.Fatalf("body %s: %v", body, err)
	}
	want := []protocol.FieldError{
		{Path: "station.check", Message: "a search may not change the check", Severity: "error"},
		{Path: "station.effort", Message: "effort is one of low, medium, high", Severity: "error"},
		{Path: "station.prompt", Message: "the prompt is long", Severity: "warning"},
	}
	if !slices.Equal(invalid.Errors, want) {
		t.Errorf("relayed %+v", invalid.Errors)
	}
}

func TestWarningsAloneAreNoFieldErrors(t *testing.T) {
	server, _ := proposing(t, http.StatusUnprocessableEntity, `{"status":422,"title":"The candidate is not valid",
		"detail":"station.prompt: the prompt is long",
		"errors":[{"path":"station.prompt","message":"the prompt is long","severity":"warning"}]}`)

	status, body := postTo(t, server, protocol.AgentAPICandidatePath, server.Token(), terse)

	if status != http.StatusUnprocessableEntity || body != "station.prompt: the prompt is long" {
		t.Errorf("status = %d: %s", status, body)
	}
}

func TestSaysWhenTheIterationHasProposedAllItMay(t *testing.T) {
	for _, answer := range []string{`{}`, `{"type":"x","title":"Conflict","status":409,"detail":"This iteration has proposed its 3 candidates"}`} {
		server, _ := proposing(t, http.StatusConflict, answer)

		status, body := postTo(t, server, protocol.AgentAPICandidatePath, server.Token(), terse)

		if status != http.StatusUnprocessableEntity || strings.HasPrefix(body, "{") ||
			!(strings.Contains(body, "proposed all the candidates it may") || strings.Contains(body, "proposed its 3 candidates")) {
			t.Errorf("status = %d: %s", status, body)
		}
	}
}

func TestSaysWhenTheRunIsNoLongerTheActiveRunOfTheSearch(t *testing.T) {
	for answer, want := range map[string]string{
		`{}`: "this run is no longer the active run of the search",
		`{"status":404,"detail":"The search was stopped"}`: "The search was stopped",
	} {
		server, _ := proposing(t, http.StatusNotFound, answer)

		status, body := postTo(t, server, protocol.AgentAPICandidatePath, server.Token(), terse)

		if status != http.StatusUnprocessableEntity || body != want {
			t.Errorf("status = %d: %s, want %q", status, body, want)
		}
	}
}

func TestRejectsACandidateWithoutANameAHypothesisOrAStationObject(t *testing.T) {
	server, seen := proposing(t, http.StatusCreated, `{}`)

	for _, body := range []string{
		`{"hypothesis":"x","station":{}}`,
		`{"name":"../terse","hypothesis":"x","station":{}}`,
		`{"name":" terse","hypothesis":"x","station":{}}`,
		`{"name":"Terse","hypothesis":"x","station":{}}`,
		`{"name":"-terse","hypothesis":"x","station":{}}`,
		`{"name":"terse_one","hypothesis":"x","station":{}}`,
		`{"name":"terse","hypothesis":"  ","station":{}}`,
		`{"name":"terse","hypothesis":"x"}`,
		`{"name":"terse","hypothesis":"x","station":["prompt"]}`,
		`{"name":"terse","hypothesis":"x","station":null}`,
	} {
		if status, _ := postTo(t, server, protocol.AgentAPICandidatePath, server.Token(), body); status != http.StatusUnprocessableEntity {
			t.Errorf("status = %d for %s", status, body)
		}
	}
	if status, _ := postTo(t, server, protocol.AgentAPICandidatePath, "wrong", terse); status != http.StatusUnauthorized {
		t.Errorf("status = %d for another run's token", status)
	}
	if len(*seen) != 0 {
		t.Errorf("called Spotlight anyway: %+v", *seen)
	}
}

func TestSaysWhenTheRunCannotProposeACandidate(t *testing.T) {
	server := serve(t)

	status, _ := postTo(t, server, protocol.AgentAPICandidatePath, server.Token(), terse)

	if status != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", status)
	}
}

func TestSaysWhySpotlightRejectedAReply(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"type":"x","title":"No such resource","status":404,"detail":"No review comment c9 on this task"}`))
	}))
	t.Cleanup(upstream.Close)

	client, err := control.New(upstream.URL, "runner-token")
	if err != nil {
		t.Fatalf("client: %v", err)
	}

	server, err := agentapi.Serve([]string{"spec"}, 0, func(ctx context.Context, reply protocol.ReviewCommentReply) error {
		return client.ReplyToReviewComment(ctx, "run_1", reply)
	})
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, body := postTo(t, server, protocol.AgentAPIReviewCommentReplyPath, server.Token(), `{"handle":"c9","body":"Done."}`)

	if status != http.StatusUnprocessableEntity || body != "No review comment c9 on this task" {
		t.Errorf("status = %d: %s", status, body)
	}
}
