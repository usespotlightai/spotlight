package control_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"usespotlight.ai/runner/internal/control"
	"usespotlight.ai/runner/internal/protocol"
)

func workloadWith(t *testing.T, token string) control.Enrolment {
	t.Helper()

	file := filepath.Join(t.TempDir(), "token")
	if err := os.WriteFile(file, []byte(token+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	return control.Enrolment{TokenFile: file, Trust: "trust_1", Name: "pod-a"}
}

func TestExchangeSendsTheIssuedTokenWithNoBearer(t *testing.T) {
	var got protocol.Exchange
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/runners/exchange" || r.Header.Get("Authorization") != "" {
			t.Errorf("asked %s with authorization %q", r.URL.Path, r.Header.Get("Authorization"))
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		_ = json.NewEncoder(w).Encode(protocol.Exchanged{RunnerID: "runner_1", Token: "runner-token"})
	}))
	defer server.Close()

	exchanged, err := control.Exchange(context.Background(), server.URL, workloadWith(t, "issued.jwt"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got != (protocol.Exchange{Trust: "trust_1", Token: "issued.jwt", Name: "pod-a"}) {
		t.Errorf("sent %+v", got)
	}
	if exchanged.Token != "runner-token" || exchanged.RunnerID != "runner_1" {
		t.Errorf("answered %+v", exchanged)
	}
}

func TestExchangeReportsARefusal(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	if _, err := control.Exchange(context.Background(), server.URL, workloadWith(t, "issued.jwt")); err == nil {
		t.Fatal("expected the refusal to be an error")
	}
}

func TestExchangeRereadsTheTokenFileEachTime(t *testing.T) {
	var tokens []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var got protocol.Exchange
		_ = json.NewDecoder(r.Body).Decode(&got)
		tokens = append(tokens, got.Token)
		_ = json.NewEncoder(w).Encode(protocol.Exchanged{RunnerID: "runner_1", Token: "t"})
	}))
	defer server.Close()

	workload := workloadWith(t, "first")
	if _, err := control.Exchange(context.Background(), server.URL, workload); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(workload.TokenFile, []byte("rotated"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := control.Exchange(context.Background(), server.URL, workload); err != nil {
		t.Fatal(err)
	}

	if len(tokens) != 2 || tokens[0] != "first" || tokens[1] != "rotated" {
		t.Errorf("sent %v", tokens)
	}
}
