package declare_test

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
	"usespotlight.ai/data-plane/runner/internal/declare"
)

type proposedUpstream struct {
	method string
	path   string
	auth   string
	body   string
}

func proposing(t *testing.T, status int, answer string) (*declare.Server, *[]proposedUpstream) {
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

	status, body := postTo(t, server, protocol.HandoverCandidatePath, server.Token(), terse)

	if status != http.StatusOK || body != `{"candidateId":"cand_1","name":"terse","replayId":"replay_1"}` {
		t.Fatalf("status = %d: %s", status, body)
	}
	if len(*seen) != 1 {
		t.Fatalf("asked Spotlight %d times", len(*seen))
	}
	asked := (*seen)[0]
	if asked.method != http.MethodPost || asked.path != "/api/runs/run_1/search-candidates" || asked.auth != "Bearer runner-token" {
		t.Errorf("asked %+v", asked)
	}
	var sent protocol.CandidateProposal
	if err := json.Unmarshal([]byte(asked.body), &sent); err != nil {
		t.Fatalf("sent %s: %v", asked.body, err)
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

	status, body := postTo(t, server, protocol.HandoverCandidatePath, server.Token(), terse)

	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d: %s", status, body)
	}
	var refused protocol.FieldErrors
	if err := json.Unmarshal([]byte(body), &refused); err != nil {
		t.Fatalf("body %s: %v", body, err)
	}
	want := []protocol.FieldError{
		{Path: "station.check", Message: "a search may not change the check", Severity: "error"},
		{Path: "station.effort", Message: "effort is one of low, medium, high", Severity: "error"},
		{Path: "station.prompt", Message: "the prompt is long", Severity: "warning"},
	}
	if !slices.Equal(refused.Errors, want) {
		t.Errorf("relayed %+v", refused.Errors)
	}
}

func TestWarningsAloneAreNoFieldRefusal(t *testing.T) {
	server, _ := proposing(t, http.StatusUnprocessableEntity, `{"status":422,"title":"The candidate is not valid",
		"detail":"station.prompt: the prompt is long",
		"errors":[{"path":"station.prompt","message":"the prompt is long","severity":"warning"}]}`)

	status, body := postTo(t, server, protocol.HandoverCandidatePath, server.Token(), terse)

	if status != http.StatusUnprocessableEntity || body != "station.prompt: the prompt is long" {
		t.Errorf("status = %d: %s", status, body)
	}
}

func TestSaysWhenTheIterationHasProposedAllItMay(t *testing.T) {
	for _, answer := range []string{`{}`, `{"type":"x","title":"Conflict","status":409,"detail":"This iteration has proposed its 3 candidates"}`} {
		server, _ := proposing(t, http.StatusConflict, answer)

		status, body := postTo(t, server, protocol.HandoverCandidatePath, server.Token(), terse)

		if status != http.StatusUnprocessableEntity || strings.HasPrefix(body, "{") ||
			!(strings.Contains(body, "proposed all the candidates it may") || strings.Contains(body, "proposed its 3 candidates")) {
			t.Errorf("status = %d: %s", status, body)
		}
	}
}

func TestSaysWhenTheSearchNoLongerHoldsTheRun(t *testing.T) {
	for answer, want := range map[string]string{
		`{}`: "the search no longer holds this run",
		`{"status":404,"detail":"The search was stopped"}`: "The search was stopped",
	} {
		server, _ := proposing(t, http.StatusNotFound, answer)

		status, body := postTo(t, server, protocol.HandoverCandidatePath, server.Token(), terse)

		if status != http.StatusUnprocessableEntity || body != want {
			t.Errorf("status = %d: %s, want %q", status, body, want)
		}
	}
}

func TestRefusesACandidateWithoutANameAHypothesisOrAStationObject(t *testing.T) {
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
		if status, _ := postTo(t, server, protocol.HandoverCandidatePath, server.Token(), body); status != http.StatusUnprocessableEntity {
			t.Errorf("status = %d for %s", status, body)
		}
	}
	if status, _ := postTo(t, server, protocol.HandoverCandidatePath, "wrong", terse); status != http.StatusUnauthorized {
		t.Errorf("status = %d for another run's token", status)
	}
	if len(*seen) != 0 {
		t.Errorf("asked Spotlight anyway: %+v", *seen)
	}
}

func TestSaysWhenTheRunCannotProposeACandidate(t *testing.T) {
	server := serve(t)

	status, _ := postTo(t, server, protocol.HandoverCandidatePath, server.Token(), terse)

	if status != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", status)
	}
}

func TestSaysWhySpotlightRefusedAnAnswer(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"type":"x","title":"No such resource","status":404,"detail":"No remark c9 on this task"}`))
	}))
	t.Cleanup(upstream.Close)

	client, err := control.New(upstream.URL, "runner-token")
	if err != nil {
		t.Fatalf("client: %v", err)
	}

	server, err := declare.Serve([]string{"spec"}, 0, func(ctx context.Context, said protocol.Remark) error {
		return client.AnswerRemark(ctx, "run_1", said)
	})
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, body := postTo(t, server, protocol.HandoverRemarkPath, server.Token(), `{"handle":"c9","body":"Done."}`)

	if status != http.StatusUnprocessableEntity || body != "No remark c9 on this task" {
		t.Errorf("status = %d: %s", status, body)
	}
}
