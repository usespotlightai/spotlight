package declare_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/declare"
)

type rejectedUpstream struct{ message string }

func (r rejectedUpstream) Error() string {
	return "remember: POST /api/runs/run_1/memories: 422: {...}"
}

func (r rejectedUpstream) ClientErrorMessage() (string, bool) { return r.message, true }

func remembering(t *testing.T, remember declare.Rememberer) (*declare.Server, *[]protocol.RecallRequest) {
	t.Helper()

	server := serve(t)
	var recalled []protocol.RecallRequest
	server.Memories(
		func(_ context.Context, asked protocol.RecallRequest) (json.RawMessage, error) {
			recalled = append(recalled, asked)
			return json.RawMessage(`[{"handle":"M-1"}]`), nil
		},
		remember,
	)

	return server, &recalled
}

func TestCarriesARecallToSpotlight(t *testing.T) {
	server, recalled := remembering(t, nil)

	status, body := postTo(t, server, protocol.HandoverRecallPath, server.Token(), `{"words":"upload retries"}`)

	if status != http.StatusOK || body != `[{"handle":"M-1"}]` {
		t.Fatalf("status = %d: %s", status, body)
	}
	if len(*recalled) != 1 || (*recalled)[0].Words != "upload retries" {
		t.Errorf("recalled %+v", *recalled)
	}
}

func TestRejectsARecallOfNothing(t *testing.T) {
	server, recalled := remembering(t, nil)

	status, _ := postTo(t, server, protocol.HandoverRecallPath, server.Token(), `{"words":"  "}`)

	if status != http.StatusUnprocessableEntity || len(*recalled) != 0 {
		t.Fatalf("status = %d, recalled %+v", status, *recalled)
	}
}

func TestCarriesAMemoryToSpotlight(t *testing.T) {
	var got protocol.Remembering
	server, _ := remembering(t, func(_ context.Context, asked protocol.Remembering) (json.RawMessage, error) {
		got = asked
		return json.RawMessage(`{"kind":"rationale"}`), nil
	})

	status, body := postTo(t, server, protocol.HandoverRememberPath, server.Token(),
		`{"kind":"rationale","body":"Retry in the request.","paths":["/w/api/src"]}`)

	if status != http.StatusOK {
		t.Fatalf("status = %d: %s", status, body)
	}
	if got.Kind != "rationale" || len(got.Paths) != 1 {
		t.Errorf("remembered %+v", got)
	}
}

func TestSaysPlainlyWhySpotlightRejectedAMemory(t *testing.T) {
	for _, rejected := range []error{
		rejectedUpstream{message: "A memory is one of rationale, failure, not gossip"},
		&declare.Error{Because: "A memory is one of rationale, failure, not gossip"},
	} {
		server, _ := remembering(t, func(context.Context, protocol.Remembering) (json.RawMessage, error) {
			return nil, rejected
		})

		status, body := postTo(t, server, protocol.HandoverRememberPath, server.Token(),
			`{"kind":"gossip","body":"Something."}`)

		if status != http.StatusUnprocessableEntity || body != "A memory is one of rationale, failure, not gossip" {
			t.Errorf("status = %d: %s", status, body)
		}
	}
}

func TestSaysWhenSpotlightCouldNotBeReachedForAMemory(t *testing.T) {
	server, _ := remembering(t, func(context.Context, protocol.Remembering) (json.RawMessage, error) {
		return nil, errors.New("connection refused")
	})

	status, body := postTo(t, server, protocol.HandoverRememberPath, server.Token(),
		`{"kind":"rationale","body":"Something."}`)

	if status != http.StatusBadGateway || !strings.Contains(body, "connection refused") {
		t.Errorf("status = %d: %s", status, body)
	}
}

func TestRejectsAMemoryWithoutAKindOrABody(t *testing.T) {
	server, _ := remembering(t, func(context.Context, protocol.Remembering) (json.RawMessage, error) {
		t.Error("remembered anyway")
		return nil, nil
	})

	for _, body := range []string{`{"body":"x"}`, `{"kind":"rationale"}`} {
		if status, _ := postTo(t, server, protocol.HandoverRememberPath, server.Token(), body); status != http.StatusUnprocessableEntity {
			t.Errorf("status = %d for %s", status, body)
		}
	}
}

func TestSaysWhenTheRunCannotRemember(t *testing.T) {
	server := serve(t)

	status, _ := postTo(t, server, protocol.HandoverRememberPath, server.Token(), `{"kind":"rationale","body":"x"}`)

	if status != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", status)
	}
}
