package gitproxy_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"usespotlight.ai/runner/internal/gitproxy"
)

type reached struct {
	path       string
	auth       string
	body       string
	userAgent  string
	gitService string
}

func upstream(t *testing.T, seen *reached) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		seen.path = r.URL.Path
		seen.auth = r.Header.Get("Authorization")
		seen.body = string(body)
		seen.userAgent = r.Header.Get("User-Agent")
		seen.gitService = r.URL.Query().Get("service")

		w.Header().Set("Content-Type", "application/x-git-upload-pack-advertisement")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("001e# service=git-upload-pack\n"))
	}))
}

func TestCarriesTheRunnerTokenTheWorkspaceNeverSees(t *testing.T) {
	seen := &reached{}
	control := upstream(t, seen)
	defer control.Close()

	served, err := gitproxy.Serve(control.URL, "runner-token", "run_1")
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	defer func() { _ = served.Close() }()

	response, err := http.Get(served.Remote + "/info/refs?service=git-upload-pack")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", response.StatusCode)
	}
	if seen.auth != "Bearer runner-token" {
		t.Errorf("authorization = %q, want the runner's own token", seen.auth)
	}
	if seen.path != "/api/git/run_1/info/refs" {
		t.Errorf("path = %q, want the run's git path", seen.path)
	}
	if seen.gitService != "git-upload-pack" {
		t.Errorf("service = %q, want it carried through", seen.gitService)
	}
}

func TestRefusesAnotherRunsPath(t *testing.T) {
	seen := &reached{}
	control := upstream(t, seen)
	defer control.Close()

	served, err := gitproxy.Serve(control.URL, "runner-token", "run_1")
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	defer func() { _ = served.Close() }()

	base := strings.TrimSuffix(served.Remote, "/run_1")

	response, err := http.Get(base + "/run_2/info/refs?service=git-upload-pack")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 for another run", response.StatusCode)
	}
	if seen.path != "" {
		t.Errorf("reached the control plane at %q, want nothing forwarded", seen.path)
	}
}

func TestCarriesAPackBothWays(t *testing.T) {
	seen := &reached{}
	control := upstream(t, seen)
	defer control.Close()

	served, err := gitproxy.Serve(control.URL, "runner-token", "run_1")
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	defer func() { _ = served.Close() }()

	response, err := http.Post(
		served.Remote+"/git-receive-pack",
		"application/x-git-receive-pack-request",
		strings.NewReader("PACK-contents"),
	)
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer func() { _ = response.Body.Close() }()

	if seen.body != "PACK-contents" {
		t.Errorf("body = %q, want the pack carried through", seen.body)
	}
	if seen.path != "/api/git/run_1/git-receive-pack" {
		t.Errorf("path = %q, want the receive-pack path", seen.path)
	}

	answered, _ := io.ReadAll(response.Body)
	if !strings.Contains(string(answered), "service=git-upload-pack") {
		t.Errorf("answer = %q, want what the control plane said", string(answered))
	}
}

func TestStopsAnsweringWhenTheRunIsOver(t *testing.T) {
	seen := &reached{}
	control := upstream(t, seen)
	defer control.Close()

	served, err := gitproxy.Serve(control.URL, "runner-token", "run_1")
	if err != nil {
		t.Fatalf("serve: %v", err)
	}

	remote := served.Remote
	if err := served.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	if _, err := http.Get(remote + "/info/refs"); err == nil {
		t.Error("the remote still answers, want it closed with the run")
	}
}
