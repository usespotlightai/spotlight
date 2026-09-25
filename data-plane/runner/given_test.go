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

func handedFile(t *testing.T, handed protocol.Handed) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "handed.json")
	raw, _ := json.Marshal(handed)
	if err := os.WriteFile(path, raw, 0o400); err != nil {
		t.Fatal(err)
	}

	return path
}

func TestTakesTheWorkItWasHandedAndLeavesNoCredentialBehind(t *testing.T) {
	path := handedFile(t, protocol.Handed{
		RunnerID: "runner_1",
		Token:    "one-run",
		Work:     protocol.Claimed{Kind: protocol.ClaimedRun, Run: &protocol.Run{ID: "run_1"}},
	})

	handed, err := given(context.Background(), config.Config{Handed: path}, "test", quiet)
	if err != nil {
		t.Fatalf("given: %v", err)
	}

	if handed.RunnerID != "runner_1" || handed.Token != "one-run" || handed.Work.Run.ID != "run_1" {
		t.Errorf("handed %+v", handed)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the handed file is still there: %v", err)
	}
}

func TestRefusesHandedWorkWithoutACredential(t *testing.T) {
	path := handedFile(t, protocol.Handed{RunnerID: "runner_1"})

	if _, err := given(context.Background(), config.Config{Handed: path}, "test", quiet); err == nil ||
		!strings.Contains(err.Error(), "credential") {
		t.Fatalf("expected a refusal, got %v", err)
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
			_ = json.NewEncoder(w).Encode([]protocol.Installable{})
		case "/api/runners/register":
			_ = json.NewDecoder(r.Body).Decode(&registered)
			_ = json.NewEncoder(w).Encode(protocol.Registered{RunnerID: "runner_9"})
		case "/api/runners/claim":
			if polls.Add(1) == 1 {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			_ = json.NewEncoder(w).Encode(protocol.Claimed{
				Kind: protocol.ClaimedRun, Run: &protocol.Run{ID: "run_7"},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	handed, err := given(context.Background(), config.Config{URL: server.URL, Token: "one-run"}, "test", quiet)
	if err != nil {
		t.Fatalf("given: %v", err)
	}

	if handed == nil || handed.RunnerID != "runner_9" || handed.Work.Run.ID != "run_7" {
		t.Fatalf("handed %+v", handed)
	}
	if polls.Load() != 2 {
		t.Errorf("claimed %d times, want 2", polls.Load())
	}
}

func TestReportsTheHarnessesItFindsInItsImage(t *testing.T) {
	asked := `[{"id":"sh","executable":"sh"},{"id":"absent","executable":"no-such-harness"}]`
	out := new(strings.Builder)

	if err := report(asked, "20260925-01", out); err != nil {
		t.Fatalf("report: %v", err)
	}

	var reported protocol.Registration
	if err := json.Unmarshal([]byte(out.String()), &reported); err != nil {
		t.Fatalf("decode %q: %v", out.String(), err)
	}
	if reported.Release != "20260925-01" || len(reported.Harnesses) != 1 || reported.Harnesses[0].ID != "sh" {
		t.Errorf("reported %+v", reported)
	}
}
