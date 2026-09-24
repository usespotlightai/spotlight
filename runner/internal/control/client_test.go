package control_test

import (
	"bytes"
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

	if err := client.Register(context.Background(), protocol.Registration{}); err != nil {
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
		if r.URL.Path == "/api/runners/register" {
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

func TestClaimReturnsTheRun(t *testing.T) {
	var claimPath string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/runners/register" {
			_ = json.NewEncoder(w).Encode(protocol.Registered{RunnerID: "runner_1"})
			return
		}
		claimPath = r.URL.Path
		_ = json.NewEncoder(w).Encode(protocol.Claimed{
			Kind: protocol.ClaimedRun,
			Run:  &protocol.Run{ID: "run_1"},
		})
	})

	if err := client.Register(context.Background(), protocol.Registration{}); err != nil {
		t.Fatalf("register: %v", err)
	}

	claimed, err := client.Claim(context.Background())
	if err != nil {
		t.Fatalf("claim: %v", err)
	}
	if claimed == nil || claimed.Kind != protocol.ClaimedRun || claimed.Run.ID != "run_1" {
		t.Fatalf("claimed %+v", claimed)
	}
	if claimPath != "/api/runners/claim" {
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

	_, err := client.RenewLease(context.Background(), "run_1")
	if err == nil {
		t.Fatal("expected an error")
	}
	for _, want := range []string{"409", "lease expired"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q", err, want)
		}
	}
}

func TestRenewLeaseReadsBackAStopRequest(t *testing.T) {
	var asked string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		asked = r.URL.Path
		_, _ = w.Write([]byte(`{"stop":true}`))
	})

	stop, err := client.RenewLease(context.Background(), "run_1")
	if err != nil {
		t.Fatalf("renew: %v", err)
	}
	if !stop {
		t.Error("expected the renewal to report a stop")
	}
	if asked != "/api/runs/run_1/lease" {
		t.Errorf("asked %q", asked)
	}
}

func TestRenewLeaseCarriesOnWhenNoStopIsAsked(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"stop":false}`))
	})

	stop, err := client.RenewLease(context.Background(), "run_1")
	if err != nil {
		t.Fatalf("renew: %v", err)
	}
	if stop {
		t.Error("no stop was asked, yet one was reported")
	}
}

func TestKeptAnswersWithWhatToHoldOnTo(t *testing.T) {
	var asked string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		asked = r.URL.Path
		_ = json.NewEncoder(w).Encode(protocol.Kept{
			Keys: []string{"task_1-station_2"},
		})
	})

	keys, err := client.Kept(context.Background())
	if err != nil {
		t.Fatalf("kept: %v", err)
	}

	if asked != "/api/runners/workspaces" {
		t.Errorf("asked %q", asked)
	}
	if len(keys) != 1 || keys[0] != "task_1-station_2" {
		t.Errorf("kept %v", keys)
	}
}

func TestAttachmentFetchesTheFileItself(t *testing.T) {
	var asked, auth string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		asked = r.URL.EscapedPath()
		auth = r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"not": "decoded"`))
	})

	var fetched bytes.Buffer
	if err := client.Attachment(context.Background(), "run_1", "att/1", &fetched); err != nil {
		t.Fatalf("attachment: %v", err)
	}

	if asked != "/api/runs/run_1/attachments/att%2F1" {
		t.Errorf("asked %q", asked)
	}
	if auth != "Bearer tok" {
		t.Errorf("authorization %q", auth)
	}
	if fetched.String() != `{"not": "decoded"` {
		t.Errorf("fetched %q", fetched.String())
	}
}

func TestAttachmentThatIsNotThereWritesNothing(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "no such attachment", http.StatusNotFound)
	})

	var fetched bytes.Buffer
	err := client.Attachment(context.Background(), "run_1", "att_1", &fetched)

	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("expected a 404, got %v", err)
	}
	if fetched.Len() != 0 {
		t.Errorf("wrote %q", fetched.String())
	}
}

func TestKeptFailsRatherThanAnsweringEmpty(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	keys, err := client.Kept(context.Background())

	if err == nil {
		t.Fatalf("a failed request answered with %v", keys)
	}
	if keys != nil {
		t.Errorf("a failed request answered with %v", keys)
	}
}

func TestUseToolCarriesTheInputWholeAndAnswersWithWhatCameBack(t *testing.T) {
	var path, carried string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		body := new(bytes.Buffer)
		_, _ = body.ReadFrom(r.Body)
		carried = body.String()
		_, _ = w.Write([]byte(`{"url":"https://github.com/acme/widgets/pull/7"}`))
	})

	answer, err := client.UseTool(
		context.Background(), "run_1", "pull-request",
		json.RawMessage(`{"title":"Fix the queue"}`),
	)
	if err != nil {
		t.Fatalf("use tool: %v", err)
	}

	if path != "/api/runs/run_1/tools/pull-request" {
		t.Errorf("path %q, want the tool named in it", path)
	}
	if carried != `{"title":"Fix the queue"}` {
		t.Errorf("carried %s, want the input whole", carried)
	}
	if strings.TrimSpace(string(answer)) != `{"url":"https://github.com/acme/widgets/pull/7"}` {
		t.Errorf("answer %s, want what came back whole", answer)
	}
}

func TestUseToolSaysWhichToolTheControlPlaneRefused(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"message":"pull-request needs a title"}`, http.StatusUnprocessableEntity)
	})

	_, err := client.UseTool(context.Background(), "run_1", "pull-request", json.RawMessage(`{}`))

	if err == nil || !strings.Contains(err.Error(), "use pull-request") {
		t.Fatalf("err = %v, want it to name the tool", err)
	}
}

func TestClaimReadsAChangeStackCheck(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/runners/register" {
			_ = json.NewEncoder(w).Encode(protocol.Registered{RunnerID: "runner_1"})
			return
		}
		_, _ = w.Write([]byte(`{"kind":"check","run":null,"check":{"stackId":"s1","runId":"run_1","repository":"widgets","base":"abc","setup":"npm ci","command":"npm test","steps":[{"id":"whole","patch":"diff","stopsOnFailure":true}]}}`))
	})

	if err := client.Register(context.Background(), protocol.Registration{}); err != nil {
		t.Fatalf("register: %v", err)
	}

	claimed, err := client.Claim(context.Background())
	if err != nil {
		t.Fatalf("claim: %v", err)
	}

	if claimed == nil || claimed.Kind != protocol.ClaimedCheck || claimed.Check == nil {
		t.Fatalf("claimed %+v", claimed)
	}
	check := claimed.Check
	if check.StackID != "s1" || check.Repository != "widgets" || check.Base != "abc" || check.Setup != "npm ci" {
		t.Errorf("check %+v", check)
	}
	if len(check.Steps) != 1 || !check.Steps[0].StopsOnFailure {
		t.Errorf("steps %+v", check.Steps)
	}
}

func TestDraftChangeStackHandsOverTheDiffOfOneCheckout(t *testing.T) {
	var seenPath string
	var seen protocol.ChangeStackDraft
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		seenPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&seen)
		w.WriteHeader(http.StatusNoContent)
	})

	if err := client.DraftChangeStack(context.Background(), "run_1", "widgets", "diff --git a b", "0123456789abcdef0123456789abcdef01234567"); err != nil {
		t.Fatalf("draft: %v", err)
	}

	if seenPath != "/api/runs/run_1/change-stacks" {
		t.Errorf("path %q", seenPath)
	}
	if seen.Repository != "widgets" || seen.Diff != "diff --git a b" ||
		seen.Base != "0123456789abcdef0123456789abcdef01234567" {
		t.Errorf("seen %+v", seen)
	}
}

func TestRecordChangeStackCheckPostsEachStep(t *testing.T) {
	var seenPath string
	var seen protocol.StackChecked
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		seenPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&seen)
		w.WriteHeader(http.StatusNoContent)
	})

	err := client.RecordChangeStackCheck(context.Background(), "run_1", "s1", protocol.StackChecked{
		Steps: []protocol.CheckedStep{{Step: "whole", Passed: true, Output: "ok", TookMs: 12}},
	})
	if err != nil {
		t.Fatalf("record: %v", err)
	}

	if seenPath != "/api/runs/run_1/change-stack-checks/s1" {
		t.Errorf("path %q", seenPath)
	}
	if len(seen.Steps) != 1 || !seen.Steps[0].Passed || seen.Skipped != nil {
		t.Errorf("seen %+v", seen)
	}
}

func TestAskPermissionPostsWhatWasAskedAndReadsTheDecision(t *testing.T) {
	var seenPath, seenMethod, carried string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		seenPath, seenMethod = r.URL.Path, r.Method
		body := new(bytes.Buffer)
		_, _ = body.ReadFrom(r.Body)
		carried = body.String()
		_, _ = w.Write([]byte(`{"decision":"asked"}`))
	})

	answer, err := client.AskPermission(context.Background(), "run_1", protocol.PermissionAsked{
		SessionID: "sess-1",
		Kind:      "execute",
		Title:     "`rm -rf build`",
		Input:     json.RawMessage(`{"command":"rm -rf build"}`),
	})
	if err != nil {
		t.Fatalf("ask: %v", err)
	}

	if seenMethod != http.MethodPost || seenPath != "/api/runs/run_1/permissions" {
		t.Errorf("%s %s", seenMethod, seenPath)
	}
	want := `{"sessionId":"sess-1","kind":"execute","title":"` + "`rm -rf build`" + `","input":{"command":"rm -rf build"}}`
	if carried != want {
		t.Errorf("carried %s, want %s", carried, want)
	}
	if answer.Decision != protocol.PermissionPutToPerson {
		t.Errorf("decision %q", answer.Decision)
	}
}

func TestAskPermissionLeavesOutAnInputThereWasNone(t *testing.T) {
	var seen map[string]any
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&seen)
		_, _ = w.Write([]byte(`{"decision":"allow"}`))
	})

	answer, err := client.AskPermission(context.Background(), "run_1", protocol.PermissionAsked{SessionID: "sess-1"})
	if err != nil {
		t.Fatalf("ask: %v", err)
	}

	if _, carried := seen["input"]; carried {
		t.Errorf("carried an input: %v", seen)
	}
	if answer.Decision != protocol.PermissionAllow {
		t.Errorf("decision %q", answer.Decision)
	}
}

func TestAskPermissionFailsRatherThanDecidingOnItsOwn(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "no such run", http.StatusNotFound)
	})

	answer, err := client.AskPermission(context.Background(), "run_1", protocol.PermissionAsked{})

	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("expected a 404, got %v", err)
	}
	if answer.Decision != "" {
		t.Errorf("decided %q without an answer", answer.Decision)
	}
}
