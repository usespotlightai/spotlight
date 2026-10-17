package agentapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/agentapi"
)

func serve(t *testing.T) *agentapi.Server {
	t.Helper()

	server, err := agentapi.Serve([]string{"spec", "code-review", "review"}, 0, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	return server
}

func post(t *testing.T, server *agentapi.Server, token, body string) (int, string) {
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

	read := new(bytes.Buffer)
	_, _ = read.ReadFrom(response.Body)

	return response.StatusCode, read.String()
}

func TestNothingHandedOverIsNoHandover(t *testing.T) {
	if handover := serve(t).TakeHandover(); handover != nil {
		t.Fatalf("expected silence, got %+v", handover)
	}
}

func TestRecordsTheAgentsHandover(t *testing.T) {
	server := serve(t)

	status, body := post(t, server, server.Token(), `{"next":"spec","note":"needs a spec"}`)
	if status != http.StatusNoContent {
		t.Fatalf("status %d: %s", status, body)
	}

	handover := server.TakeHandover()
	if handover == nil || handover.Next != "spec" || handover.Note != "needs a spec" {
		t.Fatalf("got %+v", handover)
	}
}

func TestAnswersInTheSpellingTheControlPlaneSent(t *testing.T) {
	server := serve(t)

	if status, body := post(t, server, server.Token(), `{"next":"CODE-REVIEW"}`); status != http.StatusNoContent {
		t.Fatalf("status %d: %s", status, body)
	}

	if handover := server.TakeHandover(); handover.Next != "code-review" {
		t.Fatalf("got %q", handover.Next)
	}
}

func TestRejectsAWordThatIsNotOnOffer(t *testing.T) {
	server := serve(t)

	status, body := post(t, server, server.Token(), `{"next":"Deployment"}`)
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status %d", status)
	}

	for _, wanted := range []string{"Deployment", "spec", "code-review", "review"} {
		if !strings.Contains(body, wanted) {
			t.Fatalf("error %q never mentions %q", body, wanted)
		}
	}

	if handover := server.TakeHandover(); handover != nil {
		t.Fatalf("rejected but recorded %+v", handover)
	}
}

func TestLastWordWins(t *testing.T) {
	server := serve(t)

	post(t, server, server.Token(), `{"next":"spec","note":"first"}`)
	post(t, server, server.Token(), `{"next":"review","note":"second"}`)

	if handover := server.TakeHandover(); handover.Next != "review" || handover.Note != "second" {
		t.Fatalf("got %+v", handover)
	}
}

func TestAHandoverIsTakenOncePerTurn(t *testing.T) {
	server := serve(t)

	post(t, server, server.Token(), `{"next":"review","note":"is this right?"}`)

	if handover := server.TakeHandover(); handover == nil || handover.Next != "review" {
		t.Fatalf("got %+v", handover)
	}
	if again := server.TakeHandover(); again != nil {
		t.Fatalf("the next turn would take %+v again", again)
	}

	post(t, server, server.Token(), `{"next":"spec"}`)
	if handover := server.TakeHandover(); handover == nil || handover.Next != "spec" {
		t.Fatalf("the next turn's handover was %+v", handover)
	}
}

func TestAnotherRunsTokenHandsOverNothing(t *testing.T) {
	server := serve(t)
	other := serve(t)

	if status, _ := post(t, server, other.Token(), `{"next":"spec"}`); status != http.StatusUnauthorized {
		t.Fatalf("status %d", status)
	}

	if handover := server.TakeHandover(); handover != nil {
		t.Fatalf("recorded %+v", handover)
	}
}

func TestUnreadableBodyIsRejected(t *testing.T) {
	server := serve(t)

	if status, _ := post(t, server, server.Token(), `{`); status != http.StatusBadRequest {
		t.Fatalf("status %d", status)
	}
}

func serveLimited(t *testing.T, limit int) *agentapi.Server {
	t.Helper()

	server, err := agentapi.Serve([]string{"spec"}, limit, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	return server
}

func TestRejectsANoteLongerThanTheControlPlaneWillTake(t *testing.T) {
	server := serveLimited(t, 20)

	status, body := post(t, server, server.Token(),
		`{"next":"spec","note":"`+strings.Repeat("x", 40)+`"}`)

	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", status)
	}
	for _, want := range []string{"40 characters", "limit is 20", "say it shorter"} {
		if !strings.Contains(body, want) {
			t.Errorf("got %q, want it to mention %q", body, want)
		}
	}
}

func TestTakesANoteInsideTheLimit(t *testing.T) {
	server := serveLimited(t, 20)

	status, _ := post(t, server, server.Token(),
		`{"next":"spec","note":"short enough"}`)

	if status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", status)
	}
}

func TestRejectsNothingForLengthWhenNoLimitIsSet(t *testing.T) {
	server := serveLimited(t, 0)

	status, _ := post(t, server, server.Token(),
		`{"next":"spec","note":"`+strings.Repeat("x", 9000)+`"}`)

	if status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", status)
	}
}

func TestCarriesAToolCallToSpotlight(t *testing.T) {
	server := serve(t)

	var called, carried string
	server.Tools([]string{"pull-request"}, func(_ context.Context, name string, input json.RawMessage) (json.RawMessage, error) {
		called, carried = name, string(input)
		return json.RawMessage(`{"output":"https://github.com/acme/widgets/pull/7"}`), nil
	})

	status, body := postTo(t, server, protocol.AgentAPIToolsPath+"pull-request", server.Token(),
		`{"title":"Fix the queue","body":"what it does"}`)

	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", status, body)
	}
	if called != "pull-request" || carried != `{"title":"Fix the queue","body":"what it does"}` {
		t.Errorf("called %q with %s, want the input carried whole", called, carried)
	}
	if body != `{"output":"https://github.com/acme/widgets/pull/7"}` {
		t.Errorf("got %q, want the answer carried whole", body)
	}
}

func TestDeniesAToolNotEnabledForTheRun(t *testing.T) {
	server := serve(t)
	server.Tools([]string{"pull-request"}, func(context.Context, string, json.RawMessage) (json.RawMessage, error) {
		t.Error("carried it to Spotlight anyway")
		return nil, nil
	})

	status, body := postTo(t, server, protocol.AgentAPIToolsPath+"deploy", server.Token(), `{}`)

	if status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", status)
	}
	if !strings.Contains(body, "pull-request") {
		t.Errorf("got %q, want what is enabled for it", body)
	}
}

func TestDeniesEveryToolWhereNoneAreEnabled(t *testing.T) {
	server := serve(t)

	status, body := postTo(t, server, protocol.AgentAPIToolsPath+"pull-request", server.Token(), `{"title":"x"}`)

	if status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", status)
	}
	if !strings.Contains(body, "it has: nothing") {
		t.Errorf("got %q, want that it has nothing enabled", body)
	}
}

func TestRejectsToolInputThatIsNotJSON(t *testing.T) {
	server := serve(t)
	server.Tools([]string{"pull-request"}, func(context.Context, string, json.RawMessage) (json.RawMessage, error) {
		t.Error("carried it to Spotlight anyway")
		return nil, nil
	})

	status, _ := postTo(t, server, protocol.AgentAPIToolsPath+"pull-request", server.Token(), `title=x`)

	if status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", status)
	}
}

func TestSaysWhatSpotlightRejectedOfATool(t *testing.T) {
	server := serve(t)
	server.Tools([]string{"pull-request"}, func(context.Context, string, json.RawMessage) (json.RawMessage, error) {
		return nil, errors.New("pull-request needs a title: say what to call it")
	})

	status, body := postTo(t, server, protocol.AgentAPIToolsPath+"pull-request", server.Token(), `{}`)

	if status != http.StatusBadGateway || !strings.Contains(body, "say what to call it") {
		t.Fatalf("status = %d, got %q, want Spotlight's reason", status, body)
	}
}

func postTo(t *testing.T, server *agentapi.Server, path, token, body string) (int, string) {
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

	read := new(bytes.Buffer)
	_, _ = read.ReadFrom(response.Body)

	return response.StatusCode, strings.TrimSpace(read.String())
}

func TestRepliesToAReviewCommentThroughSpotlight(t *testing.T) {
	var replied protocol.ReviewCommentReply
	server, err := agentapi.Serve([]string{"spec"}, 0,
		func(_ context.Context, reply protocol.ReviewCommentReply) error {
			replied = reply
			return nil
		})
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, body := postTo(t, server, protocol.AgentAPIReviewCommentReplyPath, server.Token(),
		`{"handle":"c3","body":"Split out in 4a1c2b0.","resolve":true}`)

	if status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204: %s", status, body)
	}
	if replied.Handle != "c3" || !replied.Resolve {
		t.Errorf("replied = %+v, want the review comment the agent named", replied)
	}
}

func TestRejectsAReplyWithNothingToGoOn(t *testing.T) {
	server, err := agentapi.Serve([]string{"spec"}, 0,
		func(context.Context, protocol.ReviewCommentReply) error {
			t.Error("replied anyway")
			return nil
		})
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	for _, body := range []string{`{"body":"x"}`, `{"handle":"c1"}`} {
		status, _ := postTo(t, server, protocol.AgentAPIReviewCommentReplyPath, server.Token(), body)
		if status != http.StatusUnprocessableEntity {
			t.Errorf("status = %d for %s, want 422", status, body)
		}
	}
}

func TestSaysWhenTheRunCannotReplyToAReviewComment(t *testing.T) {
	server, err := agentapi.Serve([]string{"spec"}, 0, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, _ := postTo(t, server, protocol.AgentAPIReviewCommentReplyPath, server.Token(),
		`{"handle":"c1","body":"x"}`)

	if status != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", status)
	}
}

func TestDescribesOnlyTheToolsEnabledForTheRun(t *testing.T) {
	server := serve(t)
	server.Tools([]string{"linear.comment"}, func(context.Context, string, json.RawMessage) (json.RawMessage, error) {
		return nil, nil
	})
	server.Manifest([]protocol.ToolManifest{
		{Name: "linear.comment", Description: "Comment on the issue.", Inputs: []protocol.ToolInputManifest{
			{Name: "body", Schema: json.RawMessage(`{"type":["string","null"]}`), Required: true},
		}},
		{Name: "linear.close", Description: "Close the issue."},
	})

	request, err := http.NewRequest(http.MethodGet, strings.TrimSuffix(server.URL(), "/")+"/tools", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer "+server.Token())

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	var described []protocol.ToolManifest
	if err := json.NewDecoder(response.Body).Decode(&described); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if response.StatusCode != http.StatusOK || len(described) != 1 || described[0].Name != "linear.comment" {
		t.Fatalf("status %d, described %+v", response.StatusCode, described)
	}
	if schema := string(described[0].Inputs[0].Schema); schema != `{"type":["string","null"]}` {
		t.Errorf("described the body as %s, want its schema as written", schema)
	}
}

func TestRejectsAToolRequestNamingNoTool(t *testing.T) {
	server := serve(t)
	server.Tools([]string{"pull-request"}, func(context.Context, string, json.RawMessage) (json.RawMessage, error) {
		t.Error("carried it to Spotlight anyway")
		return nil, nil
	})

	status, body := postTo(t, server, protocol.AgentAPIToolsPath, server.Token(), `{"next":"spec"}`)

	if status != http.StatusNotFound || !strings.Contains(body, "name the tool") {
		t.Fatalf("status = %d, got %q, want it to require a tool name", status, body)
	}
	if handover := server.TakeHandover(); handover != nil {
		t.Fatalf("recorded a handover %+v", handover)
	}
}
