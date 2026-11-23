package gitproxy_test

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/runner/internal/gitproxy"
)

func gitIn(t *testing.T, dir string, args ...string) string {
	t.Helper()

	command := exec.Command("git", append([]string{"-C", dir}, args...)...)
	command.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=Someone", "GIT_AUTHOR_EMAIL=someone@example.com",
		"GIT_COMMITTER_NAME=Someone", "GIT_COMMITTER_EMAIL=someone@example.com",
	)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, output)
	}
	return strings.TrimSpace(string(output))
}

func pkt(line string) string {
	return fmt.Sprintf("%04x%s", len(line)+4, line)
}

func TestNamesOnlyTheVerifiedFastForwardsForTheControlPlane(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	workspace := t.TempDir()
	repository := filepath.Join(workspace, "api")
	if err := os.MkdirAll(repository, 0o755); err != nil {
		t.Fatal(err)
	}
	gitIn(t, repository, "init", "--quiet", "--initial-branch", "main")
	gitIn(t, repository, "commit", "--quiet", "--allow-empty", "--message", "start")
	start := gitIn(t, repository, "rev-parse", "HEAD")
	gitIn(t, repository, "commit", "--quiet", "--allow-empty", "--message", "on top")
	onTop := gitIn(t, repository, "rev-parse", "HEAD")
	gitIn(t, repository, "switch", "--quiet", "--orphan", "rewritten")
	gitIn(t, repository, "commit", "--quiet", "--allow-empty", "--message", "rewritten")
	rewritten := gitIn(t, repository, "rev-parse", "HEAD")
	unknown := strings.Repeat("ab", 20)
	none := strings.Repeat("0", 40)

	var header, body string
	control := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		read, _ := io.ReadAll(r.Body)
		header, body = r.Header.Get(gitproxy.FastForwardsHeader), string(read)
		w.WriteHeader(http.StatusOK)
	}))
	defer control.Close()

	served, err := gitproxy.Serve(control.URL, "runner-token", "run_1", workspace, false, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	defer func() { _ = served.Close() }()

	push := pkt(start+" "+onTop+" refs/heads/forward\x00report-status\n") +
		pkt(onTop+" "+rewritten+" refs/heads/forced\n") +
		pkt(unknown+" "+onTop+" refs/heads/unseen\n") +
		pkt(none+" "+onTop+" refs/heads/new\n") +
		pkt(onTop+" "+none+" refs/heads/gone\n") +
		"0000PACK-contents"

	request, err := http.NewRequest(http.MethodPost, served.Remote+"/api/git-receive-pack", strings.NewReader(push))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/x-git-receive-pack-request")
	request.Header.Set(gitproxy.FastForwardsHeader, "refs%2Fheads%2Fforced")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	_ = response.Body.Close()

	if header != "refs%2Fheads%2Fforward" {
		t.Errorf("fast-forwards = %q, want only the push that adds to its branch", header)
	}
	if body != push {
		t.Errorf("body = %q, want the push carried through unchanged", body)
	}
}

func TestNamesNoFastForwardsForARepositoryOutsideTheWorkspace(t *testing.T) {
	var header string
	var seen bool
	control := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		header, seen = r.Header.Get(gitproxy.FastForwardsHeader), true
		w.WriteHeader(http.StatusOK)
	}))
	defer control.Close()

	served, err := gitproxy.Serve(control.URL, "runner-token", "run_1", t.TempDir(), false, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	defer func() { _ = served.Close() }()

	request, err := http.NewRequest(http.MethodPost, served.Remote+"/../escape/git-receive-pack", strings.NewReader("0000PACK"))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/x-git-receive-pack-request")
	request.Header.Set(gitproxy.FastForwardsHeader, "refs%2Fheads%2Fmain")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	_ = response.Body.Close()

	if seen && header != "" {
		t.Errorf("fast-forwards = %q, want none", header)
	}
}

func TestTrustsNoReplacedHistoryWhenItChecksAFastForward(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	workspace := t.TempDir()
	repository := filepath.Join(workspace, "api")
	if err := os.MkdirAll(repository, 0o755); err != nil {
		t.Fatal(err)
	}
	gitIn(t, repository, "init", "--quiet", "--initial-branch", "main")
	gitIn(t, repository, "commit", "--quiet", "--allow-empty", "--message", "theirs")
	theirs := gitIn(t, repository, "rev-parse", "HEAD")
	gitIn(t, repository, "switch", "--quiet", "--orphan", "rewritten")
	gitIn(t, repository, "commit", "--quiet", "--allow-empty", "--message", "rewritten")
	rewritten := gitIn(t, repository, "rev-parse", "HEAD")
	gitIn(t, repository, "replace", "--graft", rewritten, theirs)
	gitIn(t, repository, "commit-graph", "write", "--reachable")
	if err := os.WriteFile(filepath.Join(repository, ".git", "info", "grafts"), []byte(rewritten+" "+theirs+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	var header string
	control := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		header = r.Header.Get(gitproxy.FastForwardsHeader)
		w.WriteHeader(http.StatusOK)
	}))
	defer control.Close()

	served, err := gitproxy.Serve(control.URL, "runner-token", "run_1", workspace, false, nil)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	defer func() { _ = served.Close() }()

	push := pkt(theirs+" "+rewritten+" refs/heads/main\x00report-status\n") + "0000PACK"
	response, err := http.Post(served.Remote+"/api/git-receive-pack", "application/x-git-receive-pack-request", strings.NewReader(push))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	_ = response.Body.Close()

	if header != "" {
		t.Errorf("fast-forwards = %q, want none: the replaced history is not the real one", header)
	}
}
