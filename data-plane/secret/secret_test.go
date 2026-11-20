package secret

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/control"
)

const token = "session-token"

type server struct {
	workspaces []string
	set        map[string]string
	answer     int
	message    string
}

func serving(t *testing.T, s *server) string {
	t.Helper()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+token || r.Header.Get(clientHeader) != "cli/test" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/resources/workspaces":
			items := []workspace{}
			for _, each := range s.workspaces {
				items = append(items, workspace{Slug: each})
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"items": items})
		case r.Method == http.MethodGet && r.URL.Path == "/api/workspaces/acme/secrets":
			setAt := "2026-11-19T10:00:00Z"
			_ = json.NewEncoder(w).Encode([]Secret{
				{Name: "LINEAR_API_KEY", Hosts: []string{"api.linear.app"}, Origin: "terraform", ValueSetAt: &setAt},
				{Name: "STAGING_LOGIN_PASSWORD", Hosts: []string{"staging.example.com"}, Origin: "awaiting", Settable: true},
			})
		case r.Method == http.MethodPut && strings.HasPrefix(r.URL.Path, "/api/workspaces/acme/secrets/"):
			if s.answer != 0 {
				w.WriteHeader(s.answer)
				_, _ = io.WriteString(w, `{"message":"`+s.message+`"}`)
				return
			}
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			name := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/workspaces/acme/secrets/"), "/value")
			s.set[name] = body["value"]
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	})
	httpServer := httptest.NewServer(handler)
	t.Cleanup(httpServer.Close)

	return httpServer.URL
}

func cliFor(address string, in io.Reader, out io.Writer, typed func(string) (string, bool, error)) *cli {
	vars := map[string]string{urlVar: address, tokenVar: token}
	if typed == nil {
		typed = func(string) (string, bool, error) { return "", false, nil }
	}

	return &cli{
		env:     func(name string) string { return vars[name] },
		in:      in,
		out:     out,
		version: "test",
		typed:   typed,
		client:  control.New,
	}
}

func TestSetReadsTheValueFromStdinWithoutItsLastNewline(t *testing.T) {
	s := &server{workspaces: []string{"acme"}, set: map[string]string{}}
	var out bytes.Buffer

	err := cliFor(serving(t, s), strings.NewReader("hunter2\n"), &out, nil).run(context.Background(), []string{"set", "STAGING_LOGIN_PASSWORD"})
	if err != nil {
		t.Fatal(err)
	}

	if s.set["STAGING_LOGIN_PASSWORD"] != "hunter2" {
		t.Fatalf("set %q", s.set)
	}
	if !strings.Contains(out.String(), "stores the new value of STAGING_LOGIN_PASSWORD") || strings.Contains(out.String(), "hunter2") {
		t.Fatalf("printed %q", out.String())
	}
}

func TestSetTakesTheValueTypedOnATerminal(t *testing.T) {
	s := &server{workspaces: []string{"acme"}, set: map[string]string{}}
	asked := ""
	typed := func(question string) (string, bool, error) {
		asked = question
		return "typed-secret", true, nil
	}

	err := cliFor(serving(t, s), strings.NewReader(""), io.Discard, typed).run(context.Background(), []string{"set", "STAGING_LOGIN_PASSWORD"})
	if err != nil {
		t.Fatal(err)
	}

	if s.set["STAGING_LOGIN_PASSWORD"] != "typed-secret" || asked != "Value of STAGING_LOGIN_PASSWORD" {
		t.Fatalf("set %q after asking %q", s.set, asked)
	}
}

func TestSetRefusesAnEmptyValue(t *testing.T) {
	s := &server{workspaces: []string{"acme"}, set: map[string]string{}}

	err := cliFor(serving(t, s), strings.NewReader("\n"), io.Discard, nil).run(context.Background(), []string{"set", "STAGING_LOGIN_PASSWORD"})

	if err == nil || !strings.Contains(err.Error(), "empty") || len(s.set) != 0 {
		t.Fatalf("err %v, set %q", err, s.set)
	}
}

func TestSetSaysWhySpotlightRefusedTheValue(t *testing.T) {
	s := &server{
		workspaces: []string{"acme"},
		set:        map[string]string{},
		answer:     http.StatusConflict,
		message:    "Terraform sets the value of secret LINEAR_API_KEY (value_wo_version 1).",
	}

	err := cliFor(serving(t, s), strings.NewReader("lin_api_2"), io.Discard, nil).run(context.Background(), []string{"set", "LINEAR_API_KEY"})

	if err == nil || !strings.Contains(err.Error(), "Terraform sets the value") {
		t.Fatalf("err %v", err)
	}
}

func TestSetNeedsTheNameAsItsOnlyArgument(t *testing.T) {
	s := &server{workspaces: []string{"acme"}, set: map[string]string{}}

	err := cliFor(serving(t, s), strings.NewReader("x"), io.Discard, nil).run(context.Background(), []string{"set", "A", "value-as-argument"})

	if err == nil || !strings.Contains(err.Error(), "usage:") || len(s.set) != 0 {
		t.Fatalf("err %v, set %q", err, s.set)
	}
}

func TestAskWhichWorkspaceWhenThereAreSeveral(t *testing.T) {
	s := &server{workspaces: []string{"acme", "globex"}, set: map[string]string{}}

	err := cliFor(serving(t, s), strings.NewReader("x"), io.Discard, nil).run(context.Background(), []string{"list"})

	if err == nil || !strings.Contains(err.Error(), "acme, globex") {
		t.Fatalf("err %v", err)
	}
}

func TestListShowsWhereEachValueComesFrom(t *testing.T) {
	s := &server{workspaces: []string{"acme"}, set: map[string]string{}}
	var out bytes.Buffer

	err := cliFor(serving(t, s), strings.NewReader(""), &out, nil).run(context.Background(), []string{"list", "--workspace", "acme"})
	if err != nil {
		t.Fatal(err)
	}

	for _, want := range []string{"LINEAR_API_KEY", "Set by Terraform", "STAGING_LOGIN_PASSWORD", "Awaiting a value", "staging.example.com"} {
		if !strings.Contains(out.String(), want) {
			t.Fatalf("missing %q in\n%s", want, out.String())
		}
	}
}

func TestWithoutNewlineRemovesOnlyOne(t *testing.T) {
	for read, want := range map[string]string{"a\n": "a", "a\r\n": "a", "a\n\n": "a\n", "a": "a", " a ": " a "} {
		if got := withoutNewline(read); got != want {
			t.Fatalf("withoutNewline(%q) = %q, want %q", read, got, want)
		}
	}
}
