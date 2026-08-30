package declare_test

import (
	"bytes"
	"net/http"
	"strings"
	"testing"

	"usespotlight.ai/runner/internal/declare"
)

func serve(t *testing.T) *declare.Server {
	t.Helper()

	server, err := declare.Serve([]string{"Spec", "Code Review", "review"})
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
