package pool_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/host/internal/pool"
	"usespotlight.ai/data-plane/protocol"
)

func serve(t *testing.T, handle http.HandlerFunc) *pool.Client {
	t.Helper()

	server := httptest.NewServer(handle)
	t.Cleanup(server.Close)

	client, err := pool.New(server.URL, control.Bearer("pool-token"), "host_1")
	if err != nil {
		t.Fatal(err)
	}

	return client
}

func TestClaimOffersTheImagesHarnessesAndTakesTheHandedWork(t *testing.T) {
	var asked protocol.HostClaim
	var path, auth string

	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&asked)
		_ = json.NewEncoder(w).Encode(protocol.Handed{
			RunnerID: "runner_1",
			Token:    "one-run",
			Work:     protocol.Claimed{Kind: protocol.ClaimedRun, Run: &protocol.Run{ID: "run_1"}},
		})
	})

	handed, err := client.Claim(context.Background(), protocol.HostClaim{Image: "ghcr.io/acme/api-runner:main"})
	if err != nil {
		t.Fatalf("claim: %v", err)
	}

	if path != "/api/hosts/claim" || auth != "Bearer pool-token" {
		t.Errorf("asked %s with %q", path, auth)
	}
	if asked.Host != "host_1" || asked.Image != "ghcr.io/acme/api-runner:main" {
		t.Errorf("offered %+v", asked)
	}
	if handed.RunnerID != "runner_1" || handed.Token != "one-run" || handed.Work.Run.ID != "run_1" {
		t.Errorf("handed %+v", handed)
	}
}

func TestClaimTreatsAnEmptyQueueAsOrdinary(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	handed, err := client.Claim(context.Background(), protocol.HostClaim{})
	if err != nil || handed != nil {
		t.Fatalf("got %+v, %v", handed, err)
	}
}

func TestClaimRefusesWorkWithNoCredential(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(protocol.Handed{Work: protocol.Claimed{Kind: protocol.ClaimedRun}})
	})

	if _, err := client.Claim(context.Background(), protocol.HostClaim{}); err == nil {
		t.Fatal("expected work with no credential to be refused")
	}
}

func TestARefusedCredentialSaysSo(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "unknown pool token", http.StatusUnauthorized)
	})

	if _, err := client.Claim(context.Background(), protocol.HostClaim{}); !errors.Is(err, control.ErrRefused) {
		t.Fatalf("expected a refusal, got %v", err)
	}
}

func TestPresenceIsReportedUnderTheHostAndAnswersItsWorkspace(t *testing.T) {
	var method, path string
	var reported protocol.HostPresence

	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		method, path = r.Method, r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&reported)
		_ = json.NewEncoder(w).Encode(protocol.HeartbeatResponse{Workspace: "workspace_1"})
	})

	heartbeat, err := client.Present(context.Background(), protocol.HostPresence{
		Name: "build-box", Capacity: 2, Running: []string{"runner_1"},
	})
	if err != nil {
		t.Fatalf("present: %v", err)
	}

	if method != http.MethodPut || path != "/api/hosts/host_1" {
		t.Errorf("reported with %s %s", method, path)
	}
	if reported.Name != "build-box" || reported.Capacity != 2 || len(reported.Running) != 1 {
		t.Errorf("reported %+v", reported)
	}
	if heartbeat.Workspace != "workspace_1" {
		t.Errorf("heartbeat %+v", heartbeat)
	}
}

func TestLeavingIsSaidUnderTheHost(t *testing.T) {
	var method, path string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		method, path = r.Method, r.URL.Path
		w.WriteHeader(http.StatusNoContent)
	})

	if err := client.Leave(context.Background()); err != nil {
		t.Fatalf("leave: %v", err)
	}
	if method != http.MethodDelete || path != "/api/hosts/host_1" {
		t.Errorf("left with %s %s", method, path)
	}
}

func TestClaimCallNamesThisHostAndAnswerCallAnswersIt(t *testing.T) {
	var paths []string
	var asked protocol.HostCallClaim
	var answered protocol.HostCallAnswer
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		if r.URL.Path == "/api/hosts/calls/claim" {
			_ = json.NewDecoder(r.Body).Decode(&asked)
			_ = json.NewEncoder(w).Encode(protocol.HostCall{ID: "call_1", URL: "https://audit.acme.internal/"})
			return
		}
		_ = json.NewDecoder(r.Body).Decode(&answered)
		w.WriteHeader(http.StatusNoContent)
	})

	call, err := client.ClaimCall(context.Background())
	if err != nil || call.ID != "call_1" || asked.Host != "host_1" {
		t.Fatalf("claimed %+v as %+v: %v", call, asked, err)
	}
	if err := client.AnswerCall(context.Background(), call.ID, protocol.HostCallAnswer{Status: 204}); err != nil {
		t.Fatal(err)
	}
	if len(paths) != 2 || paths[1] != "/api/hosts/calls/call_1/answer" {
		t.Errorf("asked %v", paths)
	}
	if answered.Host != "host_1" || answered.Status != 204 {
		t.Errorf("answered as %+v, not as the host that claimed it", answered)
	}
}
