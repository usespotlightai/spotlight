package stackcheck_test

import (
	"context"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/internal/protocol"
	"usespotlight.ai/data-plane/runner/internal/stackcheck"
)

const consistent = `! grep -q lib app.txt || test -f lib.txt`

type reporter struct {
	recorded []protocol.StackChecked
	stacks   []string
}

func (r *reporter) RecordChangeStackCheck(
	_ context.Context, _ string, stackID string, checked protocol.StackChecked,
) error {
	r.recorded = append(r.recorded, checked)
	r.stacks = append(r.stacks, stackID)
	return nil
}

func (r *reporter) only() protocol.StackChecked {
	if len(r.recorded) != 1 {
		panic("nothing recorded")
	}
	return r.recorded[0]
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

	return strings.TrimSpace(string(output))
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

type remote struct {
	dir     string
	origin  string
	base    string
	whole   string
	appOnly string
}

func setUp(t *testing.T) remote {
	t.Helper()

	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	dir := t.TempDir()
	origin := filepath.Join(dir, "origin", "widgets")

	write(t, filepath.Join(origin, "app.txt"), "hello\n")
	write(t, filepath.Join(origin, ".gitignore"), "deps/\n")
	git(t, origin, "init", "--quiet")
	git(t, origin, "add", "--all")
	git(t, origin, "commit", "--quiet", "--message", "start")

	base := git(t, origin, "rev-parse", "HEAD")

	write(t, filepath.Join(origin, "app.txt"), "hello, using lib\n")
	write(t, filepath.Join(origin, "lib.txt"), "lib\n")
	git(t, origin, "add", "--intent-to-add", "--all")

	found := remote{
		dir:     dir,
		origin:  filepath.Join(dir, "origin"),
		base:    base,
		whole:   git(t, origin, "diff", base) + "\n",
		appOnly: git(t, origin, "diff", base, "--", "app.txt") + "\n",
	}

	git(t, origin, "reset", "--quiet", "--hard", base)
	git(t, origin, "clean", "-fdq")

	return found
}

func (r remote) options() stackcheck.Options {
	return stackcheck.Options{
		Dir:    filepath.Join(r.dir, "workspaces"),
		Remote: r.origin,
		Log:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

func (r remote) check(steps ...protocol.CheckStep) protocol.StackCheck {
	return protocol.StackCheck{
		StackID:    "stack-1",
		RunID:      "run-1",
		Repository: "widgets",
		Base:       r.base,
		Command:    consistent,
		Steps:      steps,
	}
}

func whole(patch string) protocol.CheckStep {
	return protocol.CheckStep{ID: "whole", Patch: patch, StopsOnFailure: true, RunsSetup: true}
}

func TestPerformChecksTheWholeChangeThenEachLayerOnItsOwn(t *testing.T) {
	r := setUp(t)
	told := &reporter{}

	stackcheck.Perform(context.Background(), told, r.check(
		whole(r.whole),
		protocol.CheckStep{ID: "c1.l1", Patch: r.appOnly},
		protocol.CheckStep{
			ID:    "c2.l1",
			Patch: "diff --git a/nowhere.txt b/nowhere.txt\n--- a/nowhere.txt\n+++ b/nowhere.txt\n@@ -1 +1 @@\n-a\n+b\n",
		},
	), r.options())

	checked := told.only()
	if checked.Skipped != nil || len(checked.Steps) != 3 {
		t.Fatalf("checked %+v", checked)
	}

	passed := map[string]bool{}
	for _, step := range checked.Steps {
		passed[step.Step] = step.Passed
	}
	if !passed["whole"] || passed["c1.l1"] || passed["c2.l1"] {
		t.Fatalf("passed %v", passed)
	}
	if !strings.Contains(checked.Steps[2].Output, "do not apply") {
		t.Fatalf("output %q", checked.Steps[2].Output)
	}
	if told.stacks[0] != "stack-1" {
		t.Fatalf("reported against %q", told.stacks[0])
	}
}

func TestPerformStopsWhereAStepSaysItShould(t *testing.T) {
	r := setUp(t)
	told := &reporter{}

	check := r.check(whole(r.whole), protocol.CheckStep{ID: "c1.l1", Patch: r.appOnly})
	check.Command = "echo broken; exit 3"

	stackcheck.Perform(context.Background(), told, check, r.options())

	steps := told.only().Steps
	if len(steps) != 1 || steps[0].Passed || steps[0].Output != "broken" {
		t.Fatalf("steps %+v", steps)
	}
}

func TestPerformRunsEveryStepWhereNoneStopsTheRest(t *testing.T) {
	r := setUp(t)
	told := &reporter{}

	check := r.check(
		protocol.CheckStep{ID: "whole", Patch: r.whole},
		protocol.CheckStep{ID: "c1.l1", Patch: r.appOnly},
	)
	check.Command = "exit 1"

	stackcheck.Perform(context.Background(), told, check, r.options())

	if steps := told.only().Steps; len(steps) != 2 {
		t.Fatalf("steps %+v", steps)
	}
}

func TestPerformMakesTheCheckoutReadyFirst(t *testing.T) {
	r := setUp(t)
	told := &reporter{}

	check := r.check(whole(r.whole))
	check.Setup = "mkdir -p deps && echo installed > deps/tool.txt"
	check.Command = "test -f deps/tool.txt"

	stackcheck.Perform(context.Background(), told, check, r.options())

	steps := told.only().Steps
	if len(steps) != 1 || !steps[0].Passed {
		t.Fatalf("steps %+v", steps)
	}
}

func TestPerformSaysWhenTheCheckoutCouldNotBeMadeReady(t *testing.T) {
	r := setUp(t)
	told := &reporter{}

	check := r.check(whole(r.whole))
	check.Setup = "echo no network; exit 1"

	stackcheck.Perform(context.Background(), told, check, r.options())

	skipped := told.only().Skipped
	if skipped == nil || skipped.Code != protocol.SkipSetupFailed {
		t.Fatalf("skipped %+v", skipped)
	}
	if !strings.Contains(skipped.Detail, "no network") {
		t.Fatalf("detail %q", skipped.Detail)
	}
}

func TestPerformKeepsWhatSetupLaidDownBetweenSteps(t *testing.T) {
	r := setUp(t)
	told := &reporter{}

	check := r.check(
		whole(r.whole),
		protocol.CheckStep{ID: "c1.l1", Patch: r.appOnly},
	)
	check.Setup = "mkdir -p deps && echo installed > deps/tool.txt"
	check.Command = "test -f deps/tool.txt"

	stackcheck.Perform(context.Background(), told, check, r.options())

	for _, step := range told.only().Steps {
		if !step.Passed {
			t.Fatalf("%s lost what setup laid down: %q", step.Step, step.Output)
		}
	}
}

func TestPerformSaysWhyItCouldNotCheck(t *testing.T) {
	r := setUp(t)

	for _, missing := range []struct {
		name  string
		code  string
		spoil func(*protocol.StackCheck)
	}{
		{"no base", protocol.SkipNoBase, func(c *protocol.StackCheck) { c.Base = "" }},
		{"no repository", protocol.SkipNoCheckout, func(c *protocol.StackCheck) { c.Repository = "" }},
		{"no such commit", protocol.SkipCheckoutFailed, func(c *protocol.StackCheck) {
			c.Base = "0123456789abcdef0123456789abcdef01234567"
		}},
		{"no such repository", protocol.SkipCheckoutFailed, func(c *protocol.StackCheck) { c.Repository = "other" }},
	} {
		t.Run(missing.name, func(t *testing.T) {
			told := &reporter{}
			check := r.check(whole(r.whole))
			missing.spoil(&check)

			stackcheck.Perform(context.Background(), told, check, r.options())

			skipped := told.only().Skipped
			if skipped == nil || skipped.Code != missing.code {
				t.Fatalf("skipped %+v, want %s", skipped, missing.code)
			}
		})
	}
}

func TestPerformStopsAStepThatRunsTooLong(t *testing.T) {
	r := setUp(t)
	told := &reporter{}

	check := r.check(whole(r.whole))
	check.Command = "sleep 30"

	options := r.options()
	options.Step = 200 * time.Millisecond

	stackcheck.Perform(context.Background(), told, check, options)

	steps := told.only().Steps
	if len(steps) != 1 || steps[0].Passed {
		t.Fatalf("steps %+v", steps)
	}
	if !strings.Contains(steps[0].Output, "did not finish") {
		t.Fatalf("output %q", steps[0].Output)
	}
}

func TestPerformLeavesNothingBehind(t *testing.T) {
	r := setUp(t)
	told := &reporter{}
	options := r.options()

	stackcheck.Perform(context.Background(), told, r.check(whole(r.whole)), options)

	entries, err := os.ReadDir(options.Dir)
	if err != nil {
		t.Fatalf("read the workspace root: %v", err)
	}
	if len(entries) != 0 {
		t.Fatalf("left %d directories behind", len(entries))
	}
}

func TestDiffGathersEverythingChangedSinceTheRunBegan(t *testing.T) {
	r := setUp(t)
	checkout := filepath.Join(r.origin, "widgets")
	git(t, checkout, "update-ref", stackcheck.BaseRef, r.base)
	write(t, filepath.Join(checkout, "deps", "tool.txt"), "installed\n")
	write(t, filepath.Join(checkout, "app.txt"), "hello, using lib\n")
	write(t, filepath.Join(checkout, "lib.txt"), "lib\n")

	before := git(t, checkout, "status", "--porcelain")

	diff, err := r.options().Diff(context.Background(), checkout)
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
	if after := git(t, checkout, "status", "--porcelain"); after != before {
		t.Errorf("the checkout's index changed:\nbefore %q\nafter  %q", before, after)
	}
}

func TestCommittedDiffsOnlyWhatWasCommittedSinceTheRunBegan(t *testing.T) {
	r := setUp(t)
	checkout := filepath.Join(r.origin, "widgets")
	git(t, checkout, "update-ref", stackcheck.BaseRef, r.base)

	write(t, filepath.Join(checkout, "pulled.txt"), "from the pull request\n")
	git(t, checkout, "add", "pulled.txt")
	git(t, checkout, "commit", "--quiet", "--message", "pull request")
	write(t, filepath.Join(checkout, "lib.txt"), "lib\n")

	diff, err := r.options().Committed(context.Background(), checkout)
	if err != nil {
		t.Fatalf("diff: %v", err)
	}

	if !strings.Contains(diff, "+from the pull request") {
		t.Errorf("diff lacks what was committed:\n%s", diff)
	}
	if strings.Contains(diff, "lib.txt") {
		t.Errorf("diff holds what was left in the working tree:\n%s", diff)
	}
}

func TestDiffRefusesACheckoutWithNoRecordOfWhereItBegan(t *testing.T) {
	r := setUp(t)

	if _, err := r.options().Diff(context.Background(), filepath.Join(r.origin, "widgets")); err == nil {
		t.Fatal("expected an error")
	}
}

func TestPerformMakesTheCheckoutReadyAgainOnlyWhereAStepAsksFor(t *testing.T) {
	r := setUp(t)
	told := &reporter{}

	check := r.check(
		whole(r.whole),
		protocol.CheckStep{ID: "c1.l1", Patch: r.appOnly},
		protocol.CheckStep{ID: "c1.l2", Patch: r.appOnly, RunsSetup: true},
	)
	check.Setup = "mkdir -p deps && printf x >> deps/marks.txt"
	check.Command = "true"

	options := r.options()
	options.KeepDirs = true

	stackcheck.Perform(context.Background(), told, check, options)

	if steps := told.only().Steps; len(steps) != 3 {
		t.Fatalf("steps %+v", steps)
	}

	// deps/ is ignored, so git clean leaves it between steps the way it leaves
	// an installed node_modules, and it carries a mark for each time the
	// checkout was made ready.
	ready, err := os.ReadFile(
		filepath.Join(r.dir, "workspaces", "check-stack-1", "widgets", "deps", "marks.txt"),
	)
	if err != nil {
		t.Fatalf("read what setup left: %v", err)
	}
	if string(ready) != "xx" {
		t.Fatalf("setup ran %d times, want once for the whole change and once for the step that asked", len(ready))
	}
}

func TestPerformJudgesAStepThatCannotBeMadeReady(t *testing.T) {
	r := setUp(t)
	told := &reporter{}

	check := r.check(
		whole(r.whole),
		protocol.CheckStep{ID: "c1.l1", Patch: r.appOnly, RunsSetup: true},
	)
	check.Setup = "test -f lib.txt || { echo cannot install; exit 1; }"
	check.Command = "true"

	stackcheck.Perform(context.Background(), told, check, r.options())

	checked := told.only()
	if checked.Skipped != nil {
		t.Fatalf("skipped the whole check for one step: %+v", checked.Skipped)
	}
	if len(checked.Steps) != 2 || checked.Steps[1].Passed {
		t.Fatalf("steps %+v", checked.Steps)
	}
	if !strings.Contains(checked.Steps[1].Output, "cannot install") {
		t.Fatalf("output %q", checked.Steps[1].Output)
	}
}

func TestPerformBorrowsTheHostsMirrorWhereThereIsOne(t *testing.T) {
	r := setUp(t)
	told := &reporter{}

	mirrors := filepath.Join(r.dir, "mirrors")
	git(t, r.dir, "clone", "--quiet", "--bare", filepath.Join(r.origin, "widgets"), filepath.Join(mirrors, "widgets.git"))

	options := r.options()
	options.Mirrors = mirrors
	options.KeepDirs = true

	stackcheck.Perform(context.Background(), told, r.check(whole(r.whole)), options)

	if steps := told.only().Steps; len(steps) != 1 || !steps[0].Passed {
		t.Fatalf("steps %+v", told.only())
	}

	borrowed, err := os.ReadFile(filepath.Join(
		r.dir, "workspaces", "check-stack-1", "widgets", ".git", "objects", "info", "alternates"))
	if err != nil {
		t.Fatalf("the checkout did not borrow: %v", err)
	}
	if want := filepath.Join(mirrors, "widgets.git", "objects"); strings.TrimSpace(string(borrowed)) != want {
		t.Errorf("borrowed from %q, want %q", borrowed, want)
	}
}
