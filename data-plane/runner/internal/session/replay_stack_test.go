package session_test

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/cgi"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/gitproxy"
	"usespotlight.ai/data-plane/runner/internal/session"
)

func inRepository(t *testing.T, dir string, args ...string) string {
	t.Helper()

	command := exec.Command("git", append([]string{"-C", dir}, args...)...)
	command.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=Spotlight", "GIT_AUTHOR_EMAIL=noreply@usespotlight.ai",
		"GIT_COMMITTER_NAME=Spotlight", "GIT_COMMITTER_EMAIL=noreply@usespotlight.ai",
	)

	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, output)
	}

	return strings.TrimSpace(string(output))
}

type servedRepository struct {
	url    string
	commit string
}

func servingGit(t *testing.T, runID string) servedRepository {
	t.Helper()

	gitPath, err := exec.LookPath("git")
	if err != nil {
		t.Skip("git is not installed")
	}

	root := t.TempDir()
	work := filepath.Join(t.TempDir(), "api")
	if err := os.MkdirAll(work, 0o755); err != nil {
		t.Fatal(err)
	}
	inRepository(t, work, "init", "--quiet", "--initial-branch=main")
	if err := os.WriteFile(filepath.Join(work, "queue.js"), []byte("stall()\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	inRepository(t, work, "add", ".")
	inRepository(t, work, "commit", "--quiet", "--message", "start")
	commit := inRepository(t, work, "rev-parse", "HEAD")

	bare := filepath.Join(root, runID, "api")
	if err := os.MkdirAll(filepath.Dir(bare), 0o755); err != nil {
		t.Fatal(err)
	}
	inRepository(t, filepath.Dir(bare), "clone", "--quiet", "--bare", work, bare)

	backend := &cgi.Handler{
		Path: gitPath,
		Args: []string{"http-backend"},
		Root: "/api/git",
		Env:  []string{"GIT_PROJECT_ROOT=" + root, "GIT_HTTP_EXPORT_ALL=1"},
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		r.ContentLength = int64(len(body))
		r.TransferEncoding = nil
		backend.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)

	return servedRepository{url: server.URL, commit: commit}
}

func TestAReplayHandsOverItsChangeBeforeItEndsFromABaseItsCheckCanFetch(t *testing.T) {
	served := servingGit(t, "run_1")
	written := &journal{}

	err := session.Execute(context.Background(), protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Command: protocol.Command{Executable: harness(t,
				`require("node:fs").writeFileSync("api/queue.js", "drain()\n"); said = "drained";`, "end_turn")},
			Continuity: protocol.Continuity{Key: "replay-run_1"},
			Checkouts:  []protocol.Checkout{{Remote: "spotlight:repository", Path: "api", Ref: served.commit}},
			Diffs:      true,
			Replay: &protocol.Replay{Checkouts: []protocol.StartedCheckout{
				{Path: "api", Commit: served.commit},
			}},
		},
	}, session.Options{
		Workspace:    t.TempDir(),
		Journal:      written,
		Log:          slog.New(slog.NewTextHandler(io.Discard, nil)),
		ControlPlane: served.url,
		Token:        "runner-token",
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	if len(written.drafted) != 1 {
		t.Fatalf("drafted %d stacks, want the one checkout's", len(written.drafted))
	}
	drafted := written.drafted[0]
	if !strings.Contains(drafted.diff, "+drain()") {
		t.Errorf("drafted %q, want the replay's change", drafted.diff)
	}
	if drafted.base != served.commit {
		t.Errorf("drafted from base %q, want the commit the replay started at, %q", drafted.base, served.commit)
	}
	if got := strings.Join(written.calls, ","); !strings.HasSuffix(got, "draft,complete") {
		t.Errorf("called %s, want the stack drafted before the run completed", got)
	}

	fetching, err := gitproxy.Serve(served.url, "check-token", "run_1", true)
	if err != nil {
		t.Fatalf("serve: %v", err)
	}
	defer func() { _ = fetching.Close() }()

	checking := t.TempDir()
	inRepository(t, checking, "init", "--quiet")
	inRepository(t, checking, "fetch", "--quiet", fetching.Remote+"/api", drafted.base)
	if got := inRepository(t, checking, "rev-parse", "FETCH_HEAD"); got != served.commit {
		t.Errorf("a check fetched %q, want the base %q", got, served.commit)
	}

	pushing := exec.Command("git", "-C", checking, "push", "--quiet", fetching.Remote+"/api", "FETCH_HEAD:refs/heads/elsewhere")
	if output, err := pushing.CombinedOutput(); err == nil {
		t.Errorf("a check pushed through a fetch-only proxy: %s", output)
	}
}

func TestATaskRunStillHandsOverItsChangeAfterItsTurnIsReported(t *testing.T) {
	served := servingGit(t, "run_1")
	written := &journal{}

	err := session.Execute(context.Background(), protocol.Run{
		ID: "run_1",
		Spec: protocol.Spec{
			Command: protocol.Command{Executable: harness(t,
				`require("node:fs").writeFileSync("api/queue.js", "drain()\n"); said = "drained";`, "end_turn")},
			Continuity: protocol.Continuity{Key: "task-1"},
			Checkouts:  []protocol.Checkout{{Remote: "spotlight:repository", Path: "api", Ref: served.commit}},
			Diffs:      true,
		},
	}, session.Options{
		Workspace:    t.TempDir(),
		Journal:      written,
		Log:          slog.New(slog.NewTextHandler(io.Discard, nil)),
		ControlPlane: served.url,
		Token:        "runner-token",
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	if got := strings.Join(written.calls, ","); !strings.HasSuffix(got, "complete,draft") {
		t.Errorf("called %s, want the stack drafted after the turn was reported", got)
	}
}
