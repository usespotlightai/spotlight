package declare_test

import (
	"bytes"
	"context"
	"net/http"
	"strings"
	"testing"

	"usespotlight.ai/runner/internal/declare"
	"usespotlight.ai/runner/internal/protocol"
)

func serve(t *testing.T) *declare.Server {
	t.Helper()

	server, err := declare.Serve([]string{"Spec", "Code Review", "review"}, 0, nil, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	return server
}

func post(t *testing.T, server *declare.Server, token, body string) (int, string) {
	t.Helper()

	request, err := http.NewRequest(http.MethodPost, server.URL(), strings.NewReader(body))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	request.Header.Set("Authorization", "Bearer "+token)

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer response.Body.Close()

	said := new(bytes.Buffer)
	_, _ = said.ReadFrom(response.Body)

	return response.StatusCode, said.String()
}

func TestNothingSaidIsNoDeclaration(t *testing.T) {
	if declared := serve(t).Declared(); declared != nil {
		t.Fatalf("expected silence, got %+v", declared)
	}
}

func TestRecordsWhatTheAgentSaid(t *testing.T) {
	server := serve(t)

	status, said := post(t, server, server.Token(), `{"next":"Spec","note":"needs a spec"}`)
	if status != http.StatusNoContent {
		t.Fatalf("status %d: %s", status, said)
	}

	declared := server.Declared()
	if declared == nil || declared.Next != "Spec" || declared.Note != "needs a spec" {
		t.Fatalf("got %+v", declared)
	}
}

// The agent should not have to know how the control plane capitalises, but the
// control plane should get back the spelling it recognises.
func TestAnswersInTheSpellingTheControlPlaneGave(t *testing.T) {
	server := serve(t)

	if status, said := post(t, server, server.Token(), `{"next":"code review"}`); status != http.StatusNoContent {
		t.Fatalf("status %d: %s", status, said)
	}

	if declared := server.Declared(); declared.Next != "Code Review" {
		t.Fatalf("got %q", declared.Next)
	}
}

// The whole point of the endpoint over the file: a wrong word is refused while
// the agent can still fix it, and the refusal says what would have worked.
func TestRefusesAWordThatIsNotOnOffer(t *testing.T) {
	server := serve(t)

	status, said := post(t, server, server.Token(), `{"next":"Deployment"}`)
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status %d", status)
	}

	for _, wanted := range []string{"Deployment", "Spec", "Code Review", "review"} {
		if !strings.Contains(said, wanted) {
			t.Fatalf("refusal %q never mentions %q", said, wanted)
		}
	}

	if declared := server.Declared(); declared != nil {
		t.Fatalf("refused but recorded %+v", declared)
	}
}

func TestLastWordStands(t *testing.T) {
	server := serve(t)

	post(t, server, server.Token(), `{"next":"Spec","note":"first"}`)
	post(t, server, server.Token(), `{"next":"review","note":"second"}`)

	if declared := server.Declared(); declared.Next != "review" || declared.Note != "second" {
		t.Fatalf("got %+v", declared)
	}
}

func TestAnotherRunsTokenSpeaksForNothing(t *testing.T) {
	server := serve(t)
	other := serve(t)

	if status, _ := post(t, server, other.Token(), `{"next":"Spec"}`); status != http.StatusUnauthorized {
		t.Fatalf("status %d", status)
	}

	if declared := server.Declared(); declared != nil {
		t.Fatalf("recorded %+v", declared)
	}
}

func TestUnreadableBodyIsRefused(t *testing.T) {
	server := serve(t)

	if status, _ := post(t, server, server.Token(), `{`); status != http.StatusBadRequest {
		t.Fatalf("status %d", status)
	}
}

func serveLimited(t *testing.T, limit int) *declare.Server {
	t.Helper()

	server, err := declare.Serve([]string{"Spec"}, limit, nil, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	return server
}

func TestRefusesANoteLongerThanTheControlPlaneWillTake(t *testing.T) {
	server := serveLimited(t, 20)

	status, said := post(t, server, server.Token(),
		`{"next":"Spec","note":"`+strings.Repeat("x", 40)+`"}`)

	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", status)
	}
	for _, want := range []string{"40 characters", "limit is 20", "say it shorter"} {
		if !strings.Contains(said, want) {
			t.Errorf("said %q, want it to mention %q", said, want)
		}
	}
}

func TestTakesANoteInsideTheLimit(t *testing.T) {
	server := serveLimited(t, 20)

	status, _ := post(t, server, server.Token(),
		`{"next":"Spec","note":"short enough"}`)

	if status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", status)
	}
}

// Nothing said about a limit is not a limit of nothing.
func TestRefusesNothingForLengthWhenNoLimitWasGiven(t *testing.T) {
	server := serveLimited(t, 0)

	status, _ := post(t, server, server.Token(),
		`{"next":"Spec","note":"`+strings.Repeat("x", 9000)+`"}`)

	if status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", status)
	}
}

func TestOpensAPullRequestThroughSpotlight(t *testing.T) {
	var asked protocol.PullRequest
	server, err := declare.Serve([]string{"Spec"}, 0,
		func(_ context.Context, wanted protocol.PullRequest) (string, error) {
			asked = wanted
			return "https://github.com/acme/widgets/pull/7", nil
		}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, said := postTo(t, server, declare.PullRequestPath, server.Token(),
		`{"title":"Fix the queue","body":"what it does"}`)

	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", status, said)
	}
	if asked.Title != "Fix the queue" || asked.Body != "what it does" {
		t.Errorf("asked = %+v, want what the agent said", asked)
	}
	if !strings.Contains(said, "/pull/7") {
		t.Errorf("said %q, want where it landed", said)
	}
}

func TestRefusesAPullRequestWithNothingToCallIt(t *testing.T) {
	server, err := declare.Serve([]string{"Spec"}, 0,
		func(_ context.Context, _ protocol.PullRequest) (string, error) {
			t.Error("asked Spotlight for one anyway")
			return "", nil
		}, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, _ := postTo(t, server, declare.PullRequestPath, server.Token(), `{"body":"x"}`)

	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", status)
	}
}

// The agent may not reach GitHub itself, so a run with no way to open one
// says so rather than failing somewhere the agent cannot read.
func TestSaysWhenTheRunCannotOpenOne(t *testing.T) {
	server, err := declare.Serve([]string{"Spec"}, 0, nil, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, _ := postTo(t, server, declare.PullRequestPath, server.Token(), `{"title":"x"}`)

	if status != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", status)
	}
}

func postTo(t *testing.T, server *declare.Server, path, token, body string) (int, string) {
	t.Helper()

	request, err := http.NewRequest(
		http.MethodPost,
		strings.TrimSuffix(server.URL(), "/")+path,
		strings.NewReader(body),
	)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	request.Header.Set("Authorization", "Bearer "+token)

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer response.Body.Close()

	said := new(bytes.Buffer)
	_, _ = said.ReadFrom(response.Body)

	return response.StatusCode, strings.TrimSpace(said.String())
}

func TestAnswersARemarkThroughSpotlight(t *testing.T) {
	var said protocol.Remark
	server, err := declare.Serve([]string{"Spec"}, 0, nil,
		func(_ context.Context, spoken protocol.Remark) error {
			said = spoken
			return nil
		})
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, body := postTo(t, server, declare.RemarkPath, server.Token(),
		`{"handle":"c3","body":"Split out in 4a1c2b0.","resolve":true}`)

	if status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204: %s", status, body)
	}
	if said.Handle != "c3" || !said.Resolve {
		t.Errorf("said = %+v, want the remark the agent named", said)
	}
}

// Nothing to answer, or nothing to say: both are the agent's to fix, so both
// are refused where it can read them rather than sent on.
func TestRefusesAnAnswerWithNothingToGoOn(t *testing.T) {
	server, err := declare.Serve([]string{"Spec"}, 0, nil,
		func(context.Context, protocol.Remark) error {
			t.Error("answered anyway")
			return nil
		})
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	for _, body := range []string{`{"body":"x"}`, `{"handle":"c1"}`} {
		status, _ := postTo(t, server, declare.RemarkPath, server.Token(), body)
		if status != http.StatusUnprocessableEntity {
			t.Errorf("status = %d for %s, want 422", status, body)
		}
	}
}

func TestSaysWhenTheRunCannotAnswerOne(t *testing.T) {
	server, err := declare.Serve([]string{"Spec"}, 0, nil, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, _ := postTo(t, server, declare.RemarkPath, server.Token(),
		`{"handle":"c1","body":"x"}`)

	if status != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", status)
	}
}
