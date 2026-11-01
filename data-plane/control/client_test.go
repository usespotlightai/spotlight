package control_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/telemetry"
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

func TestNewRejectsAnAddressItCannotCall(t *testing.T) {
	for _, bad := range []string{"", "localhost:3000", "/api"} {
		if _, err := control.New(bad, "tok"); err == nil {
			t.Errorf("%q should be rejected", bad)
		}
	}
}

func TestRegisterCarriesTheBearerTokenAndKeepsTheId(t *testing.T) {
	var seenAuth string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		seenAuth = r.Header.Get("Authorization")
		_ = json.NewEncoder(w).Encode(protocol.RegisterResponse{RunnerID: "runner_1"})
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

func TestRegisterRejectsAnAnswerWithoutAnId(t *testing.T) {
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
			_ = json.NewEncoder(w).Encode(protocol.RegisterResponse{RunnerID: "runner_1"})
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
			_ = json.NewEncoder(w).Encode(protocol.RegisterResponse{RunnerID: "runner_1"})
			return
		}
		claimPath = r.URL.Path
		_ = json.NewEncoder(w).Encode(protocol.ClaimResponse{
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

func TestAppendEventsSendsNothingWhenThereIsNothingToSend(t *testing.T) {
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
	var received string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		received = r.URL.Path
		_, _ = w.Write([]byte(`{"stop":true}`))
	})

	stop, err := client.RenewLease(context.Background(), "run_1")
	if err != nil {
		t.Fatalf("renew: %v", err)
	}
	if !stop {
		t.Error("expected the renewal to report a stop")
	}
	if received != "/api/runs/run_1/lease" {
		t.Errorf("received %q", received)
	}
}

func TestRenewLeaseCarriesOnWhenNoStopIsRequested(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"stop":false}`))
	})

	stop, err := client.RenewLease(context.Background(), "run_1")
	if err != nil {
		t.Fatalf("renew: %v", err)
	}
	if stop {
		t.Error("no stop was requested, yet one was reported")
	}
}

func TestAttachmentFetchesTheFileItself(t *testing.T) {
	var received, auth string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		received = r.URL.EscapedPath()
		auth = r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"not": "decoded"`))
	})

	var fetched bytes.Buffer
	if err := client.Attachment(context.Background(), "run_1", "att/1", &fetched); err != nil {
		t.Fatalf("attachment: %v", err)
	}

	if received != "/api/runs/run_1/attachments/att%2F1" {
		t.Errorf("received %q", received)
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

func TestUseToolSaysWhichToolTheControlPlaneRejected(t *testing.T) {
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
			_ = json.NewEncoder(w).Encode(protocol.RegisterResponse{RunnerID: "runner_1"})
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

func TestGenerateChangeStackHandsOverTheDiffOfOneCheckout(t *testing.T) {
	var seenPath string
	var seen protocol.ChangeStackGenerationRequest
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		seenPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&seen)
		w.WriteHeader(http.StatusNoContent)
	})

	if err := client.GenerateChangeStack(context.Background(), "run_1", "widgets", "diff --git a b", "0123456789abcdef0123456789abcdef01234567"); err != nil {
		t.Fatalf("generate: %v", err)
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
	var seen protocol.StackCheckResult
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		seenPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&seen)
		w.WriteHeader(http.StatusNoContent)
	})

	err := client.RecordChangeStackCheck(context.Background(), "run_1", "s1", false, protocol.StackCheckResult{
		Steps: []protocol.CheckStepResult{{Step: "whole", Passed: true, Output: "ok", DurationMs: 12}},
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

func TestRenewCheckLeaseReadsBackWhetherToStop(t *testing.T) {
	var received, method string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		received, method = r.URL.EscapedPath(), r.Method
		_, _ = w.Write([]byte(`{"stop":true}`))
	})

	stop, err := client.RenewCheckLease(context.Background(), "run_1", "stack/1", false)
	if err != nil {
		t.Fatalf("renew: %v", err)
	}
	if !stop {
		t.Error("expected the renewal to say the check should stop")
	}
	if method != http.MethodPost || received != "/api/runs/run_1/change-stack-checks/stack%2F1/lease" {
		t.Errorf("received %s %q", method, received)
	}
}

func TestRecheckCallsNameTheRecheck(t *testing.T) {
	var received []string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		received = append(received, r.URL.Path+"?"+r.URL.RawQuery)
		if strings.HasSuffix(r.URL.Path, "/lease") {
			_, _ = w.Write([]byte(`{"stop":false}`))
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	if _, err := client.RenewCheckLease(context.Background(), "run_1", "stack_1", true); err != nil {
		t.Fatalf("renew: %v", err)
	}
	if err := client.RecordChangeStackCheck(context.Background(), "run_1", "stack_1", true, protocol.StackCheckResult{}); err != nil {
		t.Fatalf("record: %v", err)
	}

	want := []string{
		"/api/runs/run_1/change-stack-checks/stack_1/lease?recheck=true",
		"/api/runs/run_1/change-stack-checks/stack_1?recheck=true",
	}
	if strings.Join(received, " ") != strings.Join(want, " ") {
		t.Errorf("received %q", received)
	}
}

func TestRenewCheckLeaseCarriesOnWhileTheRunnerHasTheLease(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"stop":false}`))
	})

	stop, err := client.RenewCheckLease(context.Background(), "run_1", "stack_1", false)
	if err != nil {
		t.Fatalf("renew: %v", err)
	}
	if stop {
		t.Error("the runner still has the lease on the check, yet a stop was reported")
	}
}

func TestRenewCheckLeaseRejectedWhenTheRunnerHasNoLease(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"reason":"conflict","message":"Change stack stack_1 is not being checked by that runner"}`))
	})

	_, err := client.RenewCheckLease(context.Background(), "run_1", "stack_1", false)

	var rejection *control.ResponseError
	if !errors.As(err, &rejection) || rejection.Status != http.StatusConflict {
		t.Fatalf("err %v", err)
	}
}

func TestAskPermissionPostsWhatWasAskedAndReadsTheDecision(t *testing.T) {
	var seenPath, seenMethod, carried string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		seenPath, seenMethod = r.URL.Path, r.Method
		body := new(bytes.Buffer)
		_, _ = body.ReadFrom(r.Body)
		carried = body.String()
		_, _ = w.Write([]byte(`{"decision":"pending"}`))
	})

	answer, err := client.AskPermission(context.Background(), "run_1", protocol.PermissionRequest{
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
	if answer.Decision != protocol.PermissionPending {
		t.Errorf("decision %q", answer.Decision)
	}
}

func TestAskPermissionLeavesOutAnInputThereWasNone(t *testing.T) {
	var seen map[string]any
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&seen)
		_, _ = w.Write([]byte(`{"decision":"allow"}`))
	})

	answer, err := client.AskPermission(context.Background(), "run_1", protocol.PermissionRequest{SessionID: "sess-1"})
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

	answer, err := client.AskPermission(context.Background(), "run_1", protocol.PermissionRequest{})

	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("expected a 404, got %v", err)
	}
	if answer.Decision != "" {
		t.Errorf("decided %q without an answer", answer.Decision)
	}
}

func TestReadsTheWorkspaceToRestoreAndLearnsWhenThereIsNone(t *testing.T) {
	var received string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		received = r.Method + " " + r.URL.Path
		if strings.HasSuffix(r.URL.Path, "/run_2/workspace-archive") {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		_ = json.NewEncoder(w).Encode(protocol.StoredArchive{ID: "archive_1", URL: "https://storage.test/a", Size: 12, SHA256: "ab"})
	})

	stored, err := client.WorkspaceArchive(context.Background(), "run_1")
	if err != nil || stored == nil || stored.ID != "archive_1" || stored.Size != 12 {
		t.Fatalf("stored %+v, %v", stored, err)
	}
	if received != "GET /api/runs/run_1/workspace-archive" {
		t.Errorf("received %s", received)
	}

	none, err := client.WorkspaceArchive(context.Background(), "run_2")
	if err != nil || none != nil {
		t.Errorf("expected nothing to restore, got %+v, %v", none, err)
	}
}

func TestRequestsAWorkspaceArchiveThenCompletesIt(t *testing.T) {
	var calls []string
	var received protocol.ArchiveRequest
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		if r.URL.Path == "/api/runs/run_1/workspace-archive" {
			_ = json.NewDecoder(r.Body).Decode(&received)
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
	if received.Size != 42 || received.SHA256 != "ab" {
		t.Errorf("received %+v", received)
	}

	if err := client.CompleteArchive(context.Background(), "run_1", grant.ID); err != nil {
		t.Fatalf("complete: %v", err)
	}
	if calls[1] != "POST /api/runs/run_1/workspace-archive/archive_1/complete" {
		t.Errorf("completed with %s", calls[1])
	}
}

func TestSaysWhereTheRunStartedNamingAnArchiveOrNone(t *testing.T) {
	var path string
	var bodies []string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		path = r.Method + " " + r.URL.Path
		body, _ := io.ReadAll(r.Body)
		bodies = append(bodies, string(body))
		w.WriteHeader(http.StatusNoContent)
	})

	archive := "archive_1"
	checkouts := []protocol.StartedCheckout{{Path: "api", Commit: strings.Repeat("a", 40)}}

	if err := client.RecordStartingPoint(context.Background(), "run_1", protocol.StartingPoint{Attempt: 1, ArchiveID: &archive, Checkouts: checkouts}); err != nil {
		t.Fatalf("record: %v", err)
	}
	if err := client.RecordStartingPoint(context.Background(), "run_1", protocol.StartingPoint{Attempt: 2, Checkouts: []protocol.StartedCheckout{}}); err != nil {
		t.Fatalf("record afresh: %v", err)
	}

	if path != "POST /api/runs/run_1/starting-point" {
		t.Errorf("said it at %s", path)
	}
	want := []string{
		`{"attempt":1,"archiveId":"archive_1","checkouts":[{"path":"api","commit":"` + strings.Repeat("a", 40) + `"}]}`,
		`{"attempt":2,"archiveId":null,"checkouts":[]}`,
	}
	for at, body := range bodies {
		if strings.TrimSpace(body) != want[at] {
			t.Errorf("said %s, want %s", body, want[at])
		}
	}
}

func TestSaysWhyTheWorkspaceCannotBeArchived(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"message":"A workspace archive cannot be stored, because this deployment has nowhere to store one"}`, http.StatusUnprocessableEntity)
	})

	_, err := client.GrantArchive(context.Background(), "run_1", 42, "ab")
	if err == nil || !strings.Contains(err.Error(), "nowhere to store one") {
		t.Errorf("err %v", err)
	}
}

func TestARejectionCarriesTheReasonTheControlPlaneSent(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"reason":"host-in-use","message":"serving elsewhere"}`))
	})

	_, err := client.Request(context.Background(), http.MethodPut, "/api/hosts/x", nil, nil)

	if !control.HasReason(err, "host-in-use") || control.HasReason(err, "host-unreported") {
		t.Fatalf("got %v", err)
	}
	if errors.Is(err, control.ErrUnauthorized) {
		t.Error("a conflict read as an unauthorized credential")
	}
}

type trusted struct{}

func (trusted) Authorize(request *http.Request) error {
	request.Header.Set("Authorization", "Bearer workload-token")
	request.Header.Set(protocol.TrustHeader, "trust_1")
	return nil
}

func TestClaimCallNamesTheHostAndTakesTheCall(t *testing.T) {
	var path, auth string
	var received protocol.HostCallClaim
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&received)
		_ = json.NewEncoder(w).Encode(protocol.HostCall{
			ID: "call_1", Method: http.MethodPost, URL: "https://audit.acme.internal/", Body: "e30=", TimeoutMs: 10000,
		})
	})

	call, err := client.ClaimCall(context.Background(), "host_1")
	if err != nil {
		t.Fatal(err)
	}
	if path != "/api/hosts/calls/claim" || auth != "Bearer tok" || received.Host != "host_1" {
		t.Errorf("received %s with %q for %+v", path, auth, received)
	}
	if call.ID != "call_1" || call.URL != "https://audit.acme.internal/" || call.TimeoutMs != 10000 {
		t.Errorf("claimed %+v", call)
	}
}

func TestClaimCallTreatsNoCallAsOrdinary(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	call, err := client.ClaimCall(context.Background(), "host_1")
	if err != nil || call != nil {
		t.Fatalf("got %+v, %v", call, err)
	}
}

func TestClaimCallGoesThroughATrustLikeAnyHostClaim(t *testing.T) {
	var auth, trust string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth, trust = r.Header.Get("Authorization"), r.Header.Get(protocol.TrustHeader)
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(server.Close)

	client, err := control.Authorized(server.URL, trusted{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.ClaimCall(context.Background(), "host_1"); err != nil {
		t.Fatal(err)
	}
	if auth != "Bearer workload-token" || trust != "trust_1" {
		t.Errorf("claimed with %q through %q", auth, trust)
	}
}

func TestClaimCallTellsAnUnauthorizedCredentialAndAnUnreportedHost(t *testing.T) {
	unauthorized := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "no", http.StatusUnauthorized)
	})
	if _, err := unauthorized.ClaimCall(context.Background(), "host_1"); !errors.Is(err, control.ErrUnauthorized) {
		t.Errorf("an unauthorized credential came back as %v", err)
	}

	unreported := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"reason":"host-unreported"}`))
	})
	if _, err := unreported.ClaimCall(context.Background(), "host_1"); !control.HasReason(err, "host-unreported") {
		t.Errorf("an unreported host came back as %v", err)
	}
}

func TestClaimCallRejectsACallWithNoAddress(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(protocol.HostCall{ID: "call_1"})
	})

	if _, err := client.ClaimCall(context.Background(), "host_1"); err == nil {
		t.Fatal("claimed a call with nowhere to send it")
	}
}

func TestRecordCallResponsePostsTheResponseOfTheCall(t *testing.T) {
	var path string
	var recorded protocol.HostCallResponse
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&recorded)
		w.WriteHeader(http.StatusNoContent)
	})

	response := protocol.HostCallResponse{Status: 200, Headers: map[string]string{"content-type": "application/json"}, Body: "e30=", Ms: 12}
	if err := client.RecordCallResponse(context.Background(), "call_1", response); err != nil {
		t.Fatal(err)
	}
	if path != "/api/hosts/calls/call_1/response" || recorded.Status != 200 || recorded.Body != "e30=" || recorded.Ms != 12 {
		t.Errorf("recorded %s with %+v", path, recorded)
	}
}

func TestRecordCallResponseTellsACallAlreadyAnswered(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"reason":"call-answered"}`))
	})

	err := client.RecordCallResponse(context.Background(), "call_1", protocol.HostCallResponse{Error: "timed out after 10s"})
	var rejection *control.ResponseError
	if !errors.As(err, &rejection) || rejection.Status != http.StatusConflict {
		t.Errorf("recorded with %v", err)
	}
}

func TestRecallsByWordsAndByHandle(t *testing.T) {
	var received []string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		received = append(received, strings.TrimSpace(r.Method+" "+r.URL.RequestURI()+" "+string(body)))
		_, _ = w.Write([]byte(`[]`))
	})

	if _, err := client.RecallMemories(context.Background(), "run_1", "upload retries"); err != nil {
		t.Fatal(err)
	}
	if _, err := client.RecallMemory(context.Background(), "run_1", "M-12"); err != nil {
		t.Fatal(err)
	}

	want := []string{
		`POST /api/runs/run_1/memories/recall {"words":"upload retries"}`,
		"POST /api/runs/run_1/memories/M-12/recall",
	}
	if strings.Join(received, "\n") != strings.Join(want, "\n") {
		t.Errorf("received %v", received)
	}
}

func TestARejectedMemorySaysWhySpotlightRejectedIt(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"message":"A memory is one of rationale, not gossip","error":"Unprocessable Entity","statusCode":422}`))
	})

	_, err := client.Remember(context.Background(), "run_1", protocol.RememberRequest{Kind: "gossip", Body: "x"})

	var rejection *control.ResponseError
	if !errors.As(err, &rejection) {
		t.Fatalf("got %v", err)
	}
	if message, ok := rejection.ClientErrorMessage(); !ok || message != "A memory is one of rationale, not gossip" {
		t.Errorf("rejected with %q, %v", message, ok)
	}
}

func TestAnUnreachableSpotlightIsNoClientError(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"message":"upstream down"}`))
	})

	_, err := client.Remember(context.Background(), "run_1", protocol.RememberRequest{Kind: "rationale", Body: "x"})

	var rejection *control.ResponseError
	if errors.As(err, &rejection) {
		if _, ok := rejection.ClientErrorMessage(); ok {
			t.Error("a 502 should not read as a client error")
		}
	}
}

func TestReadsTheMemoryFilesOfARun(t *testing.T) {
	var received string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		received = r.Method + " " + r.URL.RequestURI()
		_, _ = w.Write([]byte(`[{"path":".spotlight/memory/team/M-1.md","body":"# M-1"}]`))
	})

	files, err := client.MemoryFiles(context.Background(), "run_1")
	if err != nil {
		t.Fatal(err)
	}

	if received != "GET /api/runs/run_1/memory-files" || len(files) != 1 || files[0].Body != "# M-1" {
		t.Errorf("received %s, got %+v", received, files)
	}
}

func TestCompleteReportsTheTurn(t *testing.T) {
	var received string
	var sent protocol.Completion
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		received = r.Method + " " + r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&sent)
		w.WriteHeader(http.StatusNoContent)
	})

	if err := client.Complete(context.Background(), "run_1", protocol.Completion{SessionID: "session_1"}); err != nil {
		t.Fatalf("complete: %v", err)
	}
	if received != "POST /api/runs/run_1/completion" || sent.SessionID != "session_1" {
		t.Errorf("received %q with %+v", received, sent)
	}
}

func TestAnUnauthorizedCredentialLosesTheRun(t *testing.T) {
	for status, want := range map[int]bool{
		http.StatusNotFound:     true,
		http.StatusUnauthorized: true,
		http.StatusForbidden:    true,
		http.StatusConflict:     false,
		http.StatusBadGateway:   false,
	} {
		client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "no", status)
		})

		_, err := client.RenewLease(context.Background(), "run_1")
		var rejection *control.ResponseError
		if !errors.As(err, &rejection) || rejection.RunNoLongerLeased() != want {
			t.Errorf("a %d renewal lost the run %v, wanted %v", status, rejection != nil && rejection.RunNoLongerLeased(), want)
		}
	}
}

func TestOnlyAMissingRunIsGone(t *testing.T) {
	for status, want := range map[int]bool{http.StatusNotFound: true, http.StatusConflict: false} {
		client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "no", status)
		})

		_, err := client.RenewLease(context.Background(), "run_1")
		var rejection *control.ResponseError
		if !errors.As(err, &rejection) || rejection.IsNotFound() != want {
			t.Errorf("a %d renewal was gone %v, wanted %v", status, rejection != nil && rejection.IsNotFound(), want)
		}
	}
}

func TestTheEgressCallsCarryTheContract(t *testing.T) {
	received := map[string]string{}
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		received[r.URL.Path] = string(body)
		switch r.URL.Path {
		case "/api/egress/authorize":
			_, _ = w.Write([]byte(`{"runnerId":"runner_1","workspaceId":"ws_1","controlPlaneHost":"spotlight.example.com","controlPlanePort":443,"extraAllowedHosts":["storage.example.com"]}`))
		case "/api/egress/secrets":
			_, _ = w.Write([]byte(`{"runId":"run_1","extraAllowedHosts":[],"secrets":[],"denied":[],"bound":["mcp.example.com"]}`))
		case "/api/egress/active-runs":
			_, _ = w.Write([]byte(`{"active":["one"]}`))
		case "/api/egress/connections":
			w.WriteHeader(http.StatusNoContent)
		}
	})
	ctx := context.Background()

	authorized, err := client.AuthorizeEgress(ctx, "one")
	if err != nil || authorized.RunnerID != "runner_1" || authorized.WorkspaceID != "ws_1" ||
		authorized.ControlPlaneHost != "spotlight.example.com" || authorized.ControlPlanePort != 443 || len(authorized.ExtraAllowedHosts) != 1 || authorized.ExtraAllowedHosts[0] != "storage.example.com" {
		t.Errorf("authorized %+v: %v", authorized, err)
	}
	fetched, err := client.FetchRunSecretsFor(ctx, "one", "recipient")
	if err != nil || fetched.RunID != "run_1" || len(fetched.Bound) != 1 || fetched.Bound[0] != "mcp.example.com" {
		t.Errorf("fetched %+v: %v", fetched, err)
	}
	active, err := client.ActiveRuns(ctx, []string{"one", "two"})
	if err != nil || len(active) != 1 || active[0] != "one" {
		t.Errorf("active %v: %v", active, err)
	}
	at := time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC)
	if err := client.RecordConnections(ctx, []protocol.EgressConnection{{
		ProxyCredential: "one", Host: "api.example.com", Port: 443, BytesOut: 10, BytesIn: 20, Ms: 30, Outcome: protocol.ConnectionPassthrough, At: at,
	}}); err != nil {
		t.Errorf("record: %v", err)
	}

	want := map[string]string{
		"/api/egress/authorize":   `{"proxyCredential":"one"}`,
		"/api/egress/secrets":     `{"proxyCredential":"one","recipient":"recipient"}`,
		"/api/egress/active-runs": `{"proxyCredentials":["one","two"]}`,
		"/api/egress/connections": `{"records":[{"proxyCredential":"one","host":"api.example.com","port":443,"bytesOut":10,"bytesIn":20,"ms":30,"outcome":"passthrough","at":"2026-10-16T12:00:00Z"}]}`,
	}
	for path, body := range want {
		if received[path] != body {
			t.Errorf("%s sent %s", path, received[path])
		}
	}
}

func TestACallContinuesTheTraceOfItsContext(t *testing.T) {
	var seen []string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.Header.Get("traceparent"))
		w.WriteHeader(http.StatusNoContent)
	})
	trace := telemetry.NewTrace()

	if err := client.AppendEvents(telemetry.WithTrace(context.Background(), trace), "run_1", []protocol.Event{{}}); err != nil {
		t.Fatalf("append events: %v", err)
	}
	if err := client.AppendEvents(context.Background(), "run_1", []protocol.Event{{}}); err != nil {
		t.Fatalf("append events: %v", err)
	}

	if read, ok := telemetry.TraceOf(seen[0]); !ok || read.ID() != trace.ID() {
		t.Errorf("traceparent = %q, want trace %s", seen[0], trace.ID())
	}
	if seen[1] != "" {
		t.Errorf("a call without a trace sent traceparent %q", seen[1])
	}
}

func TestRedeemCallSecretsNamesTheHostAndTokenAndReadsTheSealedSecrets(t *testing.T) {
	var path, auth string
	var received protocol.HostCallSecretsRequest
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&received)
		_ = json.NewEncoder(w).Encode(protocol.EgressSecrets{
			RunID: "call_1",
			Secrets: []protocol.FetchedSecret{{
				Secret: "SLACK_BOT_TOKEN", Host: "slack.com", Location: protocol.LocationHeader, Name: "Authorization",
				Prefix: "Bearer ", Sealed: "v1.a.b.c.d",
			}},
		})
	})

	fetched, err := client.RedeemCallSecrets(context.Background(), "call 1", protocol.HostCallSecretsRequest{
		Host: "host_1", Token: "secrets-token", Recipient: "recipient-key",
	})
	if err != nil {
		t.Fatal(err)
	}
	if path != "/api/hosts/calls/call 1/secrets" || auth != "Bearer tok" ||
		received != (protocol.HostCallSecretsRequest{Host: "host_1", Token: "secrets-token", Recipient: "recipient-key"}) {
		t.Errorf("received %s with %q for %+v", path, auth, received)
	}
	if fetched.RunID != "call_1" || len(fetched.Secrets) != 1 || fetched.Secrets[0].Sealed != "v1.a.b.c.d" {
		t.Errorf("redeemed %+v", fetched)
	}
}

func TestRedeemCallSecretsTellsWhyTheControlPlaneRefused(t *testing.T) {
	for status, want := range map[int]error{
		http.StatusUnauthorized: control.ErrUnauthorized,
		http.StatusForbidden:    control.ErrUnauthorized,
		http.StatusConflict:     control.ErrCallSecretsTaken,
		http.StatusGone:         control.ErrCallSecretsExpired,
	} {
		client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "no", status)
		})

		_, err := client.RedeemCallSecrets(context.Background(), "call_1", protocol.HostCallSecretsRequest{Host: "host_1"})
		var rejection *control.ResponseError
		if !errors.Is(err, want) || !errors.As(err, &rejection) || rejection.Status != status {
			t.Errorf("%d came back as %v", status, err)
		}
	}
}

func TestRedeemCallSecretsWithNoCredentialSendsNoAuthorization(t *testing.T) {
	var auth, trust string
	var received protocol.HostCallSecretsRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth, trust = r.Header.Get("Authorization"), r.Header.Get(protocol.TrustHeader)
		_ = json.NewDecoder(r.Body).Decode(&received)
		_ = json.NewEncoder(w).Encode(protocol.EgressSecrets{RunID: "call_1"})
	}))
	t.Cleanup(server.Close)

	client, err := control.Authorized(server.URL, control.NoCredential{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.RedeemCallSecrets(context.Background(), "call_1", protocol.HostCallSecretsRequest{
		Host: "host_1", Token: "secrets-token", Recipient: "key",
	}); err != nil {
		t.Fatal(err)
	}
	if auth != "" || trust != "" || received.Token != "secrets-token" {
		t.Errorf("redeemed with %q through %q for %+v", auth, trust, received)
	}
}
