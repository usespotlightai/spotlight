package session

import (
	"context"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestASandboxSkipsASetupWhoseInputsDidNotChange(t *testing.T) {
	dir := t.TempDir()
	tree := filepath.Join(dir, "web")
	if err := os.MkdirAll(tree, 0o755); err != nil {
		t.Fatal(err)
	}
	if output, err := exec.Command("git", "-C", tree, "init", "--quiet").CombinedOutput(); err != nil {
		t.Fatalf("git init: %v: %s", err, output)
	}
	lockfile := filepath.Join(tree, "package-lock.json")
	writeFile(t, lockfile, "{}")
	installs := filepath.Join(dir, "installs")

	checkouts := []protocol.Checkout{{Path: "web", Setup: "test ! -e fail && echo installed >> " + installs}}
	done := setUps{}
	journal := &journalWriter{}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	setUp := func() []setupFailure {
		return Options{}.setUp(context.Background(), dir, checkouts, done, journal, log)
	}

	count := func() int {
		body, err := os.ReadFile(installs)
		if os.IsNotExist(err) {
			return 0
		}
		if err != nil {
			t.Fatal(err)
		}
		return strings.Count(string(body), "installed")
	}

	setUp()
	setUp()
	if count() != 1 {
		t.Fatalf("setup ran %d times for unchanged inputs, want 1", count())
	}
	if last := journal.pending[len(journal.pending)-1]; !strings.HasPrefix(string(last.Data), "Skipped setup for web:") {
		t.Errorf("the journal says %q for the skipped setup", last.Data)
	}

	writeFile(t, lockfile, `{"lockfileVersion":3}`)
	setUp()
	if count() != 2 {
		t.Fatalf("setup ran %d times after the lockfile changed, want 2", count())
	}

	writeFile(t, lockfile, `{"lockfileVersion":3,"packages":{}}`)
	writeFile(t, filepath.Join(tree, "fail"), "")
	if failures := setUp(); len(failures) != 1 {
		t.Fatalf("a failing setup reported %d failures", len(failures))
	}
	if err := os.Remove(filepath.Join(tree, "fail")); err != nil {
		t.Fatal(err)
	}
	setUp()
	if count() != 3 {
		t.Errorf("setup ran %d times after a failed setup, want 3: a failed setup must not count as done", count())
	}
}

func writeFile(t *testing.T, path, body string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestSetupsThatMissRunAtTheSameTime(t *testing.T) {
	dir := t.TempDir()
	waitFor := func(own, other string) string {
		return "touch ../" + own + ".started; i=0; while [ ! -e ../" + other + ".started ] && [ $i -lt 100 ]; do sleep 0.05; i=$((i+1)); done; test -e ../" + other + ".started"
	}
	checkouts := []protocol.Checkout{
		{Path: "web", Setup: waitFor("web", "api")},
		{Path: "docs"},
		{Path: "api", Setup: waitFor("api", "web")},
		{Path: "infra", Setup: "exit 3"},
	}
	for _, checkout := range checkouts {
		if err := os.MkdirAll(filepath.Join(dir, checkout.Path), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	failures := Options{}.setUp(context.Background(), dir, checkouts, setUps{}, &journalWriter{}, log)

	if len(failures) != 1 || failures[0].path != "infra" {
		t.Errorf("the setups that wait for each other did not overlap, or the wrong ones failed: %+v", failures)
	}
}
