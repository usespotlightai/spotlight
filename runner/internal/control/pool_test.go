package control_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"usespotlight.ai/runner/internal/control"
	"usespotlight.ai/runner/internal/protocol"
)

type seen struct {
	mu       sync.Mutex
	requests []string
	bearers  []string
}

func (s *seen) note(r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.requests = append(s.requests, r.Method+" "+r.URL.Path)
	s.bearers = append(s.bearers, r.Header.Get("Authorization"))
}

func pool(t *testing.T, handler http.HandlerFunc) *control.Pool {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	claimer, err := control.NewPool(server.URL, "pool-tok")
	if err != nil {
		t.Fatalf("new pool: %v", err)
	}
	return claimer
}

func seatedWith(work protocol.Claimed) protocol.PoolClaimed {
	return protocol.PoolClaimed{RunnerID: "runner_1", Token: "run-tok", Work: work}
}

func TestPoolAsksWhatToLookForWithThePoolToken(t *testing.T) {
	var requests seen
	claimer := pool(t, func(w http.ResponseWriter, r *http.Request) {
		requests.note(r)
		_ = json.NewEncoder(w).Encode([]protocol.Installable{{ID: "claude-code", Executable: "claude"}})
	})

	installable, err := claimer.Installable(context.Background())
	if err != nil {
		t.Fatalf("installable: %v", err)
	}

	if len(installable) != 1 || installable[0].ID != "claude-code" {
		t.Errorf("installable %+v", installable)
	}
	if requests.requests[0] != "GET /api/pools/harnesses" || requests.bearers[0] != "Bearer pool-tok" {
		t.Errorf("asked %v with %v", requests.requests, requests.bearers)
	}
}

func TestPoolClaimOffersItsHarnessesWithThePoolToken(t *testing.T) {
	var requests seen
	var offered protocol.Registration
	claimer := pool(t, func(w http.ResponseWriter, r *http.Request) {
		requests.note(r)
		_ = json.NewDecoder(r.Body).Decode(&offered)
		w.WriteHeader(http.StatusNoContent)
	})

	offer := protocol.Registration{Harnesses: []protocol.HarnessReport{
		{ID: "claude-code", Models: []string{"opus"}, Version: "2.1.0"},
	}}
	if err := claimer.Register(context.Background(), offer); err != nil {
		t.Fatalf("register: %v", err)
	}

	claimed, err := claimer.Claim(context.Background())
	if err != nil {
		t.Fatalf("claim: %v", err)
	}

	if claimed != nil || claimer.Seated() != nil {
		t.Errorf("an empty pool should hand back nothing, got %+v", claimed)
	}
	if requests.requests[0] != "POST /api/pools/claim" || requests.bearers[0] != "Bearer pool-tok" {
		t.Errorf("claimed with %v %v", requests.requests, requests.bearers)
	}
	if len(offered.Harnesses) != 1 || offered.Harnesses[0].ID != "claude-code" ||
		offered.Harnesses[0].Version != "2.1.0" || offered.Harnesses[0].Models[0] != "opus" {
		t.Errorf("offered %+v", offered)
	}
}

func TestPoolRefusalIsFinal(t *testing.T) {
	claimer := pool(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "unknown pool token", http.StatusUnauthorized)
	})

	if _, err := claimer.Claim(context.Background()); !errors.Is(err, control.ErrRefused) {
		t.Errorf("claim: expected a refusal, got %v", err)
	}
	if err := control.Register(context.Background(), claimer, quiet()); !errors.Is(err, control.ErrRefused) {
		t.Errorf("register: expected a refusal, got %v", err)
	}
}

func TestPoolFailureOtherThanARefusalIsNotFinal(t *testing.T) {
	claimer := pool(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "down for a moment", http.StatusServiceUnavailable)
	})

	_, err := claimer.Claim(context.Background())
	if err == nil || errors.Is(err, control.ErrRefused) {
		t.Errorf("expected an ordinary failure, got %v", err)
	}
}

func TestPoolClaimHandsBackTheWorkAndTheRunnerItWasGiven(t *testing.T) {
	claimer := pool(t, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(seatedWith(protocol.Claimed{
			Kind:  protocol.ClaimedCheck,
			Check: &protocol.StackCheck{StackID: "s1", RunID: "run_1"},
		}))
	})

	claimed, err := claimer.Claim(context.Background())
	if err != nil {
		t.Fatalf("claim: %v", err)
	}

	if claimed == nil || claimed.Kind != protocol.ClaimedCheck || claimed.Check.StackID != "s1" {
		t.Fatalf("claimed %+v", claimed)
	}
	seated := claimer.Seated()
	if seated == nil || seated.RunnerID() != "runner_1" || seated.Token() != "run-tok" {
		t.Fatalf("seated %+v", seated)
	}
}

func TestPoolClaimRefusesAnAnswerWithoutARunnerToken(t *testing.T) {
	claimer := pool(t, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(protocol.PoolClaimed{
			RunnerID: "runner_1",
			Work:     protocol.Claimed{Kind: protocol.ClaimedRun, Run: &protocol.Run{ID: "run_1"}},
		})
	})

	if _, err := claimer.Claim(context.Background()); err == nil {
		t.Fatal("expected an error")
	}
	if claimer.Seated() != nil {
		t.Error("should not be seated without a token")
	}
}

func TestPoolTokenIsNeverUsedAfterTheSwap(t *testing.T) {
	var requests seen
	claimer := pool(t, func(w http.ResponseWriter, r *http.Request) {
		requests.note(r)
		switch r.URL.Path {
		case "/api/pools/claim":
			_ = json.NewEncoder(w).Encode(seatedWith(protocol.Claimed{
				Kind: protocol.ClaimedRun,
				Run:  &protocol.Run{ID: "run_1"},
			}))
		case "/api/runs/run_1/lease":
			_, _ = w.Write([]byte(`{"stop":false}`))
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	})

	if _, err := claimer.Claim(context.Background()); err != nil {
		t.Fatalf("claim: %v", err)
	}

	ctx := context.Background()
	seated := claimer.Seated()
	if _, err := seated.RenewLease(ctx, "run_1"); err != nil {
		t.Fatalf("renew lease: %v", err)
	}
	if err := seated.AppendEvents(ctx, "run_1", []protocol.Event{{}}); err != nil {
		t.Fatalf("append events: %v", err)
	}
	if err := seated.Complete(ctx, "run_1", protocol.Completion{}); err != nil {
		t.Fatalf("complete: %v", err)
	}
	if _, err := claimer.Claim(ctx); err == nil {
		t.Error("a pool token claims once; a second claim should be refused")
	}
	if _, err := claimer.Installable(ctx); err == nil {
		t.Error("a swapped pool token should not be asked anything more")
	}

	want := []string{
		"POST /api/pools/claim",
		"POST /api/runs/run_1/lease",
		"POST /api/runs/run_1/events",
		"POST /api/runs/run_1/completion",
	}
	if len(requests.requests) != len(want) {
		t.Fatalf("requests %v", requests.requests)
	}
	for i, request := range want {
		if requests.requests[i] != request {
			t.Errorf("request %d: %q, want %q", i, requests.requests[i], request)
		}
	}
	if requests.bearers[0] != "Bearer pool-tok" {
		t.Errorf("claimed with %q", requests.bearers[0])
	}
	for i, bearer := range requests.bearers[1:] {
		if bearer != "Bearer run-tok" {
			t.Errorf("%s carried %q, want the one-run token", requests.requests[i+1], bearer)
		}
	}
}
