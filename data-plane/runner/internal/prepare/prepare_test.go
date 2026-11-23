package prepare_test

import (
	"context"
	"fmt"
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

	output, err := prepared(context.Background(), []protocol.Checkout{f.checkout("spotlight/task-1")}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	if got := git(t, f.tree(), "branch", "--show-current"); got != "spotlight/task-1" {
		t.Errorf("on %q", got)
	}
	if got := git(t, f.tree(), "config", "user.email"); got != "noreply@usespotlight.ai" {
		t.Errorf("author %q", got)
	}
	if !strings.Contains(output, "cloning acme/api") {
		t.Errorf("output %q", output)
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

	output, err := prepared(context.Background(), []protocol.Checkout{elsewhere}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
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
	if !strings.Contains(output, "reusing acme/api") {
		t.Errorf("output %q", output)
	}
}

func TestReturnsToTheBranchARestoredCheckoutWasLeftOn(t *testing.T) {
	f := setUp(t)
	checkout := f.checkout("spotlight/task-1")

	if _, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(f.tree(), "halfway.md"), "not committed\n")
	git(t, f.tree(), "switch", "--quiet", "main")
	f.commit(t, "CHANGELOG.md", "moved on\n")

	if _, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
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
	if _, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
		t.Fatal(err)
	}
	return checkout
}

func TestCatchesARestoredCheckoutUpWithWhatWasPushedToItsBranch(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "halfway.md"), "not committed\n")

	pushed := f.push(t, "spotlight/task-1", "REVIEW.md", "a person's fix\n")

	output, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != pushed {
		t.Errorf("the branch is at %s, want what was pushed, %s", got, pushed)
	}
	if _, err := os.Stat(filepath.Join(f.tree(), "halfway.md")); err != nil {
		t.Errorf("the work left halfway is gone: %v", err)
	}
	if !strings.Contains(output, "caught acme/api up") {
		t.Errorf("output %q", output)
	}
}

func TestRebasesTheLastRunsCommitsOntoWhatWasPushedWhenTheBranchMovedOnBothSides(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "local.md"), "the last run's\n")
	git(t, f.tree(), "add", "--all")
	git(t, f.tree(), "commit", "--quiet", "--message", "local")
	local := git(t, f.tree(), "rev-parse", "HEAD")

	pushed := f.push(t, "spotlight/task-1", "REVIEW.md", "a person's fix\n")

	done, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, done.Output)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD~1"); got != pushed {
		t.Errorf("the last run's commit sits on %s, want it on what was pushed, %s", got, pushed)
	}
	if got := git(t, f.tree(), "show", "--quiet", "--format=%s", "HEAD"); got != "local" {
		t.Errorf("HEAD is %q, want the last run's commit", got)
	}
	if got := git(t, f.tree(), "for-each-ref", "--format=%(objectname)", "refs/spotlight/diverged/spotlight/task-1/"); got != local {
		t.Errorf("the commits before the rebase are kept at %s, want %s", got, local)
	}
	if len(done.Notes) != 1 || !strings.Contains(done.Notes[0], "rebased the commits of the last run") {
		t.Errorf("notes %q", done.Notes)
	}
}

func TestResetsToWhatWasPushedAndKeepsTheLastRunsCommitsWhenTheyDoNotRebase(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "README.md"), "the last run's rewrite\n")
	git(t, f.tree(), "commit", "--quiet", "--all", "--message", "local")
	local := git(t, f.tree(), "rev-parse", "HEAD")

	pushed := f.push(t, "spotlight/task-1", "README.md", "a person's rewrite\n")

	done, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, done.Output)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != pushed {
		t.Errorf("the branch is at %s, want what was pushed, %s", got, pushed)
	}
	if got := git(t, f.tree(), "status", "--porcelain"); got != "" {
		t.Errorf("the tree is not clean after the reset: %q", got)
	}
	if got := git(t, f.tree(), "for-each-ref", "--format=%(objectname)", "refs/spotlight/diverged/spotlight/task-1/"); got != local {
		t.Errorf("the last run's commits are kept at %s, want %s", got, local)
	}
	if !strings.Contains(done.Output, "did not rebase onto it cleanly") {
		t.Errorf("output %q", done.Output)
	}
}

func TestLeavesADivergedCheckoutAloneWhenUncommittedWorkBlocksARebase(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "local.md"), "the last run's\n")
	git(t, f.tree(), "add", "--all")
	git(t, f.tree(), "commit", "--quiet", "--message", "local")
	local := git(t, f.tree(), "rev-parse", "HEAD")
	write(t, filepath.Join(f.tree(), "halfway.md"), "not committed\n")

	f.push(t, "spotlight/task-1", "REVIEW.md", "a person's fix\n")

	done, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, done.Output)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != local {
		t.Errorf("the branch moved to %s, want it left at %s", got, local)
	}
	if _, err := os.Stat(filepath.Join(f.tree(), "halfway.md")); err != nil {
		t.Errorf("the work left halfway is gone: %v", err)
	}
	if len(done.Notes) != 1 || !strings.Contains(done.Notes[0], "git rebase origin/spotlight/task-1") {
		t.Errorf("notes %q", done.Notes)
	}
}

func TestSwitchesBackToTheTasksBranchAndSaysWhereTheLastRunLeftIt(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	git(t, f.tree(), "switch", "--quiet", "-c", "elsewhere")

	done, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, done.Output)
	}

	if got := git(t, f.tree(), "branch", "--show-current"); got != "spotlight/task-1" {
		t.Errorf("on %q", got)
	}
	if len(done.Notes) != 1 || !strings.Contains(done.Notes[0], "left acme/api on the branch elsewhere") {
		t.Errorf("notes %q", done.Notes)
	}
}

func TestReportsWhyASwitchFailsInsteadOfTryingToMakeTheBranchAgain(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	git(t, f.tree(), "switch", "--quiet", "-c", "elsewhere")
	write(t, filepath.Join(f.tree(), "README.md"), "elsewhere\n")
	git(t, f.tree(), "commit", "--quiet", "--all", "--message", "elsewhere")
	write(t, filepath.Join(f.tree(), "README.md"), "halfway\n")

	output, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err == nil {
		t.Fatalf("prepare passed, want a refused switch\n%s", output)
	}
	if strings.Contains(err.Error(), "already exists") || !strings.Contains(err.Error(), "git switch") {
		t.Errorf("error %v", err)
	}
}

func TestTracksTheRemoteBranchWhenOnlyTheRemoteHasIt(t *testing.T) {
	f := setUp(t)
	git(t, f.origin, "branch", "spotlight/task-1")
	pushed := f.push(t, "spotlight/task-1", "REVIEW.md", "a person's fix\n")

	if output, err := prepared(context.Background(), []protocol.Checkout{f.checkout("spotlight/task-1")}, f.options()); err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != pushed {
		t.Errorf("the branch is at %s, want what was pushed, %s", got, pushed)
	}
}

func TestStartsANewBranchFromItsBaseBranch(t *testing.T) {
	f := setUp(t)
	git(t, f.origin, "branch", "release/1.x")
	released := f.push(t, "release/1.x", "RELEASE.md", "1.x\n")
	f.commit(t, "MAIN.md", "only on main\n")

	checkout := f.checkout("fix/hotfix-1")
	checkout.Base = "release/1.x"
	if output, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != released {
		t.Errorf("the branch starts at %s, want the base, %s", got, released)
	}

	checkout.Branch = "fix/hotfix-2"
	if output, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
		t.Fatalf("prepare a restored checkout: %v\n%s", err, output)
	}
	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != released {
		t.Errorf("a restored checkout starts the branch at %s, want the base, %s", got, released)
	}
}

func TestKeepsWorkingOnAnExistingBranchWhenItsBaseIsGoneFromTheRemote(t *testing.T) {
	f := setUp(t)
	git(t, f.origin, "branch", "release/1.x")
	checkout := f.checkout("fix/hotfix-1")
	checkout.Base = "release/1.x"
	if output, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}
	git(t, f.origin, "branch", "--delete", "release/1.x")

	if output, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options()); err != nil {
		t.Fatalf("prepare after the base is gone: %v\n%s", err, output)
	}
	if got := git(t, f.tree(), "branch", "--show-current"); got != "fix/hotfix-1" {
		t.Errorf("on %q, want the task's branch", got)
	}
}

func TestStopsARebaseTheLastRunLeftUnfinishedAndKeepsWhereItStood(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "README.md"), "the last run's\n")
	git(t, f.tree(), "commit", "--quiet", "--all", "--message", "local")
	git(t, f.tree(), "branch", "other", "HEAD~1")
	git(t, f.tree(), "switch", "--quiet", "other")
	write(t, filepath.Join(f.tree(), "README.md"), "another\n")
	git(t, f.tree(), "commit", "--quiet", "--all", "--message", "other")
	git(t, f.tree(), "switch", "--quiet", "spotlight/task-1")
	local := git(t, f.tree(), "rev-parse", "HEAD")
	if err := exec.Command("git", "-C", f.tree(), "-c", "user.name=x", "-c", "user.email=x@example.com", "rebase", "--quiet", "other").Run(); err == nil {
		t.Fatal("the rebase applied cleanly, want a conflict")
	}

	done, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, done.Output)
	}

	if exists := git(t, f.tree(), "rev-parse", "--git-path", "rebase-merge"); fileExists(exists, f.tree()) {
		t.Errorf("the rebase is still in progress")
	}
	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != local {
		t.Errorf("HEAD is %s, want where the branch stood before the rebase, %s", got, local)
	}
	if got := git(t, f.tree(), "status", "--porcelain"); got != "" {
		t.Errorf("the tree is not clean: %q", got)
	}
	if len(done.Notes) != 1 || !strings.Contains(done.Notes[0], "left a rebase unfinished") {
		t.Errorf("notes %q", done.Notes)
	}
}

func TestClearsAnUnfinishedRebaseThatGitCannotAbort(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	head := git(t, f.tree(), "rev-parse", "HEAD")
	if err := os.MkdirAll(filepath.Join(f.tree(), ".git", "rebase-merge"), 0o755); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(f.tree(), "README.md"), "half done\n")

	done, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, done.Output)
	}

	if fileExists(filepath.Join(f.tree(), ".git", "rebase-merge"), f.tree()) {
		t.Errorf("the rebase is still in progress")
	}
	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != head {
		t.Errorf("HEAD is %s, want %s", got, head)
	}
	if got := git(t, f.tree(), "status", "--porcelain"); got != "" {
		t.Errorf("the tree is not clean: %q", got)
	}
	if len(done.Notes) != 1 || !strings.Contains(done.Notes[0], "--abort failed") {
		t.Errorf("notes %q", done.Notes)
	}
}

func fileExists(path, dir string) bool {
	if !filepath.IsAbs(path) {
		path = filepath.Join(dir, path)
	}
	_, err := os.Stat(path)
	return err == nil
}

func TestFailsClearlyWhenTheBaseBranchIsNotOnTheRemote(t *testing.T) {
	f := setUp(t)
	checkout := f.checkout("fix/hotfix-1")
	checkout.Base = "release/9.x"

	_, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err == nil || !strings.Contains(err.Error(), "the base branch release/9.x of acme/api is not on the remote") {
		t.Errorf("error %v", err)
	}
}

func TestRefusesABaseThatIsNotABranchName(t *testing.T) {
	f := setUp(t)
	checkout := f.checkout("fix/hotfix-1")
	checkout.Base = "--upload-pack=touch /tmp/owned"

	_, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err == nil || !strings.Contains(err.Error(), "is not a branch name") {
		t.Errorf("error %v", err)
	}
}

func TestClonesAgainWhenARestoredCheckoutIsNotAWorkingRepository(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "notes.md"), "kept\n")
	if err := os.RemoveAll(filepath.Join(f.tree(), ".git", "objects")); err != nil {
		t.Fatal(err)
	}

	done, err := prepare.Checkouts(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, done.Output)
	}

	if got := git(t, f.tree(), "branch", "--show-current"); got != "spotlight/task-1" {
		t.Errorf("on %q", got)
	}
	if _, err := os.Stat(filepath.Join(f.workspace, "acme", "api.unusable", "notes.md")); err != nil {
		t.Errorf("the unusable folder was not kept aside: %v", err)
	}
	if len(done.Notes) != 1 || !strings.Contains(done.Notes[0], "moved that folder to acme/api.unusable") {
		t.Errorf("notes %q", done.Notes)
	}
}

func TestLeavesARestoredCheckoutBehindWhenUncommittedWorkBlocksIt(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	before := git(t, f.tree(), "rev-parse", "HEAD")
	write(t, filepath.Join(f.tree(), "README.md"), "halfway through a rewrite\n")

	f.push(t, "spotlight/task-1", "README.md", "a person's rewrite\n")

	output, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != before {
		t.Errorf("the branch moved to %s, want it left at %s", got, before)
	}
	if body, _ := os.ReadFile(filepath.Join(f.tree(), "README.md")); string(body) != "halfway through a rewrite\n" {
		t.Errorf("the work left halfway now reads %q", body)
	}
	if !strings.Contains(output, "uncommitted changes here block the fast-forward") {
		t.Errorf("output %q", output)
	}
}

func TestSaysNothingOfCatchingUpWhereTheLastRunIsAheadOfWhatWasPushed(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	write(t, filepath.Join(f.tree(), "local.md"), "the last run's\n")
	git(t, f.tree(), "add", "--all")
	git(t, f.tree(), "commit", "--quiet", "--message", "local")

	output, err := prepared(context.Background(), []protocol.Checkout{checkout}, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	if output != "reusing acme/api" {
		t.Errorf("output %q", output)
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

	if output, err := prepared(context.Background(), []protocol.Checkout{reviewed}, f.options()); err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
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

	if output, err := prepared(context.Background(), []protocol.Checkout{replayed}, f.options()); err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
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

	output, err := prepared(context.Background(), []protocol.Checkout{f.checkout("")}, options)
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	if !strings.Contains(output, "from the host's mirror") {
		t.Errorf("output %q", output)
	}
	if _, err := os.Stat(filepath.Join(f.tree(), ".git", "objects", "info", "alternates")); !os.IsNotExist(err) {
		t.Errorf("the clone still leans on the mirror: %v", err)
	}
}

func TestFailsOnARemoteItCannotReach(t *testing.T) {
	f := setUp(t)
	gone := f.checkout("")
	gone.Remote = filepath.Join(f.origin, "missing")

	if _, err := prepared(context.Background(), []protocol.Checkout{gone}, f.options()); err == nil {
		t.Fatal("expected the clone to fail")
	}
}

func TestSetupRunsInTheCheckout(t *testing.T) {
	tree := t.TempDir()

	output, err := prepare.Setup(context.Background(), tree, "echo installing && touch installed", nil, 0, nil)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	if output != "installing" {
		t.Errorf("output %q", output)
	}
	if _, err := os.Stat(filepath.Join(tree, "installed")); err != nil {
		t.Errorf("setup did not run in the checkout: %v", err)
	}
}

func TestSetupConnectsThroughTheLocalProxy(t *testing.T) {
	output, err := prepare.Setup(context.Background(), t.TempDir(), "echo $HTTPS_PROXY", nil, 0,
		map[string]string{"HTTPS_PROXY": "http://127.0.0.1:3128"})
	if err != nil || output != "http://127.0.0.1:3128" {
		t.Errorf("output %q: %v", output, err)
	}
}

func TestSetupThatTakesTooLongIsStopped(t *testing.T) {
	_, err := prepare.Setup(context.Background(), t.TempDir(), "sleep 5", nil, 100*time.Millisecond, nil)
	if err == nil || !strings.Contains(err.Error(), "did not finish") {
		t.Fatalf("got %v", err)
	}
}

func (f fixture) mirrored(t *testing.T) prepare.Options {
	t.Helper()

	mirror := filepath.Join(filepath.Dir(f.workspace), "mirrors", "acme", "api.git")
	git(t, filepath.Dir(f.workspace), "clone", "--quiet", "--bare", f.origin, mirror)

	options := f.options()
	options.Mirrors = filepath.Dir(filepath.Dir(mirror))
	return options
}

func TestFetchesAReusedCheckoutFromTheHostsMirrorFirst(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	options := f.mirrored(t)
	mirror := filepath.Join(options.Mirrors, "acme", "api.git")

	git(t, f.origin, "switch", "--quiet", "-c", "feature")
	onlyMirrored := f.commit(t, "feature.md", "mirrored\n")
	git(t, f.origin, "switch", "--quiet", "main")
	git(t, mirror, "fetch", "--quiet", f.origin, "feature:feature")
	git(t, f.origin, "branch", "--quiet", "-D", "feature")

	output, err := prepared(context.Background(), []protocol.Checkout{checkout}, options)
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	if got := git(t, f.tree(), "rev-parse", "refs/remotes/origin/feature"); got != onlyMirrored {
		t.Errorf("origin/feature is at %s, want the mirror's %s", got, onlyMirrored)
	}
	if output != "reusing acme/api" {
		t.Errorf("output %q", output)
	}
}

func TestFetchesFromOriginWhatTheHostsMirrorDoesNotHaveYet(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	options := f.mirrored(t)

	pushed := f.push(t, "spotlight/task-1", "REVIEW.md", "a person's fix\n")
	git(t, f.origin, "branch", "--quiet", "spotlight/task-2", pushed)
	latest := f.commit(t, "CHANGELOG.md", "moved on\n")

	output, err := prepared(context.Background(), []protocol.Checkout{checkout}, options)
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	if got := git(t, f.tree(), "rev-parse", "HEAD"); got != pushed {
		t.Errorf("the branch is at %s, want what was pushed, %s", got, pushed)
	}
	if got := git(t, f.tree(), "rev-parse", "refs/remotes/origin/spotlight/task-2"); got != pushed {
		t.Errorf("origin/spotlight/task-2 is at %s, want %s", got, pushed)
	}
	if got := git(t, f.tree(), "rev-parse", "refs/remotes/origin/main"); got != latest {
		t.Errorf("origin/main is at %s, want origin's %s", got, latest)
	}
	if !strings.Contains(output, "caught acme/api up") {
		t.Errorf("output %q", output)
	}
}

func TestFetchesFromOriginAloneWhenTheHostsMirrorIsBroken(t *testing.T) {
	f := setUp(t)
	checkout := f.restored(t, "spotlight/task-1")
	options := f.mirrored(t)
	if err := os.RemoveAll(filepath.Join(options.Mirrors, "acme", "api.git", "objects")); err != nil {
		t.Fatal(err)
	}

	latest := f.commit(t, "CHANGELOG.md", "moved on\n")

	output, err := prepared(context.Background(), []protocol.Checkout{checkout}, options)
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	if got := git(t, f.tree(), "rev-parse", "refs/remotes/origin/main"); got != latest {
		t.Errorf("origin/main is at %s, want origin's %s", got, latest)
	}
	if !strings.Contains(output, "fetching acme/api from origin alone") {
		t.Errorf("output %q", output)
	}
}

func (f fixture) many(n int, remote func(i int) string) []protocol.Checkout {
	checkouts := make([]protocol.Checkout, n)
	for i := range checkouts {
		checkouts[i] = protocol.Checkout{Remote: remote(i), Path: fmt.Sprintf("acme/repo-%d", i)}
	}
	return checkouts
}

func TestKeepsEachCheckoutsOutputInOrderAndPreparesTheRestWhenOneFails(t *testing.T) {
	f := setUp(t)
	checkouts := f.many(6, func(i int) string {
		if i == 2 || i == 4 {
			return filepath.Join(f.origin, "missing")
		}
		return f.origin
	})

	output, err := prepared(context.Background(), checkouts, f.options())
	if err == nil {
		t.Fatalf("expected two checkouts to fail\n%s", output)
	}

	var want []string
	for _, checkout := range checkouts {
		want = append(want, "cloning "+checkout.Path)
	}
	if output != strings.Join(want, "\n") {
		t.Errorf("output %q", output)
	}
	for i, checkout := range checkouts {
		failed := i == 2 || i == 4
		if got := strings.Contains(err.Error(), "git clone "+checkout.Path+":"); got != failed {
			t.Errorf("the error names %s: %t, want %t\n%v", checkout.Path, got, failed, err)
		}
		if _, statErr := os.Stat(filepath.Join(f.workspace, checkout.Path, ".git")); (statErr == nil) == failed {
			t.Errorf("%s cloned: %t, want %t", checkout.Path, statErr == nil, !failed)
		}
	}
}

func prepared(ctx context.Context, checkouts []protocol.Checkout, opts prepare.Options) (string, error) {
	done, err := prepare.Checkouts(ctx, checkouts, opts)
	return done.Output, err
}
