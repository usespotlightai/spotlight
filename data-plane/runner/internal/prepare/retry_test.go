package prepare_test

import (
	"context"
	"net/http"
	"net/http/cgi"
	"net/http/httptest"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/prepare"
)

type flakyServer struct {
	failing  string
	status   int
	matched  atomic.Int32
	failures atomic.Int32
}

func (f fixture) served(t *testing.T, failing string, status int, times int32) (*flakyServer, string) {
	t.Helper()

	execPath := strings.TrimSpace(git(t, f.origin, "--exec-path"))
	backend := &cgi.Handler{
		Path:       filepath.Join(execPath, "git-http-backend"),
		Env:        []string{"GIT_PROJECT_ROOT=" + filepath.Dir(f.origin), "GIT_HTTP_EXPORT_ALL=1"},
		InheritEnv: []string{"PATH", "HOME"},
	}

	flaky := &flakyServer{failing: failing, status: status}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, flaky.failing) && flaky.matched.Add(1) <= times {
			flaky.failures.Add(1)
			http.Error(w, http.StatusText(flaky.status), flaky.status)
			return
		}
		backend.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)

	return flaky, server.URL + "/" + filepath.Base(f.origin)
}

func requireHTTPBackend(t *testing.T) {
	t.Helper()

	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}
	output, err := exec.Command("git", "--exec-path").Output()
	if err != nil {
		t.Skip("git has no exec path")
	}
	if _, err := exec.LookPath(filepath.Join(strings.TrimSpace(string(output)), "git-http-backend")); err != nil {
		t.Skip("git-http-backend is not installed")
	}
}

func TestClonesAgainWhenTheServerAnswersBadGateway(t *testing.T) {
	requireHTTPBackend(t)
	prepare.SetRetryDelays(t, time.Millisecond, time.Millisecond, time.Millisecond)
	f := setUp(t)
	head := git(t, f.origin, "rev-parse", "HEAD")
	flaky, remote := f.served(t, "/info/refs", http.StatusBadGateway, 2)

	checkout := protocol.Checkout{Remote: remote, Path: "acme/api"}
	output, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("expected the clone to succeed on a later attempt: %v\n%s", err, output)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != head {
		t.Fatalf("HEAD = %s, want %s", got, head)
	}
	if got := flaky.failures.Load(); got != 2 {
		t.Fatalf("server failed %d requests, want 2", got)
	}
	if got := strings.Count(output, "git clone acme/api: the server answered 502, trying again"); got != 2 {
		t.Fatalf("output tells of %d retries, want 2:\n%s", got, output)
	}
}

func TestFetchesAgainWhenThePackRequestAnswersBadGateway(t *testing.T) {
	requireHTTPBackend(t)
	prepare.SetRetryDelays(t, time.Millisecond, time.Millisecond, time.Millisecond)
	f := setUp(t)
	_, remote := f.served(t, "/git-upload-pack", http.StatusBadGateway, 0)

	checkout := protocol.Checkout{Remote: remote, Path: "acme/api"}
	if output, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
		t.Fatalf("first clone: %v\n%s", err, output)
	}

	pushed := f.commit(t, "NEW.md", "new\n")
	flaky, remote := f.served(t, "/git-upload-pack", http.StatusBadGateway, 1)
	checkout.Remote = remote

	output, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("expected the fetch to succeed on a later attempt: %v\n%s", err, output)
	}

	if got := git(t, f.tree(), "rev-parse", "origin/main"); got != pushed {
		t.Fatalf("origin/main = %s, want %s", got, pushed)
	}
	if got := flaky.failures.Load(); got != 1 {
		t.Fatalf("server failed %d requests, want 1", got)
	}
	if !strings.Contains(output, "git fetch in acme/api: the server answered 502, trying again") {
		t.Fatalf("output does not tell of the retry:\n%s", output)
	}
}

func TestStopsRetryingWhenTheServerKeepsFailing(t *testing.T) {
	requireHTTPBackend(t)
	prepare.SetRetryDelays(t, time.Millisecond, time.Millisecond)
	f := setUp(t)
	flaky, remote := f.served(t, "/info/refs", http.StatusServiceUnavailable, 100)

	checkout := protocol.Checkout{Remote: remote, Path: "acme/api"}
	_, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err == nil {
		t.Fatal("expected the clone to fail")
	}

	if !strings.Contains(err.Error(), "503") {
		t.Fatalf("error does not name the status: %v", err)
	}
	if got := flaky.failures.Load(); got != 3 {
		t.Fatalf("server saw %d attempts, want 3", got)
	}
}

func TestDoesNotRetryWhatTheServerRefuses(t *testing.T) {
	requireHTTPBackend(t)

	for _, status := range []int{http.StatusNotFound, http.StatusNotImplemented, http.StatusHTTPVersionNotSupported} {
		t.Run(strconv.Itoa(status), func(t *testing.T) {
			prepare.SetRetryDelays(t, time.Millisecond, time.Millisecond)
			f := setUp(t)
			flaky, remote := f.served(t, "/info/refs", status, 100)

			checkout := protocol.Checkout{Remote: remote, Path: "acme/api"}
			if _, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options()); err == nil {
				t.Fatal("expected the clone to fail")
			}

			if got := flaky.failures.Load(); got != 1 {
				t.Fatalf("server saw %d attempts, want 1", got)
			}
		})
	}
}
