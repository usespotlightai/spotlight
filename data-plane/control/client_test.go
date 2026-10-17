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

	err := client.RecordChangeStackCheck(context.Background(), "run_1", "s1", false, protocol.StackChecked{
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

func TestRenewCheckLeaseReadsBackWhetherToStop(t *testing.T) {
	var asked, method string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		asked, method = r.URL.EscapedPath(), r.Method
		_, _ = w.Write([]byte(`{"stop":true}`))
	})

	stop, err := client.RenewCheckLease(context.Background(), "run_1", "stack/1", false)
	if err != nil {
		t.Fatalf("renew: %v", err)
	}
	if !stop {
		t.Error("expected the renewal to say the check should stop")
	}
	if method != http.MethodPost || asked != "/api/runs/run_1/change-stack-checks/stack%2F1/lease" {
		t.Errorf("asked %s %q", method, asked)
	}
}

func TestRecheckCallsNameTheRecheck(t *testing.T) {
	var asked []string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		asked = append(asked, r.URL.Path+"?"+r.URL.RawQuery)
		if strings.HasSuffix(r.URL.Path, "/lease") {
			_, _ = w.Write([]byte(`{"stop":false}`))
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	if _, err := client.RenewCheckLease(context.Background(), "run_1", "stack_1", true); err != nil {
		t.Fatalf("renew: %v", err)
	}
	if err := client.RecordChangeStackCheck(context.Background(), "run_1", "stack_1", true, protocol.StackChecked{}); err != nil {
		t.Fatalf("record: %v", err)
	}

	want := []string{
		"/api/runs/run_1/change-stack-checks/stack_1/lease?recheck=true",
		"/api/runs/run_1/change-stack-checks/stack_1?recheck=true",
	}
	if strings.Join(asked, " ") != strings.Join(want, " ") {
		t.Errorf("asked %q", asked)
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

	var rejection *control.Rejection
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
		_ = json.NewEncoder(w).Encode(protocol.StoredArchive{ID: "archive_1", URL: "https://storage.test/a", Size: 12, SHA256: "ab"})
	})

	stored, err := client.WorkspaceArchive(context.Background(), "run_1")
	if err != nil || stored == nil || stored.ID != "archive_1" || stored.Size != 12 {
		t.Fatalf("stored %+v, %v", stored, err)
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

type trusted struct{}

func (trusted) Authorize(request *http.Request) error {
	request.Header.Set("Authorization", "Bearer workload-token")
	request.Header.Set(protocol.TrustHeader, "trust_1")
	return nil
}

func TestClaimCallNamesTheHostAndTakesTheCall(t *testing.T) {
	var path, auth string
	var asked protocol.HostCallClaim
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&asked)
		_ = json.NewEncoder(w).Encode(protocol.HostCall{
			ID: "call_1", Method: http.MethodPost, URL: "https://audit.acme.internal/", Body: "e30=", TimeoutMs: 10000,
		})
	})

	call, err := client.ClaimCall(context.Background(), "host_1")
	if err != nil {
		t.Fatal(err)
	}
	if path != "/api/hosts/calls/claim" || auth != "Bearer tok" || asked.Host != "host_1" {
		t.Errorf("asked %s with %q for %+v", path, auth, asked)
	}
	if call.ID != "call_1" || call.URL != "https://audit.acme.internal/" || call.TimeoutMs != 10000 {
		t.Errorf("took %+v", call)
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

func TestClaimCallTellsARefusedCredentialAndAnUnreportedHost(t *testing.T) {
	refused := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "no", http.StatusUnauthorized)
	})
	if _, err := refused.ClaimCall(context.Background(), "host_1"); !errors.Is(err, control.ErrRefused) {
		t.Errorf("a refused credential came back as %v", err)
	}

	unreported := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"reason":"host-unreported"}`))
	})
	if _, err := unreported.ClaimCall(context.Background(), "host_1"); !control.Rejected(err, "host-unreported") {
		t.Errorf("an unreported host came back as %v", err)
	}
}

func TestClaimCallRefusesACallWithNoAddress(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(protocol.HostCall{ID: "call_1"})
	})

	if _, err := client.ClaimCall(context.Background(), "host_1"); err == nil {
		t.Fatal("took a call with nowhere to send it")
	}
}

func TestAnswerCallPostsTheAnswerToTheCall(t *testing.T) {
	var path string
	var answered protocol.HostCallAnswer
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&answered)
		w.WriteHeader(http.StatusNoContent)
	})

	answer := protocol.HostCallAnswer{Status: 200, Headers: map[string]string{"content-type": "application/json"}, Body: "e30=", Ms: 12}
	if err := client.AnswerCall(context.Background(), "call_1", answer); err != nil {
		t.Fatal(err)
	}
	if path != "/api/hosts/calls/call_1/answer" || answered.Status != 200 || answered.Body != "e30=" || answered.Ms != 12 {
		t.Errorf("answered %s with %+v", path, answered)
	}
}

func TestAnswerCallTellsACallAlreadyAnswered(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"reason":"call-answered"}`))
	})

	err := client.AnswerCall(context.Background(), "call_1", protocol.HostCallAnswer{Error: "timed out after 10s"})
	var rejection *control.Rejection
	if !errors.As(err, &rejection) || rejection.Status != http.StatusConflict {
		t.Errorf("answered with %v", err)
	}
}

func TestRecallsByWordsAndByHandle(t *testing.T) {
	var asked []string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		asked = append(asked, strings.TrimSpace(r.Method+" "+r.URL.RequestURI()+" "+string(body)))
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
	if strings.Join(asked, "\n") != strings.Join(want, "\n") {
		t.Errorf("asked %v", asked)
	}
}

func TestARefusedMemorySaysWhatSpotlightSaid(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"message":"A memory is one of rationale, not gossip","error":"Unprocessable Entity","statusCode":422}`))
	})

	_, err := client.Remember(context.Background(), "run_1", protocol.Remembering{Kind: "gossip", Body: "x"})

	var rejection *control.Rejection
	if !errors.As(err, &rejection) {
		t.Fatalf("got %v", err)
	}
	if said, ok := rejection.Refused(); !ok || said != "A memory is one of rationale, not gossip" {
		t.Errorf("refused %q, %v", said, ok)
	}
}

func TestAnUnreachableSpotlightIsNoRefusal(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"message":"upstream down"}`))
	})

	_, err := client.Remember(context.Background(), "run_1", protocol.Remembering{Kind: "rationale", Body: "x"})

	var rejection *control.Rejection
	if errors.As(err, &rejection) {
		if _, ok := rejection.Refused(); ok {
			t.Error("a 502 should not read as a refusal")
		}
	}
}

func TestReadsTheMemoryFilesOfARun(t *testing.T) {
	var asked string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		asked = r.Method + " " + r.URL.RequestURI()
		_, _ = w.Write([]byte(`[{"path":".spotlight/memory/team/M-1.md","body":"# M-1"}]`))
	})

	files, err := client.MemoryFiles(context.Background(), "run_1")
	if err != nil {
		t.Fatal(err)
	}

	if asked != "GET /api/runs/run_1/memory-files" || len(files) != 1 || files[0].Body != "# M-1" {
		t.Errorf("asked %s, got %+v", asked, files)
	}
}

func TestCompleteHearsWhetherTheRunNowWaitsForAPerson(t *testing.T) {
	var asked string
	var told protocol.Completion
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		asked = r.Method + " " + r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&told)
		_, _ = w.Write([]byte(`{"waiting":true}`))
	})

	completed, err := client.Complete(context.Background(), "run_1", protocol.Completion{SessionID: "session_1"})
	if err != nil {
		t.Fatalf("complete: %v", err)
	}
	if !completed.Waiting {
		t.Error("the run waits for a person, yet the runner heard it ended")
	}
	if asked != "POST /api/runs/run_1/completion" || told.SessionID != "session_1" {
		t.Errorf("asked %q with %+v", asked, told)
	}
}

func TestCompleteHearsThatTheRunEnded(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"waiting":false}`))
	})

	completed, err := client.Complete(context.Background(), "run_1", protocol.Completion{})
	if err != nil {
		t.Fatalf("complete: %v", err)
	}
	if completed.Waiting {
		t.Error("the run ended, yet the runner heard it waits")
	}
}

func TestParkHearsWhetherTheRunWasLetGo(t *testing.T) {
	for _, answer := range []bool{true, false} {
		var asked string
		client := serve(t, func(w http.ResponseWriter, r *http.Request) {
			asked = r.Method + " " + r.URL.Path
			_ = json.NewEncoder(w).Encode(protocol.Parking{Parked: answer})
		})

		parking, err := client.Park(context.Background(), "run_1", false)
		if err != nil {
			t.Fatalf("park: %v", err)
		}
		if parking.Parked != answer {
			t.Errorf("the control plane said parked %t, the runner heard %t", answer, parking.Parked)
		}
		if asked != "POST /api/runs/run_1/parked" {
			t.Errorf("asked %q", asked)
		}
	}
}

func TestParkSaysWhyItCouldNotPark(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "run is not waiting", http.StatusConflict)
	})

	if _, err := client.Park(context.Background(), "run_1", false); err == nil || !strings.Contains(err.Error(), "409") {
		t.Fatalf("got %v", err)
	}
}

func TestAsksHearsWhetherTheTurnWouldWaitForAPerson(t *testing.T) {
	for _, answer := range []bool{true, false} {
		var asked string
		var sent protocol.Completion
		client := serve(t, func(w http.ResponseWriter, r *http.Request) {
			asked = r.Method + " " + r.URL.Path
			_ = json.NewDecoder(r.Body).Decode(&sent)
			_ = json.NewEncoder(w).Encode(protocol.TurnAsks{Asks: answer})
		})

		asks, err := client.Asks(context.Background(), "run_1", protocol.Completion{
			Outcome: &protocol.Outcome{Next: "review"},
		})
		if err != nil {
			t.Fatalf("asks: %v", err)
		}
		if asks != answer {
			t.Errorf("the control plane said %t, the runner heard %t", answer, asks)
		}
		if asked != "POST /api/runs/run_1/completion/asks" || sent.Outcome == nil || sent.Outcome.Next != "review" {
			t.Errorf("asked %q with %+v", asked, sent)
		}
	}
}

func TestParkColdAsksForTheRunToGoBackOnTheQueue(t *testing.T) {
	var sent protocol.ParkRequest
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&sent)
		_ = json.NewEncoder(w).Encode(protocol.Parking{Parked: true})
	})

	if _, err := client.Park(context.Background(), "run_1", true); err != nil {
		t.Fatalf("park: %v", err)
	}
	if !sent.Cold {
		t.Errorf("asked to park %+v", sent)
	}
}

func TestARefusedCredentialLosesTheRun(t *testing.T) {
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
		var rejection *control.Rejection
		if !errors.As(err, &rejection) || rejection.Lost() != want {
			t.Errorf("a %d renewal lost the run %v, wanted %v", status, rejection != nil && rejection.Lost(), want)
		}
	}
}

func TestOnlyAMissingRunIsGone(t *testing.T) {
	for status, want := range map[int]bool{http.StatusNotFound: true, http.StatusConflict: false} {
		client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "no", status)
		})

		_, err := client.RenewLease(context.Background(), "run_1")
		var rejection *control.Rejection
		if !errors.As(err, &rejection) || rejection.Gone() != want {
			t.Errorf("a %d renewal was gone %v, wanted %v", status, rejection != nil && rejection.Gone(), want)
		}
	}
}

func TestTheEgressCallsCarryTheContract(t *testing.T) {
	asked := map[string]string{}
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		asked[r.URL.Path] = string(body)
		switch r.URL.Path {
		case "/api/egress/admit":
			_, _ = w.Write([]byte(`{"runnerId":"runner_1","workspaceId":"ws_1","controlPlaneHost":"spotlight.example.com","controlPlanePort":443,"reaches":["storage.example.com"]}`))
		case "/api/egress/secrets":
			_, _ = w.Write([]byte(`{"runId":"run_1","reaches":[],"secrets":[],"denied":[],"bound":["mcp.example.com"]}`))
		case "/api/egress/active-runs":
			_, _ = w.Write([]byte(`{"active":["one"]}`))
		case "/api/egress/connections":
			w.WriteHeader(http.StatusNoContent)
		}
	})
	ctx := context.Background()

	admitted, err := client.AdmitEgress(ctx, "one")
	if err != nil || admitted.RunnerID != "runner_1" || admitted.WorkspaceID != "ws_1" ||
		admitted.ControlPlaneHost != "spotlight.example.com" || admitted.ControlPlanePort != 443 || len(admitted.Reaches) != 1 || admitted.Reaches[0] != "storage.example.com" {
		t.Errorf("admitted %+v: %v", admitted, err)
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
		"/api/egress/admit":       `{"proxyCredential":"one"}`,
		"/api/egress/secrets":     `{"proxyCredential":"one","recipient":"recipient"}`,
		"/api/egress/active-runs": `{"proxyCredentials":["one","two"]}`,
		"/api/egress/connections": `{"records":[{"proxyCredential":"one","host":"api.example.com","port":443,"bytesOut":10,"bytesIn":20,"ms":30,"outcome":"passthrough","at":"2026-10-16T12:00:00Z"}]}`,
	}
	for path, body := range want {
		if asked[path] != body {
			t.Errorf("%s sent %s", path, asked[path])
		}
	}
}
