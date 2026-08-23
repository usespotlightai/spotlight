package control_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"usespotlight.ai/runner/internal/control"
	"usespotlight.ai/runner/internal/protocol"
)

func serve(t *testing.T, handler http.HandlerFunc) *control.Client {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	client, err := control.New(server.URL, "tok")
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	return client
}

func TestNewRefusesAnAddressItCannotCall(t *testing.T) {
	for _, bad := range []string{"", "localhost:3000", "/api"} {
		if _, err := control.New(bad, "tok"); err == nil {
			t.Errorf("%q should be refused", bad)
		}
	}
}

func TestRegisterCarriesTheBearerTokenAndKeepsTheId(t *testing.T) {
	var seenAuth string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		seenAuth = r.Header.Get("Authorization")
		_ = json.NewEncoder(w).Encode(protocol.Registered{RunnerID: "runner_1"})
	})

	if err := client.Register(context.Background(), protocol.Registration{Pool: "p"}); err != nil {
		t.Fatalf("register: %v", err)
	}

	if seenAuth != "Bearer tok" {
		t.Errorf("authorization %q", seenAuth)
	}
	if client.RunnerID() != "runner_1" {
		t.Errorf("runner id %q", client.RunnerID())
	}
}

func TestRegisterRefusesAnAnswerWithoutAnId(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{}`))
	})

	if err := client.Register(context.Background(), protocol.Registration{}); err == nil {
		t.Fatal("expected an error")
	}
}

func TestClaimTreatsAnEmptyQueueAsOrdinary(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/runners" {
			_ = json.NewEncoder(w).Encode(protocol.Registered{RunnerID: "runner_1"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	if err := client.Register(context.Background(), protocol.Registration{}); err != nil {
		t.Fatalf("register: %v", err)
	}

	run, err := client.Claim(context.Background())
	if err != nil {
		t.Fatalf("claim: %v", err)
	}
	if run != nil {
		t.Errorf("expected no run, got %+v", run)
	}
}

func TestClaimReturnsTheRunAndAsksAsThisRunner(t *testing.T) {
	var claimPath string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/runners" {
			_ = json.NewEncoder(w).Encode(protocol.Registered{RunnerID: "runner_1"})
			return
		}
		claimPath = r.URL.Path
		_ = json.NewEncoder(w).Encode(protocol.Run{ID: "run_1", Spec: protocol.Spec{Cwd: "service"}})
	})

	if err := client.Register(context.Background(), protocol.Registration{}); err != nil {
		t.Fatalf("register: %v", err)
	}

	run, err := client.Claim(context.Background())
	if err != nil {
		t.Fatalf("claim: %v", err)
	}
	if run == nil || run.ID != "run_1" {
		t.Fatalf("run %+v", run)
	}
	if claimPath != "/api/runners/runner_1/claim" {
		t.Errorf("claim path %q", claimPath)
	}
}

func TestAppendEventsSaysNothingWhenThereIsNothingToSay(t *testing.T) {
	called := false
	client := serve(t, func(http.ResponseWriter, *http.Request) { called = true })

	if err := client.AppendEvents(context.Background(), "run_1", nil); err != nil {
		t.Fatalf("append: %v", err)
	}
	if called {
		t.Error("an empty batch should not be sent")
	}
}

func TestAFailureCarriesTheServersExplanation(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "lease expired", http.StatusConflict)
	})

	err := client.RenewLease(context.Background(), "run_1")
	if err == nil {
		t.Fatal("expected an error")
	}
	for _, want := range []string{"409", "lease expired"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q", err, want)
		}
	}
}
