package agentapi_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestCarriesAHistoryRequestToSpotlight(t *testing.T) {
	server := serve(t)
	var received []protocol.HistoryRequest
	server.Histories(func(_ context.Context, request protocol.HistoryRequest) (json.RawMessage, error) {
		received = append(received, request)
		return json.RawMessage(`{"runs":[]}`), nil
	})

	status, body := postTo(t, server, protocol.AgentAPIHistoryPath, server.Token(),
		`{"station":"implementation","line":"delivery","last":5}`)

	if status != http.StatusOK || body != `{"runs":[]}` {
		t.Fatalf("status = %d: %s", status, body)
	}
	want := protocol.HistoryRequest{Station: "implementation", Line: "delivery", Last: 5}
	if len(received) != 1 || received[0] != want {
		t.Errorf("received %+v", received)
	}
}

func TestRejectsAHistoryOfNoStation(t *testing.T) {
	server := serve(t)
	server.Histories(func(context.Context, protocol.HistoryRequest) (json.RawMessage, error) {
		t.Error("called Spotlight anyway")
		return nil, nil
	})

	status, _ := postTo(t, server, protocol.AgentAPIHistoryPath, server.Token(), `{"station":"  "}`)

	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", status)
	}
}

func TestSaysPlainlyWhySpotlightRejectedAHistory(t *testing.T) {
	server := serve(t)
	server.Histories(func(context.Context, protocol.HistoryRequest) (json.RawMessage, error) {
		return nil, rejectedUpstream{message: "Several lines have a station by that key; name one with --line: a, b"}
	})

	status, body := postTo(t, server, protocol.AgentAPIHistoryPath, server.Token(), `{"station":"review"}`)

	if status != http.StatusUnprocessableEntity || body != "Several lines have a station by that key; name one with --line: a, b" {
		t.Errorf("status = %d: %s", status, body)
	}
}

func TestSaysWhenSpotlightCouldNotBeReachedForAHistory(t *testing.T) {
	server := serve(t)
	server.Histories(func(context.Context, protocol.HistoryRequest) (json.RawMessage, error) {
		return nil, errors.New("connection refused")
	})

	status, body := postTo(t, server, protocol.AgentAPIHistoryPath, server.Token(), `{"station":"review"}`)

	if status != http.StatusBadGateway || !strings.Contains(body, "connection refused") {
		t.Errorf("status = %d: %s", status, body)
	}
}

func TestSaysWhenTheRunCannotReadAHistory(t *testing.T) {
	server := serve(t)

	status, _ := postTo(t, server, protocol.AgentAPIHistoryPath, server.Token(), `{"station":"review"}`)

	if status != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", status)
	}
}
