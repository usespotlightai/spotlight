package login

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/credentials"
)

const (
	exchangedToken = "exchanged-workspace-token"
	githubToken    = "github-oidc-token"
	requestAuth    = "actions-request-token"
)

type exchanges struct {
	trust, token, audience string
}

func exchanging(t *testing.T) (*exchanges, string) {
	t.Helper()

	seen := &exchanges{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method + " " + r.URL.Path {
		case "GET /actions-token":
			if r.Header.Get("Authorization") != "Bearer "+requestAuth {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			seen.audience = r.URL.Query().Get("audience")
			_, _ = io.WriteString(w, `{"value":"`+githubToken+`"}`)
		case "POST " + exchangePath:
			if r.Header.Get(clientHeader) != "cli/test" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			seen.trust, seen.token = body["trust"], body["token"]
			if body["trust"] == "unknown" {
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = io.WriteString(w, `{"message":"Spotlight did not accept the exchange."}`)
				return
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = io.WriteString(w, `{"token":"`+exchangedToken+`","expiresAt":"2026-10-26T11:00:00Z"}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)

	return seen, server.URL
}

func printed(t *testing.T, env map[string]string) (string, error) {
	t.Helper()

	c, out, _, _ := testClient(t, env)
	err := c.token(context.Background(), nil)

	return strings.TrimSpace(out.String()), err
}

func TestAWorkspaceTokenIsPrintedAsItIs(t *testing.T) {
	got, err := printed(t, map[string]string{tokenVar: " ws-token ", trustVar: "trust_1"})

	if err != nil || got != "ws-token" {
		t.Fatalf("printed %q, %v; want the workspace token", got, err)
	}
}

func TestATrustExchangesTheGitHubActionsToken(t *testing.T) {
	seen, address := exchanging(t)

	got, err := printed(t, map[string]string{
		urlVar:             address,
		trustVar:           "trust_1",
		actionsRequestURL:  address + "/actions-token?api-version=2.0",
		actionsRequestAuth: requestAuth,
	})

	if err != nil || got != exchangedToken {
		t.Fatalf("printed %q, %v; want the exchanged token", got, err)
	}
	if *seen != (exchanges{trust: "trust_1", token: githubToken, audience: defaultAudience}) {
		t.Errorf("exchange saw %+v", *seen)
	}
}

func TestATrustExchangesASuppliedOIDCToken(t *testing.T) {
	seen, address := exchanging(t)

	got, err := printed(t, map[string]string{urlVar: address, trustVar: "trust_1", workloadVar: "gitlab-token"})

	if err != nil || got != exchangedToken || seen.token != "gitlab-token" {
		t.Fatalf("printed %q, %v, exchanged %q", got, err, seen.token)
	}
}

func TestTheAudienceComesFromTheEnvironment(t *testing.T) {
	seen, address := exchanging(t)

	_, err := printed(t, map[string]string{
		urlVar:             address,
		trustVar:           "trust_1",
		audienceVar:        "https://spotlight.example.com",
		actionsRequestURL:  address + "/actions-token",
		actionsRequestAuth: requestAuth,
	})

	if err != nil || seen.audience != "https://spotlight.example.com" {
		t.Fatalf("audience %q, %v", seen.audience, err)
	}
}

func TestATrustWithoutAnOIDCTokenSaysWhatIsMissing(t *testing.T) {
	_, address := exchanging(t)

	_, err := printed(t, map[string]string{urlVar: address, trustVar: "trust_1"})

	if err == nil || !strings.Contains(err.Error(), "id-token: write") {
		t.Fatalf("err = %v, want what the job needs", err)
	}
}

func TestARefusedExchangeIsReported(t *testing.T) {
	_, address := exchanging(t)

	_, err := printed(t, map[string]string{urlVar: address, trustVar: "unknown", workloadVar: "x"})

	if err == nil || !strings.Contains(err.Error(), "401") {
		t.Fatalf("err = %v, want the refusal", err)
	}
}

func TestTheLoginIsTheLastChoice(t *testing.T) {
	dir := t.TempDir()
	path, err := credentials.Path(func(name string) string {
		if name == credentials.DirVar {
			return dir
		}
		return ""
	})
	if err != nil {
		t.Fatal(err)
	}
	file, err := credentials.Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Put("https://spotlight.example.com", credentials.Login{Token: sessionToken}); err != nil {
		t.Fatal(err)
	}
	if err := file.Save(); err != nil {
		t.Fatal(err)
	}

	got, err := printed(t, map[string]string{credentials.DirVar: dir, urlVar: "https://spotlight.example.com"})

	if err != nil || got != sessionToken {
		t.Fatalf("printed %q, %v; want the login", got, err)
	}
}

func TestNoTokenSaysHowToGetOne(t *testing.T) {
	got, err := printed(t, map[string]string{credentials.DirVar: t.TempDir(), urlVar: "https://spotlight.example.com"})

	if err == nil || got != "" || !strings.Contains(err.Error(), "spotlight login") {
		t.Fatalf("printed %q, %v; want how to log in", got, err)
	}
}
