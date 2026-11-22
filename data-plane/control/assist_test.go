package control_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"testing"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
)

func TestSubmitAssistResultPostsTheResultWhole(t *testing.T) {
	var received string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		received = r.Method + " " + r.URL.RequestURI() + " " + string(body)
		_, _ = w.Write([]byte(`{"accepted":true}`))
	})

	answer, err := client.SubmitAssistResult(context.Background(), "run_1", json.RawMessage(`{"verdict":"pass","score":0.9}`))
	if err != nil {
		t.Fatal(err)
	}

	if received != `POST /api/runs/run_1/assist-result {"result":{"verdict":"pass","score":0.9}}` || string(answer) != `{"accepted":true}` {
		t.Errorf("received %s, answered %s", received, answer)
	}
}

func TestSubmitAssistResultCarriesTheFieldErrorsSpotlightFound(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"status":422,"detail":"verdict: must be one of pass, fail",
			"errors":[{"path":"verdict","message":"must be one of pass, fail","severity":"error"}]}`))
	})

	_, err := client.SubmitAssistResult(context.Background(), "run_1", json.RawMessage(`{"verdict":"maybe"}`))

	var rejection *control.ResponseError
	if !errors.As(err, &rejection) {
		t.Fatalf("got %v", err)
	}
	found, ok := rejection.InvalidFields()
	if !ok || !slices.Equal(found, []protocol.FieldError{{Path: "verdict", Message: "must be one of pass, fail", Severity: "error"}}) {
		t.Errorf("found %+v, %v", found, ok)
	}
}

func TestSubmitAssistResultSaysWhenSpotlightTakesNoFurtherResult(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{}`))
	})

	_, err := client.SubmitAssistResult(context.Background(), "run_1", json.RawMessage(`{}`))

	var rejection *control.ResponseError
	if !errors.As(err, &rejection) {
		t.Fatalf("got %v", err)
	}
	if message, ok := rejection.ClientErrorMessage(); !ok || message != "this run is no assist session, or Spotlight accepted its result already" {
		t.Errorf("rejected with %q, %v", message, ok)
	}
}

func TestProposeDecisionsPostsEveryDecisionWithItsLists(t *testing.T) {
	var received string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		received = r.Method + " " + r.URL.RequestURI() + " " + string(body)
		w.WriteHeader(http.StatusNoContent)
	})

	_, err := client.ProposeDecisions(context.Background(), "run_1", []protocol.ProposedDecision{
		{Kind: "limitation", Title: "Retries only once", Why: "The API is not idempotent."},
		{Kind: "trade-off", Title: "Retry in the client", Why: "No backoff.", Alternatives: []string{"Retry in the queue"}, Paths: []string{"api/src/client.ts"}},
	})
	if err != nil {
		t.Fatal(err)
	}

	want := `POST /api/runs/run_1/decisions {"decisions":[` +
		`{"kind":"limitation","title":"Retries only once","why":"The API is not idempotent.","alternatives":[],"paths":[]},` +
		`{"kind":"trade-off","title":"Retry in the client","why":"No backoff.","alternatives":["Retry in the queue"],"paths":["api/src/client.ts"]}]}`
	if received != want {
		t.Errorf("received %s", received)
	}
}

func TestProposeDecisionsCarriesTheFieldErrorsSpotlightFound(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"errors":[{"path":"decisions.0.kind","message":"kind must be one of trade-off","severity":"error"}]}`))
	})

	_, err := client.ProposeDecisions(context.Background(), "run_1", []protocol.ProposedDecision{{Kind: "hunch", Title: "x", Why: "x"}})

	var rejection *control.ResponseError
	if !errors.As(err, &rejection) {
		t.Fatalf("got %v", err)
	}
	if found, ok := rejection.InvalidFields(); !ok || len(found) != 1 || found[0].Path != "decisions.0.kind" {
		t.Errorf("found %+v, %v", found, ok)
	}
}
