package resources

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type recorded struct {
	method, path string
	header       http.Header
	body         map[string]any
}

func spotlight(t *testing.T, answer func(w http.ResponseWriter, r *http.Request)) (*Client, *[]recorded) {
	t.Helper()
	var calls []recorded
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		call := recorded{method: r.Method, path: r.URL.Path, header: r.Header.Clone()}
		_ = json.NewDecoder(r.Body).Decode(&call.body)
		calls = append(calls, call)
		answer(w, r)
	}))
	t.Cleanup(server.Close)
	client, err := New(server.URL, "session-token", "v0.4.1")
	if err != nil {
		t.Fatal(err)
	}
	return client, &calls
}

func TestAPullPoolIsMadeWithTheTokenAndKeyTheCLIGives(t *testing.T) {
	client, calls := spotlight(t, func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusCreated) })

	if err := client.PullPool(context.Background(), "ws_1", "leon-mac", "token-of-at-least-thirty-two-characters", "attempt-1"); err != nil {
		t.Fatal(err)
	}

	call := (*calls)[0]
	if call.method != http.MethodPost || call.path != "/api/v1/resources/workspaces/ws_1/runner-pools" ||
		call.body["key"] != "leon-mac" || call.body["token"] != "token-of-at-least-thirty-two-characters" {
		t.Errorf("called %+v", call)
	}
	if call.header.Get("Authorization") != "Bearer session-token" || call.header.Get(idempotent) != "attempt-1" || call.header.Get(clientHeader) != "cli/v0.4.1" {
		t.Errorf("headers %v", call.header)
	}
}

func TestATakenPoolNameSaysSo(t *testing.T) {
	client, _ := spotlight(t, func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusConflict) })

	if err := client.PullPool(context.Background(), "ws_1", "leon-mac", "token", "attempt-1"); !errors.Is(err, ErrNameTaken) {
		t.Errorf("got %v", err)
	}
}

func TestANewSecretIsMadeAndAHeldOneIsRotated(t *testing.T) {
	client, calls := spotlight(t, func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	binding := Binding{Host: "api.anthropic.com", Location: "header", Name: "x-api-key"}
	version := 2

	if err := client.SaveSecret(context.Background(), "ws_1", nil, "ANTHROPIC_API_KEY", "sk-1", binding); err != nil {
		t.Fatal(err)
	}
	held := &Secret{ID: "secret_1", Version: 4, Name: "ANTHROPIC_API_KEY", ValueWoVersion: &version}
	if err := client.SaveSecret(context.Background(), "ws_1", held, "ANTHROPIC_API_KEY", "sk-2", binding); err != nil {
		t.Fatal(err)
	}

	made, rotated := (*calls)[0], (*calls)[1]
	if made.method != http.MethodPost || made.path != "/api/v1/resources/workspaces/ws_1/secrets" || made.body["valueWo"] != "sk-1" {
		t.Errorf("made %+v", made)
	}
	if rotated.method != http.MethodPut || rotated.path != "/api/v1/resources/secrets/secret_1" ||
		rotated.header.Get(ifMatch) != `"4"` || rotated.body["valueWoVersion"] != float64(3) || rotated.body["valueWo"] != "sk-2" {
		t.Errorf("rotated %+v", rotated)
	}
}

func TestAForbiddenWriteSaysItNeedsAnAdmin(t *testing.T) {
	client, _ := spotlight(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"title":"Forbidden"}`))
	})

	err := client.PullPool(context.Background(), "ws_1", "leon-mac", "token", "attempt-1")

	if !errors.Is(err, ErrNotAdmin) {
		t.Errorf("got %v", err)
	}
}
