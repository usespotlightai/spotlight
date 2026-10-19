package runner

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/config"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func assignmentFile(t *testing.T, assigned protocol.Assignment) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "assignment.json")
	raw, _ := json.Marshal(assigned)
	if err := os.WriteFile(path, raw, 0o400); err != nil {
		t.Fatal(err)
	}

	return path
}

func TestReadsItsAssignmentAndLeavesNoCredentialBehind(t *testing.T) {
	path := assignmentFile(t, protocol.Assignment{
		RunnerID: "runner_1",
		Token:    "one-run",
		Work:     protocol.ClaimResponse{Kind: protocol.ClaimedRun, Run: &protocol.Run{ID: "run_1"}},
	})

	assigned, err := assignment(context.Background(), config.Config{AssignmentFile: path}, "test", nil, quiet)
	if err != nil {
		t.Fatalf("assignment: %v", err)
	}

	if assigned.RunnerID != "runner_1" || assigned.Token != "one-run" || assigned.Work.Run.ID != "run_1" {
		t.Errorf("assigned %+v", assigned)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the assignment file is still there: %v", err)
	}
}

func TestRejectsAnAssignmentWithoutACredential(t *testing.T) {
	path := assignmentFile(t, protocol.Assignment{RunnerID: "runner_1"})

	if _, err := assignment(context.Background(), config.Config{AssignmentFile: path}, "test", nil, quiet); err == nil ||
		!strings.Contains(err.Error(), "credential") {
		t.Fatalf("expected an error, got %v", err)
	}
}

func TestAPushRunnerRegistersThenClaimsWhatWasReservedForIt(t *testing.T) {
	var polls atomic.Int32
	var registered protocol.Registration

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer one-run" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		switch r.URL.Path {
		case "/api/runners/harnesses":
			_ = json.NewEncoder(w).Encode([]protocol.HarnessProbe{})
		case "/api/runners/register":
			_ = json.NewDecoder(r.Body).Decode(&registered)
			_ = json.NewEncoder(w).Encode(protocol.RegisterResponse{RunnerID: "runner_9"})
		case "/api/runners/claim":
			if polls.Add(1) == 1 {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			_ = json.NewEncoder(w).Encode(protocol.ClaimResponse{
				Kind: protocol.ClaimedRun, Run: &protocol.Run{ID: "run_7"},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	assigned, err := assignment(context.Background(), config.Config{URL: server.URL, Token: "one-run"}, "test", nil, quiet)
	if err != nil {
		t.Fatalf("assignment: %v", err)
	}

	if assigned == nil || assigned.RunnerID != "runner_9" || assigned.Work.Run.ID != "run_7" {
		t.Fatalf("assigned %+v", assigned)
	}
	if polls.Load() != 2 {
		t.Errorf("claimed %d times, want 2", polls.Load())
	}
}

func TestReportsTheHarnessesItFindsInItsImage(t *testing.T) {
	received := `[{"id":"sh","executable":"sh"},{"id":"absent","executable":"no-such-harness"}]`
	out := new(strings.Builder)

	if err := report(received, "v0.3.0", out); err != nil {
		t.Fatalf("report: %v", err)
	}

	var reported protocol.Registration
	if err := json.Unmarshal([]byte(out.String()), &reported); err != nil {
		t.Fatalf("decode %q: %v", out.String(), err)
	}
	if reported.Release != "v0.3.0" || len(reported.Harnesses) != 1 || reported.Harnesses[0].ID != "sh" {
		t.Errorf("reported %+v", reported)
	}
}
