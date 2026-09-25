package control_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
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

func TestAsksForTheWorkspaceToRestoreAndHearsWhenThereIsNone(t *testing.T) {
	var asked string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		asked = r.Method + " " + r.URL.Path
		if strings.HasSuffix(r.URL.Path, "/run_2/workspace-archive") {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		_ = json.NewEncoder(w).Encode(protocol.HeldArchive{ID: "archive_1", URL: "https://storage.test/a", Size: 12, SHA256: "ab"})
	})

	held, err := client.WorkspaceArchive(context.Background(), "run_1")
	if err != nil || held == nil || held.ID != "archive_1" || held.Size != 12 {
		t.Fatalf("held %+v, %v", held, err)
	}
	if asked != "GET /api/runs/run_1/workspace-archive" {
		t.Errorf("asked %s", asked)
	}

	none, err := client.WorkspaceArchive(context.Background(), "run_2")
	if err != nil || none != nil {
		t.Errorf("expected nothing to restore, got %+v, %v", none, err)
	}
}

func TestAsksToKeepTheWorkspaceThenSealsIt(t *testing.T) {
	var calls []string
	var asked protocol.ArchiveRequest
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		if r.URL.Path == "/api/runs/run_1/workspace-archive" {
			_ = json.NewDecoder(r.Body).Decode(&asked)
			_ = json.NewEncoder(w).Encode(protocol.ArchiveGrant{
				ID: "archive_1", URL: "https://storage.test/put", Headers: map[string]string{"content-type": "application/gzip"},
			})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	grant, err := client.GrantArchive(context.Background(), "run_1", 42, "ab")
	if err != nil || grant.ID != "archive_1" || grant.Headers["content-type"] != "application/gzip" {
		t.Fatalf("grant %+v, %v", grant, err)
	}
	if asked.Size != 42 || asked.SHA256 != "ab" {
		t.Errorf("asked for %+v", asked)
	}

	if err := client.SealArchive(context.Background(), "run_1", grant.ID); err != nil {
		t.Fatalf("seal: %v", err)
	}
	if calls[1] != "POST /api/runs/run_1/workspace-archive/archive_1/sealed" {
		t.Errorf("sealed with %s", calls[1])
	}
}

func TestSaysWhyTheWorkspaceCannotBeKept(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"message":"A workspace archive cannot be kept, because this deployment has nowhere to keep one"}`, http.StatusUnprocessableEntity)
	})

	_, err := client.GrantArchive(context.Background(), "run_1", 42, "ab")
	if err == nil || !strings.Contains(err.Error(), "nowhere to keep one") {
		t.Errorf("err %v", err)
	}
}

func TestARejectionCarriesTheReasonTheControlPlaneGave(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"reason":"host-taken","message":"serving elsewhere"}`))
	})

	_, err := client.Request(context.Background(), http.MethodPut, "/api/hosts/x", nil, nil)

	if !control.Rejected(err, "host-taken") || control.Rejected(err, "host-unreported") {
		t.Fatalf("got %v", err)
	}
	if errors.Is(err, control.ErrRefused) {
		t.Error("a conflict read as a refused credential")
	}
}
