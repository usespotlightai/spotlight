package declare_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/declare"
)

func serve(t *testing.T) *declare.Server {
	t.Helper()

	server, err := declare.Serve([]string{"spec", "code-review", "review"}, 0, nil)
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
	if declared := serve(t).Take(); declared != nil {
		t.Fatalf("expected silence, got %+v", declared)
	}
}

func TestRecordsWhatTheAgentSaid(t *testing.T) {
	server := serve(t)

	status, said := post(t, server, server.Token(), `{"next":"spec","note":"needs a spec"}`)
	if status != http.StatusNoContent {
		t.Fatalf("status %d: %s", status, said)
	}

	declared := server.Take()
	if declared == nil || declared.Next != "spec" || declared.Note != "needs a spec" {
		t.Fatalf("got %+v", declared)
	}
}

func TestAnswersInTheSpellingTheControlPlaneGave(t *testing.T) {
	server := serve(t)

	if status, said := post(t, server, server.Token(), `{"next":"CODE-REVIEW"}`); status != http.StatusNoContent {
		t.Fatalf("status %d: %s", status, said)
	}

	if declared := server.Take(); declared.Next != "code-review" {
		t.Fatalf("got %q", declared.Next)
	}
}

func TestRefusesAWordThatIsNotOnOffer(t *testing.T) {
	server := serve(t)

	status, said := post(t, server, server.Token(), `{"next":"Deployment"}`)
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status %d", status)
	}

	for _, wanted := range []string{"Deployment", "spec", "code-review", "review"} {
		if !strings.Contains(said, wanted) {
			t.Fatalf("refusal %q never mentions %q", said, wanted)
		}
	}

	if declared := server.Take(); declared != nil {
		t.Fatalf("refused but recorded %+v", declared)
	}
}

func TestLastWordStands(t *testing.T) {
	server := serve(t)

	post(t, server, server.Token(), `{"next":"spec","note":"first"}`)
	post(t, server, server.Token(), `{"next":"review","note":"second"}`)

	if declared := server.Take(); declared.Next != "review" || declared.Note != "second" {
		t.Fatalf("got %+v", declared)
	}
}

func TestADeclarationIsTakenOncePerTurn(t *testing.T) {
	server := serve(t)

	post(t, server, server.Token(), `{"next":"review","note":"is this right?"}`)

	if declared := server.Take(); declared == nil || declared.Next != "review" {
		t.Fatalf("got %+v", declared)
	}
	if again := server.Take(); again != nil {
		t.Fatalf("the next turn would say %+v again", again)
	}

	post(t, server, server.Token(), `{"next":"spec"}`)
	if declared := server.Take(); declared == nil || declared.Next != "spec" {
		t.Fatalf("the next turn's declaration was %+v", declared)
	}
}

func TestAnotherRunsTokenSpeaksForNothing(t *testing.T) {
	server := serve(t)
	other := serve(t)

	if status, _ := post(t, server, other.Token(), `{"next":"spec"}`); status != http.StatusUnauthorized {
		t.Fatalf("status %d", status)
	}

	if declared := server.Take(); declared != nil {
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

	server, err := declare.Serve([]string{"spec"}, limit, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	return server
}

func TestRefusesANoteLongerThanTheControlPlaneWillTake(t *testing.T) {
	server := serveLimited(t, 20)

	status, said := post(t, server, server.Token(),
		`{"next":"spec","note":"`+strings.Repeat("x", 40)+`"}`)

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
		`{"next":"spec","note":"short enough"}`)

	if status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", status)
	}
}

func TestRefusesNothingForLengthWhenNoLimitWasGiven(t *testing.T) {
	server := serveLimited(t, 0)

	status, _ := post(t, server, server.Token(),
		`{"next":"spec","note":"`+strings.Repeat("x", 9000)+`"}`)

	if status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", status)
	}
}

func TestCarriesAToolItWasGivenToSpotlight(t *testing.T) {
	server := serve(t)

	var reached, carried string
	server.Tools([]string{"pull-request"}, func(_ context.Context, name string, input json.RawMessage) (json.RawMessage, error) {
		reached, carried = name, string(input)
		return json.RawMessage(`{"output":"https://github.com/acme/widgets/pull/7"}`), nil
	})

	status, said := postTo(t, server, protocol.HandoverToolsPath+"pull-request", server.Token(),
		`{"title":"Fix the queue","body":"what it does"}`)

	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", status, said)
	}
	if reached != "pull-request" || carried != `{"title":"Fix the queue","body":"what it does"}` {
		t.Errorf("reached %q with %s, want the input carried whole", reached, carried)
	}
	if said != `{"output":"https://github.com/acme/widgets/pull/7"}` {
		t.Errorf("said %q, want the answer carried whole", said)
	}
}

func TestRefusesAToolTheRunWasNotGiven(t *testing.T) {
	server := serve(t)
	server.Tools([]string{"pull-request"}, func(context.Context, string, json.RawMessage) (json.RawMessage, error) {
		t.Error("carried it to Spotlight anyway")
		return nil, nil
	})

	status, said := postTo(t, server, protocol.HandoverToolsPath+"deploy", server.Token(), `{}`)

	if status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", status)
	}
	if !strings.Contains(said, "pull-request") {
		t.Errorf("said %q, want what it was given", said)
	}
}

func TestRefusesEveryToolWhereNoneWereGiven(t *testing.T) {
	server := serve(t)

	status, said := postTo(t, server, protocol.HandoverToolsPath+"pull-request", server.Token(), `{"title":"x"}`)

	if status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", status)
	}
	if !strings.Contains(said, "given: nothing") {
		t.Errorf("said %q, want that it was given nothing", said)
	}
}

func TestRefusesToolInputThatIsNotJSON(t *testing.T) {
	server := serve(t)
	server.Tools([]string{"pull-request"}, func(context.Context, string, json.RawMessage) (json.RawMessage, error) {
		t.Error("carried it to Spotlight anyway")
		return nil, nil
	})

	status, _ := postTo(t, server, protocol.HandoverToolsPath+"pull-request", server.Token(), `title=x`)

	if status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", status)
	}
}

func TestSaysWhatSpotlightRefusedOfATool(t *testing.T) {
	server := serve(t)
	server.Tools([]string{"pull-request"}, func(context.Context, string, json.RawMessage) (json.RawMessage, error) {
		return nil, errors.New("pull-request needs a title: say what to call it")
	})

	status, said := postTo(t, server, protocol.HandoverToolsPath+"pull-request", server.Token(), `{}`)

	if status != http.StatusBadGateway || !strings.Contains(said, "say what to call it") {
		t.Fatalf("status = %d, said %q, want Spotlight's reason", status, said)
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
	server, err := declare.Serve([]string{"spec"}, 0,
		func(_ context.Context, spoken protocol.Remark) error {
			said = spoken
			return nil
		})
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, body := postTo(t, server, protocol.HandoverRemarkPath, server.Token(),
		`{"handle":"c3","body":"Split out in 4a1c2b0.","resolve":true}`)

	if status != http.StatusNoContent {
		t.Fatalf("status = %d, want 204: %s", status, body)
	}
	if said.Handle != "c3" || !said.Resolve {
		t.Errorf("said = %+v, want the remark the agent named", said)
	}
}

func TestRefusesAnAnswerWithNothingToGoOn(t *testing.T) {
	server, err := declare.Serve([]string{"spec"}, 0,
		func(context.Context, protocol.Remark) error {
			t.Error("answered anyway")
			return nil
		})
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	for _, body := range []string{`{"body":"x"}`, `{"handle":"c1"}`} {
		status, _ := postTo(t, server, protocol.HandoverRemarkPath, server.Token(), body)
		if status != http.StatusUnprocessableEntity {
			t.Errorf("status = %d for %s, want 422", status, body)
		}
	}
}

func TestSaysWhenTheRunCannotAnswerOne(t *testing.T) {
	server, err := declare.Serve([]string{"spec"}, 0, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	t.Cleanup(func() { _ = server.Close() })

	status, _ := postTo(t, server, protocol.HandoverRemarkPath, server.Token(),
		`{"handle":"c1","body":"x"}`)

	if status != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", status)
	}
}

func TestDescribesOnlyTheToolsTheRunWasGiven(t *testing.T) {
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
		t.Errorf("described the body as %s, want its schema as given", schema)
	}
}

func TestRefusesAToolRequestNamingNoTool(t *testing.T) {
	server := serve(t)
	server.Tools([]string{"pull-request"}, func(context.Context, string, json.RawMessage) (json.RawMessage, error) {
		t.Error("carried it to Spotlight anyway")
		return nil, nil
	})

	status, said := postTo(t, server, protocol.HandoverToolsPath, server.Token(), `{"next":"spec"}`)

	if status != http.StatusNotFound || !strings.Contains(said, "name the tool") {
		t.Fatalf("status = %d, said %q, want it to ask which tool", status, said)
	}
	if declared := server.Take(); declared != nil {
		t.Fatalf("recorded a handover %+v", declared)
	}
}
