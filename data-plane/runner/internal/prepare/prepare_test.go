package prepare_test

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/prepare"
)

func git(t *testing.T, dir string, args ...string) string {
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

func write(t *testing.T, path, body string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

type fixture struct {
	origin    string
	workspace string
}

func (f fixture) commit(t *testing.T, name, body string) string {
	t.Helper()

	write(t, filepath.Join(f.origin, name), body)
	git(t, f.origin, "add", "--all")
	git(t, f.origin, "commit", "--quiet", "--message", name)
	return git(t, f.origin, "rev-parse", "HEAD")
}

func (f fixture) options() prepare.Options {
	return prepare.Options{
		Dir:    f.workspace,
		Author: prepare.Author{Name: "Spotlight", Email: "noreply@usespotlight.ai"},
	}
}

func (f fixture) checkout(branch string) protocol.Checkout {
	return protocol.Checkout{Remote: f.origin, Path: "acme/api", Branch: branch}
}

func (f fixture) tree() string {
	return filepath.Join(f.workspace, "acme", "api")
}

func setUp(t *testing.T) fixture {
	t.Helper()

	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	dir := t.TempDir()
	f := fixture{origin: filepath.Join(dir, "origin"), workspace: filepath.Join(dir, "workspace")}
	if err := os.MkdirAll(f.origin, 0o755); err != nil {
		t.Fatal(err)
	}
	git(t, f.origin, "init", "--quiet", "--initial-branch", "main")
	f.commit(t, "README.md", "hello\n")

	return f
}

func TestClonesAFreshCheckoutOntoTheRunsBranchAsTheRunsAuthor(t *testing.T) {
	f := setUp(t)

	said, err := prepare.Checkouts(context.Background(), []protocol.Checkout{f.checkout("spotlight/task-1")}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, said)
	}

	if got := git(t, f.tree(), "branch", "--show-current"); got != "spotlight/task-1" {
		t.Errorf("on %q", got)
	}
	if got := git(t, f.tree(), "config", "user.email"); got != "noreply@usespotlight.ai" {
		t.Errorf("author %q", got)
	}
	if !strings.Contains(said, "cloning acme/api") {
		t.Errorf("said %q", said)
	}
}

func TestStartsANewBranchFromWhereTheRemoteIsNowNotWhereTheImageBakedIt(t *testing.T) {
	f := setUp(t)
	git(t, filepath.Dir(f.workspace), "clone", "--quiet", f.origin, f.tree())
	write(t, filepath.Join(f.tree(), "node_modules", "installed.js"), "baked\n")
	write(t, filepath.Join(f.tree(), ".git", "info", "exclude"), "node_modules/\n")

	latest := f.commit(t, "CHANGELOG.md", "moved on\n")

	elsewhere := f.checkout("spotlight/task-1")
	elsewhere.Remote = f.origin + "/."

	said, err := prepare.Checkouts(context.Background(), []protocol.Checkout{elsewhere}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, said)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != latest {
		t.Errorf("the branch starts at %s, want the remote's %s", got, latest)
	}
	if got := git(t, f.tree(), "remote", "get-url", "origin"); got != elsewhere.Remote {
		t.Errorf("fetched from %q", got)
	}
	if _, err := os.Stat(filepath.Join(f.tree(), "node_modules", "installed.js")); err != nil {
		t.Errorf("what the image installed is gone: %v", err)
	}
	if !strings.Contains(said, "reusing acme/api") {
		t.Errorf("said %q", said)
	}
}

func TestReturnsToTheBranchARestoredCheckoutWasLeftOn(t *testing.T) {
	f := setUp(t)
	checkout := f.checkout("spotlight/task-1")

	if _, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(f.tree(), "halfway.md"), "not committed\n")
	git(t, f.tree(), "switch", "--quiet", "main")
	f.commit(t, "CHANGELOG.md", "moved on\n")

	if _, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
		t.Fatal(err)
	}

	if got := git(t, f.tree(), "branch", "--show-current"); got != "spotlight/task-1" {
		t.Errorf("on %q", got)
	}
	if _, err := os.Stat(filepath.Join(f.tree(), "halfway.md")); err != nil {
		t.Errorf("the work left halfway is gone: %v", err)
	}
}

func (f fixture) push(t *testing.T, branch, name, body string) string {
	t.Helper()

	git(t, f.origin, "switch", "--quiet", branch)
	pushed := f.commit(t, name, body)
	git(t, f.origin, "switch", "--quiet", "main")
	return pushed
}

func (f fixture) restored(t *testing.T, branch string) protocol.Checkout {
	t.Helper()

	git(t, f.origin, "branch", branch)
	checkout := f.checkout(branch)
	if _, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
		t.Fatal(err)
	}
	return checkout
}

func TestCatchesARestoredCheckoutUpWithWhatWasPushedToItsBranch(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "halfway.md"), "not committed\n")

	pushed := f.push(t, "spotlight/task-1", "REVIEW.md", "a person's fix\n")

	said, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, said)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != pushed {
		t.Errorf("the branch is at %s, want what was pushed, %s", got, pushed)
	}
	if _, err := os.Stat(filepath.Join(f.tree(), "halfway.md")); err != nil {
		t.Errorf("the work left halfway is gone: %v", err)
	}
	if !strings.Contains(said, "caught acme/api up") {
		t.Errorf("said %q", said)
	}
}

func TestLeavesARestoredCheckoutAloneWhenItsBranchMovedOnBothHereAndOnTheRemote(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "local.md"), "the last run's\n")
	git(t, f.tree(), "add", "--all")
	git(t, f.tree(), "commit", "--quiet", "--message", "local")
	local := git(t, f.tree(), "rev-parse", "HEAD")

	f.push(t, "spotlight/task-1", "REVIEW.md", "a person's fix\n")

	said, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, said)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != local {
		t.Errorf("the branch moved to %s, want it left at %s", got, local)
	}
	if !strings.Contains(said, "moved on both here and on the remote") {
		t.Errorf("said %q", said)
	}
}

func TestLeavesARestoredCheckoutBehindWhenUncommittedWorkBlocksIt(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	before := git(t, f.tree(), "rev-parse", "HEAD")
	write(t, filepath.Join(f.tree(), "README.md"), "halfway through a rewrite\n")

	f.push(t, "spotlight/task-1", "README.md", "a person's rewrite\n")

	said, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, said)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != before {
		t.Errorf("the branch moved to %s, want it left at %s", got, before)
	}
	if body, _ := os.ReadFile(filepath.Join(f.tree(), "README.md")); string(body) != "halfway through a rewrite\n" {
		t.Errorf("the work left halfway now reads %q", body)
	}
	if !strings.Contains(said, "uncommitted changes here block the fast-forward") {
		t.Errorf("said %q", said)
	}
}

func TestSaysNothingOfCatchingUpWhereTheLastRunIsAheadOfWhatWasPushed(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "local.md"), "the last run's\n")
	git(t, f.tree(), "add", "--all")
	git(t, f.tree(), "commit", "--quiet", "--message", "local")

	said, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, said)
	}

	if said != "reusing acme/api" {
		t.Errorf("said %q", said)
	}
}

func TestChecksOutARefTheCloneDoesNotHave(t *testing.T) {
	f := setUp(t)
	git(t, f.origin, "switch", "--quiet", "-c", "feature")
	head := f.commit(t, "feature.md", "reviewed\n")
	git(t, f.origin, "update-ref", "refs/pull/7/head", head)
	git(t, f.origin, "switch", "--quiet", "main")
	git(t, f.origin, "branch", "--quiet", "-D", "feature")

	reviewed := f.checkout("spotlight/review-7")
	reviewed.Ref = "refs/pull/7/head"

	if said, err := prepare.Checkouts(context.Background(), []protocol.Checkout{reviewed}, f.options()); err != nil {
		t.Fatalf("prepare: %v\n%s", err, said)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != head {
		t.Errorf("at %s, want the pull request's %s", got, head)
	}
}

func TestChecksOutACommitOnlyTheRestoredCheckoutHas(t *testing.T) {
	f := setUp(t)
	f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "local.md"), "never pushed\n")
	git(t, f.tree(), "add", "--all")
	git(t, f.tree(), "-c", "user.name=Someone", "-c", "user.email=someone@example.com", "commit", "--quiet", "--message", "local")
	local := git(t, f.tree(), "rev-parse", "HEAD")
	git(t, f.tree(), "switch", "--quiet", "--detach", "HEAD~1")

	replayed := f.checkout("")
	replayed.Ref = local

	if said, err := prepare.Checkouts(context.Background(), []protocol.Checkout{replayed}, f.options()); err != nil {
		t.Fatalf("prepare: %v\n%s", err, said)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != local {
		t.Errorf("at %s, want the commit only the restored checkout has, %s", got, local)
	}
}

func TestClonesFromTheHostsMirrorWithoutDependingOnIt(t *testing.T) {
	f := setUp(t)
	mirrors := filepath.Join(filepath.Dir(f.workspace), "mirrors")
	git(t, filepath.Dir(f.workspace), "clone", "--quiet", "--bare", f.origin, filepath.Join(mirrors, "acme", "api.git"))

	options := f.options()
	options.Mirrors = mirrors

	said, err := prepare.Checkouts(context.Background(), []protocol.Checkout{f.checkout("")}, options)
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, said)
	}

	if !strings.Contains(said, "from the host's mirror") {
		t.Errorf("said %q", said)
	}
	if _, err := os.Stat(filepath.Join(f.tree(), ".git", "objects", "info", "alternates")); !os.IsNotExist(err) {
		t.Errorf("the clone still leans on the mirror: %v", err)
	}
}

func TestFailsOnARemoteItCannotReach(t *testing.T) {
	f := setUp(t)
	gone := f.checkout("")
	gone.Remote = filepath.Join(f.origin, "missing")

	if _, err := prepare.Checkouts(context.Background(), []protocol.Checkout{gone}, f.options()); err == nil {
		t.Fatal("expected the clone to fail")
	}
}

func TestSetupRunsInTheCheckout(t *testing.T) {
	tree := t.TempDir()

	said, err := prepare.Setup(context.Background(), tree, "echo installing && touch installed", nil, 0, nil)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	if said != "installing" {
		t.Errorf("said %q", said)
	}
	if _, err := os.Stat(filepath.Join(tree, "installed")); err != nil {
		t.Errorf("setup did not run in the checkout: %v", err)
	}
}

func TestSetupGoesOutThroughTheWayOut(t *testing.T) {
	said, err := prepare.Setup(context.Background(), t.TempDir(), "echo $HTTPS_PROXY", nil, 0,
		map[string]string{"HTTPS_PROXY": "http://127.0.0.1:3128"})
	if err != nil || said != "http://127.0.0.1:3128" {
		t.Errorf("said %q: %v", said, err)
	}
}

func TestSetupThatTakesTooLongIsStopped(t *testing.T) {
	_, err := prepare.Setup(context.Background(), t.TempDir(), "sleep 5", nil, 100*time.Millisecond, nil)
	if err == nil || !strings.Contains(err.Error(), "did not finish") {
		t.Fatalf("got %v", err)
	}
}
