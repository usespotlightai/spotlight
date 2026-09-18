package stackcheck_test

import (
	"context"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/stackcheck"
)

const consistent = `test -f deps/tool.txt && { ! grep -q lib app.txt || test -f lib.txt; }`

type source struct {
	mu       sync.Mutex
	answers  []protocol.StackChecks
	recorded map[string]protocol.StackChecked
	asked    int
}

func (s *source) ChangeStackChecks(context.Context, string) (protocol.StackChecks, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.asked++
	if len(s.answers) == 0 {
		return protocol.StackChecks{}, nil
	}

	next := s.answers[0]
	if len(s.answers) > 1 {
		s.answers = s.answers[1:]
	}
	for _, check := range next.Checks {
		if _, done := s.recorded[check.StackID]; done {
			return protocol.StackChecks{Waiting: next.Waiting}, nil
		}
	}
	return next, nil
}

func (s *source) RecordChangeStackCheck(_ context.Context, _ string, stackID string, checked protocol.StackChecked) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.recorded == nil {
		s.recorded = map[string]protocol.StackChecked{}
	}
	s.recorded[stackID] = checked
	return nil
}

func git(t *testing.T, dir string, args ...string) string {
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

	return string(output)
}

func write(t *testing.T, path, body string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

type workspace struct {
	dir      string
	checkout string
	whole    string
	appOnly  string
}

func setUp(t *testing.T) workspace {
	t.Helper()

	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	dir := t.TempDir()
	checkout := filepath.Join(dir, "widgets")

	write(t, filepath.Join(checkout, "app.txt"), "hello\n")
	write(t, filepath.Join(checkout, ".gitignore"), "deps/\n")
	git(t, checkout, "init", "--quiet")
	git(t, checkout, "add", "--all")
	git(t, checkout, "commit", "--quiet", "--message", "start")
	git(t, checkout, "update-ref", stackcheck.BaseRef, "HEAD")

	write(t, filepath.Join(checkout, "deps", "tool.txt"), "installed\n")
	write(t, filepath.Join(checkout, "app.txt"), "hello, using lib\n")
	write(t, filepath.Join(checkout, "lib.txt"), "lib\n")
	git(t, checkout, "add", "--intent-to-add", "--all")

	return workspace{
		dir:      dir,
		checkout: checkout,
		whole:    git(t, checkout, "diff", stackcheck.BaseRef),
		appOnly:  git(t, checkout, "diff", stackcheck.BaseRef, "--", "app.txt"),
	}
}

func (w workspace) options() stackcheck.Options {
	return stackcheck.Options{
		Dir:       w.dir,
		Checkouts: []protocol.Checkout{{Path: "widgets"}},
		Log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
		Poll:      10 * time.Millisecond,
	}
}

func TestRunChecksTheWholeChangeThenEachLayerOnItsOwn(t *testing.T) {
	w := setUp(t)
	given := &source{answers: []protocol.StackChecks{{
		Checks: []protocol.StackCheck{{
			StackID: "stack-1",
			Command: consistent,
			Steps: []protocol.CheckStep{
				{ID: stackcheck.WholeStep, Patch: w.whole},
				{ID: "c1.l1", Patch: w.appOnly},
				{ID: "c2.l1", Patch: "diff --git a/nowhere.txt b/nowhere.txt\n--- a/nowhere.txt\n+++ b/nowhere.txt\n@@ -1 +1 @@\n-a\n+b\n"},
			},
		}},
	}}}

	stackcheck.Run(context.Background(), given, "run-1", w.options())

	checked := given.recorded["stack-1"]
	if checked.Skipped != "" || len(checked.Steps) != 3 {
		t.Fatalf("checked %+v", checked)
	}

	passed := map[string]bool{}
	for _, step := range checked.Steps {
		passed[step.Step] = step.Passed
	}
	if !passed[stackcheck.WholeStep] || passed["c1.l1"] || passed["c2.l1"] {
		t.Fatalf("passed %v", passed)
	}
	if !strings.Contains(checked.Steps[2].Output, "do not apply") {
		t.Fatalf("output %q", checked.Steps[2].Output)
	}

	if got := git(t, w.checkout, "worktree", "list"); strings.Count(got, "\n") != 1 {
		t.Fatalf("left worktrees behind:\n%s", got)
	}
	if got, _ := os.ReadFile(filepath.Join(w.checkout, "app.txt")); string(got) != "hello, using lib\n" {
		t.Fatalf("the checkout changed: %q", got)
	}
}

func TestRunStopsWhereTheWholeChangeFails(t *testing.T) {
	w := setUp(t)
	given := &source{answers: []protocol.StackChecks{{
		Checks: []protocol.StackCheck{{
			StackID: "stack-1",
			Command: "echo broken; exit 3",
			Steps: []protocol.CheckStep{
				{ID: stackcheck.WholeStep, Patch: w.whole},
				{ID: "c1.l1", Patch: w.appOnly},
			},
		}},
	}}}

	stackcheck.Run(context.Background(), given, "run-1", w.options())

	steps := given.recorded["stack-1"].Steps
	if len(steps) != 1 || steps[0].Passed || steps[0].Output != "broken" {
		t.Fatalf("steps %+v", steps)
	}
}

func TestRunWaitsForAStackStillBeingDrafted(t *testing.T) {
	w := setUp(t)
	ready := protocol.StackChecks{Checks: []protocol.StackCheck{{
		StackID: "stack-1",
		Command: "true",
		Steps:   []protocol.CheckStep{{ID: stackcheck.WholeStep, Patch: w.whole}},
	}}}
	given := &source{answers: []protocol.StackChecks{{Waiting: true}, {Waiting: true}, ready}}

	stackcheck.Run(context.Background(), given, "run-1", w.options())

	if _, done := given.recorded["stack-1"]; !done || given.asked < 3 {
		t.Fatalf("asked %d times, recorded %v", given.asked, given.recorded)
	}
}

func TestRunGivesUpWaitingInTime(t *testing.T) {
	w := setUp(t)
	given := &source{answers: []protocol.StackChecks{{Waiting: true}}}
	options := w.options()
	options.Wait = 50 * time.Millisecond

	started := time.Now()
	stackcheck.Run(context.Background(), given, "run-1", options)

	if time.Since(started) > 2*time.Second {
		t.Fatalf("waited %s", time.Since(started))
	}
}

func TestRunSaysWhyItCouldNotCheck(t *testing.T) {
	w := setUp(t)
	other := "api"
	given := &source{answers: []protocol.StackChecks{{
		Checks: []protocol.StackCheck{{StackID: "stack-1", Repository: &other, Command: "true"}},
	}}}

	stackcheck.Run(context.Background(), given, "run-1", w.options())

	if got := given.recorded["stack-1"].Skipped; got != "The run has no checkout of api." {
		t.Fatalf("skipped %q", got)
	}
}

func TestRunStopsAStepThatRunsTooLong(t *testing.T) {
	w := setUp(t)
	given := &source{answers: []protocol.StackChecks{{
		Checks: []protocol.StackCheck{{
			StackID: "stack-1",
			Command: "sleep 30",
			Steps:   []protocol.CheckStep{{ID: stackcheck.WholeStep, Patch: w.whole}},
		}},
	}}}
	options := w.options()
	options.Step = 200 * time.Millisecond

	stackcheck.Run(context.Background(), given, "run-1", options)

	steps := given.recorded["stack-1"].Steps
	if len(steps) != 1 || steps[0].Passed || !strings.Contains(steps[0].Output, "did not finish") {
		t.Fatalf("steps %+v", steps)
	}
}

func TestDiffGathersEverythingChangedSinceTheRunBegan(t *testing.T) {
	w := setUp(t)
	git(t, w.checkout, "reset", "--quiet")
	before := git(t, w.checkout, "status", "--porcelain")

	diff, err := w.options().Diff(context.Background(), w.checkout)
	if err != nil {
		t.Fatalf("diff: %v", err)
	}

	for _, want := range []string{"+++ b/lib.txt", "+hello, using lib", "new file mode"} {
		if !strings.Contains(diff, want) {
			t.Errorf("diff lacks %q:\n%s", want, diff)
		}
	}
	if strings.Contains(diff, "deps/tool.txt") {
		t.Errorf("diff holds an ignored file:\n%s", diff)
	}
	if after := git(t, w.checkout, "status", "--porcelain"); after != before {
		t.Errorf("the checkout's index changed:\nbefore %q\nafter  %q", before, after)
	}
}

func TestDiffRefusesACheckoutWithNoRecordOfWhereItBegan(t *testing.T) {
	w := setUp(t)
	git(t, w.checkout, "update-ref", "-d", stackcheck.BaseRef)

	if _, err := w.options().Diff(context.Background(), w.checkout); err == nil {
		t.Fatal("expected an error")
	}
}

func TestRunChecksAStackAgainOnceItsLayersAreReordered(t *testing.T) {
	w := setUp(t)
	first := protocol.StackCheck{
		StackID: "stack-1",
		Command: "true",
		Steps:   []protocol.CheckStep{{ID: stackcheck.WholeStep, Patch: w.whole}, {ID: "c1.l1", Patch: w.appOnly}},
	}
	reordered := first
	reordered.Steps = []protocol.CheckStep{{ID: stackcheck.WholeStep, Patch: w.whole}}

	given := &reordering{answers: []protocol.StackChecks{
		{Waiting: true, Checks: []protocol.StackCheck{first}},
		{Waiting: true},
		{Checks: []protocol.StackCheck{reordered}},
	}}

	stackcheck.Run(context.Background(), given, "run-1", w.options())

	if len(given.recorded) != 2 {
		t.Fatalf("recorded %d checks, want the first stack and the reordered one", len(given.recorded))
	}
	if len(given.recorded[1].Steps) != 1 {
		t.Fatalf("the second check ran %+v", given.recorded[1].Steps)
	}
}

type reordering struct {
	answers  []protocol.StackChecks
	recorded []protocol.StackChecked
}

func (r *reordering) ChangeStackChecks(context.Context, string) (protocol.StackChecks, error) {
	next := r.answers[0]
	if len(r.answers) > 1 {
		r.answers = r.answers[1:]
	}
	return next, nil
}

func (r *reordering) RecordChangeStackCheck(_ context.Context, _ string, _ string, checked protocol.StackChecked) error {
	r.recorded = append(r.recorded, checked)
	return nil
}
