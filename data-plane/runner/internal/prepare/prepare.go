package prepare

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/shell"
)

const (
	defaultTimeout    = 10 * time.Minute
	parallelCheckouts = 4
)

var retryDelays = []time.Duration{time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second}

var serverError = regexp.MustCompile(`(?:returned error: |HTTP )(50[0234])\b`)

type Author struct {
	Name  string
	Email string
}

type Options struct {
	Dir     string
	Mirrors string
	Author  Author
	Timeout time.Duration
}

type output struct {
	lines []string
	notes []string
}

func (o *output) add(format string, args ...any) {
	o.lines = append(o.lines, fmt.Sprintf(format, args...))
}

func (o *output) tell(format string, args ...any) {
	o.notes = append(o.notes, fmt.Sprintf(format, args...))
}

type Prepared struct {
	Output string
	Notes  []string
}

func Checkouts(ctx context.Context, checkouts []protocol.Checkout, opts Options) (Prepared, error) {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = defaultTimeout
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	outs := make([]output, len(checkouts))
	errs := make([]error, len(checkouts))
	slots := make(chan struct{}, parallelCheckouts)
	var preparing sync.WaitGroup
	for i, checkout := range checkouts {
		preparing.Go(func() {
			slots <- struct{}{}
			defer func() { <-slots }()
			if err := opts.checkout(ctx, checkout, &outs[i]); err != nil {
				if ctx.Err() != nil {
					err = fmt.Errorf("preparing %s did not finish within %s", checkout.Path, timeout)
				}
				errs[i] = err
			}
		})
	}
	preparing.Wait()

	var prepared Prepared
	var lines []string
	for _, out := range outs {
		lines = append(lines, out.lines...)
		prepared.Notes = append(prepared.Notes, out.notes...)
	}
	prepared.Output = strings.Join(lines, "\n")
	return prepared, errors.Join(errs...)
}

type repository struct {
	ctx  context.Context
	tree string
	path string
	out  *output
}

func (r repository) output(args ...string) (string, error) {
	output, err := retried(r.ctx, "git "+args[0]+" in "+r.path, r.out, func() (string, error) {
		return shell.Git(r.ctx, r.tree, nil, args...)
	})
	if err != nil {
		return output, fmt.Errorf("git %s in %s: %w: %s", args[0], r.path, err, shell.Tail(output))
	}
	return strings.TrimSpace(output), nil
}

func (r repository) git(args ...string) error {
	_, err := r.output(args...)
	return err
}

func (r repository) has(ref string) bool {
	return r.git("rev-parse", "--verify", "--quiet", ref) == nil
}

func (r repository) contains(ancestor, descendant string) bool {
	return r.git("merge-base", "--is-ancestor", ancestor, descendant) == nil
}

func (r repository) clean() bool {
	status, err := r.output("status", "--porcelain")
	return err == nil && status == ""
}

func (o Options) checkout(ctx context.Context, checkout protocol.Checkout, out *output) error {
	repo := repository{ctx: ctx, tree: filepath.Join(o.Dir, checkout.Path), path: checkout.Path, out: out}
	git := repo.git

	restored := exists(filepath.Join(repo.tree, ".git"))
	if restored {
		if err := o.setAsideIfUnusable(repo, checkout); err != nil {
			return err
		}
		restored = exists(filepath.Join(repo.tree, ".git"))
	}

	start := "HEAD"
	left := ""

	switch {
	case restored:
		out.add("reusing %s", checkout.Path)
		left, _ = repo.output("branch", "--show-current")
		if err := git("remote", "set-url", "origin", checkout.Remote); err != nil {
			if err := git("remote", "add", "origin", checkout.Remote); err != nil {
				return err
			}
		}
		o.fetchFromMirror(ctx, checkout, out)
		if err := git("fetch", "--quiet", "origin"); err != nil {
			return err
		}
		if git("remote", "set-head", "origin", "--auto") == nil {
			start = "refs/remotes/origin/HEAD"
		}
	case o.Mirrors != "" && exists(filepath.Join(o.Mirrors, checkout.Path+".git")):
		out.add("cloning %s from the host's mirror", checkout.Path)
		// Use --dissociate because the workspace is archived and then restored on hosts that do not have this mirror.
		if err := o.clone(ctx, checkout, out, "--reference-if-able", filepath.Join(o.Mirrors, checkout.Path+".git"), "--dissociate"); err != nil {
			return err
		}
	default:
		out.add("cloning %s", checkout.Path)
		if err := o.clone(ctx, checkout, out); err != nil {
			return err
		}
	}

	if err := git("config", "user.name", o.Author.Name); err != nil {
		return err
	}
	if err := git("config", "user.email", o.Author.Email); err != nil {
		return err
	}

	if restored {
		if err := finishInterrupted(repo); err != nil {
			return err
		}
	}

	if checkout.Ref != "" {
		at := checkout.Ref
		if git("cat-file", "-e", checkout.Ref+"^{commit}") != nil {
			if err := git("fetch", "--quiet", "origin", checkout.Ref); err != nil {
				return err
			}
			at = "FETCH_HEAD"
		}
		if err := git("checkout", "--quiet", "--detach", at); err != nil {
			return err
		}
		start = "HEAD"
	}

	if checkout.Branch == "" {
		return nil
	}

	if checkout.Base != "" && checkout.Ref == "" && !repo.has("refs/heads/"+checkout.Branch) && !repo.has("refs/remotes/origin/"+checkout.Branch) {
		base, err := baseOf(repo, checkout)
		if err != nil {
			return err
		}
		start = base
	}

	if err := onBranch(repo, checkout.Branch, start); err != nil {
		return err
	}

	if left != "" && left != checkout.Branch {
		out.add("switched %s back to %s from %s, where the last run left it", checkout.Path, checkout.Branch, left)
		out.tell(
			"The last run left %s on the branch %s. Spotlight switched it back to %s, the branch of this task. Commits on %s are not part of the change of this task.",
			checkout.Path, left, checkout.Branch, left,
		)
	}

	return catchUp(repo, checkout.Branch)
}

func baseOf(repo repository, checkout protocol.Checkout) (string, error) {
	if strings.HasPrefix(checkout.Base, "-") || repo.git("check-ref-format", "--branch", checkout.Base) != nil {
		return "", fmt.Errorf("%q is not a branch name %s can start from", checkout.Base, checkout.Path)
	}
	base := "refs/remotes/origin/" + checkout.Base
	if repo.has(base) {
		return base, nil
	}
	if err := repo.git("fetch", "--quiet", "origin", "+refs/heads/"+checkout.Base+":"+base); err != nil || !repo.has(base) {
		return "", fmt.Errorf("the base branch %s of %s is not on the remote: push it first, or start the task from another branch", checkout.Base, checkout.Path)
	}
	return base, nil
}

func onBranch(repo repository, branch, start string) error {
	switch {
	case repo.has("refs/heads/" + branch):
		return repo.git("switch", "--quiet", branch)
	case repo.has("refs/remotes/origin/" + branch):
		return repo.git("switch", "--quiet", "--track", "origin/"+branch)
	default:
		return repo.git("switch", "--quiet", "-c", branch, start)
	}
}

func catchUp(repo repository, branch string) error {
	pushed := "refs/remotes/origin/" + branch

	if !repo.has(pushed) || repo.contains(pushed, "HEAD") {
		return nil
	}

	if repo.contains("HEAD", pushed) {
		if repo.git("merge", "--quiet", "--ff-only", pushed) != nil {
			repo.out.add("left %s behind the remote's %s: uncommitted changes here block the fast-forward", repo.path, branch)
			repo.out.tell(
				"Someone pushed to %s since the last run. Uncommitted changes in %s block Spotlight from catching up with it. Commit or move them, then run git merge --ff-only origin/%s.",
				branch, repo.path, branch,
			)
			return nil
		}
		repo.out.add("caught %s up with what was pushed to %s", repo.path, branch)
		return nil
	}

	if !repo.clean() {
		repo.out.add("left %s as the last run left it: %s has moved on both here and on the remote, and uncommitted changes here block a rebase", repo.path, branch)
		repo.out.tell(
			"Someone pushed to %s since the last run, and %s has commits that are not on the remote. Uncommitted changes block Spotlight from rebasing them. Commit your changes, then run git rebase origin/%s before you push.",
			branch, repo.path, branch,
		)
		return nil
	}

	kept, err := keep(repo, "refs/spotlight/diverged/"+branch)
	if err != nil {
		return err
	}

	if repo.git("-c", "core.hooksPath=/dev/null", "rebase", "--quiet", pushed) == nil {
		repo.out.add("rebased the commits of the last run in %s onto what was pushed to %s; the commits before the rebase are at %s", repo.path, branch, kept)
		repo.out.tell(
			"Someone pushed to %s since the last run. Spotlight rebased the commits of the last run in %s onto the remote branch. The commits as they were before the rebase are at %s.",
			branch, repo.path, kept,
		)
		return nil
	}

	_ = repo.git("rebase", "--abort")
	if err := repo.git("reset", "--quiet", "--hard", pushed); err != nil {
		return err
	}
	repo.out.add("reset %s to what was pushed to %s: the commits of the last run did not rebase onto it cleanly; they are at %s", repo.path, branch, kept)
	repo.out.tell(
		"Someone pushed to %s since the last run, and the commits of the last run in %s did not rebase onto it cleanly. Spotlight reset the branch to the remote. The commits of the last run are at %s. Compare them with the remote, and apply what is still necessary.",
		branch, repo.path, kept,
	)
	return nil
}

func keep(repo repository, prefix string) (string, error) {
	head, err := repo.output("rev-parse", "--short=12", "HEAD")
	if err != nil {
		return "", err
	}
	kept := prefix + "/" + head
	return kept, repo.git("update-ref", kept, "HEAD")
}

var interruptions = []struct {
	marker, command, what string
}{
	{"rebase-merge", "rebase", "a rebase"},
	{"rebase-apply", "am", "a git am"},
	{"MERGE_HEAD", "merge", "a merge"},
	{"CHERRY_PICK_HEAD", "cherry-pick", "a cherry-pick"},
	{"REVERT_HEAD", "revert", "a revert"},
}

func finishInterrupted(repo repository) error {
	for _, each := range interruptions {
		if !exists(filepath.Join(repo.tree, ".git", each.marker)) {
			continue
		}
		kept, err := keep(repo, "refs/spotlight/interrupted")
		if err != nil {
			return err
		}
		if each.command == "am" && !exists(filepath.Join(repo.tree, ".git", each.marker, "applying")) {
			each.command, each.what = "rebase", "a rebase"
		}
		if aborted := repo.git(each.command, "--abort"); aborted != nil {
			if err := clearInterrupted(repo); err != nil {
				return fmt.Errorf("%w, and clearing it failed: %v", aborted, err)
			}
			repo.out.add("cleared %s that the last run left unfinished in %s, after git %s --abort failed; HEAD before is at %s", each.what, repo.path, each.command, kept)
			repo.out.tell(
				"The last run left %s unfinished in %s, and git %s --abort failed. Spotlight cleared it and reset the files to HEAD as the last run left it, which is at %s. Do the %s again if it is still necessary.",
				each.what, repo.path, each.command, kept, strings.TrimPrefix(each.what, "a "),
			)
			return nil
		}
		repo.out.add("stopped %s that the last run left unfinished in %s; HEAD before the stop is at %s", each.what, repo.path, kept)
		repo.out.tell(
			"The last run left %s unfinished in %s. Spotlight stopped it, and the files are as they were before it started. HEAD as the last run left it is at %s. Do the %s again if it is still necessary.",
			each.what, repo.path, kept, strings.TrimPrefix(each.what, "a "),
		)
		return nil
	}
	return nil
}

func clearInterrupted(repo repository) error {
	for _, each := range interruptions {
		if err := os.RemoveAll(filepath.Join(repo.tree, ".git", each.marker)); err != nil {
			return err
		}
	}
	return repo.git("reset", "--quiet", "--hard")
}

func (o Options) setAsideIfUnusable(repo repository, checkout protocol.Checkout) error {
	reason := unusable(repo)
	if reason == "" {
		return nil
	}

	aside := repo.tree + ".unusable"
	for n := 2; exists(aside); n++ {
		aside = fmt.Sprintf("%s.unusable-%d", repo.tree, n)
	}
	if err := os.Rename(repo.tree, aside); err != nil {
		return fmt.Errorf("move the unusable %s aside: %w", checkout.Path, err)
	}

	moved, _ := filepath.Rel(o.Dir, aside)
	repo.out.add("moved %s aside to %s and cloned it again: %s", checkout.Path, moved, reason)
	repo.out.tell(
		"Spotlight could not use %s as the last run left it: %s. It moved that folder to %s and cloned the repository again.",
		checkout.Path, reason, moved,
	)
	return nil
}

func unusable(repo repository) string {
	dir, err := shell.Git(repo.ctx, repo.tree, nil, "rev-parse", "--absolute-git-dir")
	if err != nil || !sameDir(strings.TrimSpace(dir), filepath.Join(repo.tree, ".git")) {
		return "it is not a working git repository"
	}
	if _, err := shell.Git(repo.ctx, repo.tree, nil, "rev-parse", "--verify", "--quiet", "HEAD^{commit}"); err != nil {
		return "its HEAD names no commit"
	}
	return ""
}

func (o Options) fetchFromMirror(ctx context.Context, checkout protocol.Checkout, out *output) {
	source := filepath.Join(o.Mirrors, checkout.Path+".git")
	if o.Mirrors == "" || !exists(source) {
		return
	}

	trusting, err := configTrustingOtherOwners()
	if err != nil {
		out.add("fetching %s from origin alone: could not trust the host's mirror: %v", checkout.Path, err)
		return
	}
	defer os.Remove(trusting)

	tree := filepath.Join(o.Dir, checkout.Path)
	output, err := shell.GitWith(ctx, tree, map[string]string{"GIT_CONFIG_GLOBAL": trusting}, nil,
		"fetch", "--quiet", "--no-tags", source, "+refs/heads/*:refs/remotes/origin/*")
	if err != nil {
		out.add("fetching %s from origin alone: git fetch from the host's mirror: %v: %s", checkout.Path, err, shell.Tail(output))
	}
}

func (o Options) clone(ctx context.Context, checkout protocol.Checkout, out *output, extra ...string) error {
	tree := filepath.Join(o.Dir, checkout.Path)
	if err := os.MkdirAll(filepath.Dir(tree), 0o755); err != nil {
		return fmt.Errorf("make room for %s: %w", checkout.Path, err)
	}

	args := append(append([]string{"clone", "--quiet"}, extra...), checkout.Remote, tree)
	output, err := retried(ctx, "git clone "+checkout.Path, out, func() (string, error) {
		return shell.Run(ctx, shell.Command{
			Dir:  o.Dir,
			Env:  map[string]string{"GIT_TERMINAL_PROMPT": "0"},
			Name: "git",
			Args: args,
		})
	})
	if err != nil {
		return fmt.Errorf("git clone %s: %w: %s", checkout.Path, err, shell.Tail(output))
	}
	return nil
}

func retried(ctx context.Context, what string, out *output, run func() (string, error)) (string, error) {
	for attempt := 0; ; attempt++ {
		output, err := run()
		status := serverError.FindStringSubmatch(output)
		if err == nil || status == nil || attempt == len(retryDelays) || ctx.Err() != nil {
			return output, err
		}

		delay := retryDelays[attempt]
		out.add("%s: the server answered %s, trying again in %s", what, status[1], delay)

		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return output, err
		case <-timer.C:
		}
	}
}

func sameDir(a, b string) bool {
	left, errLeft := filepath.EvalSymlinks(a)
	right, errRight := filepath.EvalSymlinks(b)
	return errLeft == nil && errRight == nil && left == right
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
