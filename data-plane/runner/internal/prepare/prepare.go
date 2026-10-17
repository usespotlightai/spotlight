package prepare

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/shell"
)

const defaultTimeout = 10 * time.Minute

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

type said struct {
	lines []string
}

func (s *said) say(format string, args ...any) {
	s.lines = append(s.lines, fmt.Sprintf(format, args...))
}

func Checkouts(ctx context.Context, checkouts []protocol.Checkout, opts Options) (string, error) {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = defaultTimeout
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var out said
	for _, checkout := range checkouts {
		if err := opts.checkout(ctx, checkout, &out); err != nil {
			if ctx.Err() != nil {
				err = fmt.Errorf("preparing %s did not finish within %s", checkout.Path, timeout)
			}
			return strings.Join(out.lines, "\n"), err
		}
	}

	return strings.Join(out.lines, "\n"), nil
}

func (o Options) checkout(ctx context.Context, checkout protocol.Checkout, out *said) error {
	tree := filepath.Join(o.Dir, checkout.Path)
	git := func(args ...string) error {
		output, err := shell.Git(ctx, tree, nil, args...)
		if err != nil {
			return fmt.Errorf("git %s in %s: %w: %s", args[0], checkout.Path, err, shell.Tail(output))
		}
		return nil
	}

	start := "HEAD"

	switch {
	case exists(filepath.Join(tree, ".git")):
		out.say("reusing %s", checkout.Path)
		if err := git("remote", "set-url", "origin", checkout.Remote); err != nil {
			if err := git("remote", "add", "origin", checkout.Remote); err != nil {
				return err
			}
		}
		if err := git("fetch", "--quiet", "origin"); err != nil {
			return err
		}
		if git("remote", "set-head", "origin", "--auto") == nil {
			start = "refs/remotes/origin/HEAD"
		}
	case o.Mirrors != "" && exists(filepath.Join(o.Mirrors, checkout.Path+".git")):
		out.say("cloning %s from the host's mirror", checkout.Path)
		// Use --dissociate because the workspace is archived and then restored on hosts that do not have this mirror.
		if err := o.clone(ctx, checkout, "--reference-if-able", filepath.Join(o.Mirrors, checkout.Path+".git"), "--dissociate"); err != nil {
			return err
		}
	default:
		out.say("cloning %s", checkout.Path)
		if err := o.clone(ctx, checkout); err != nil {
			return err
		}
	}

	if err := git("config", "user.name", o.Author.Name); err != nil {
		return err
	}
	if err := git("config", "user.email", o.Author.Email); err != nil {
		return err
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
	if git("switch", "--quiet", checkout.Branch) != nil {
		return git("switch", "--quiet", "-c", checkout.Branch, start)
	}

	catchUp(checkout, func(args ...string) bool { return git(args...) == nil }, out)
	return nil
}

func catchUp(checkout protocol.Checkout, git func(args ...string) bool, out *said) {
	pushed := "refs/remotes/origin/" + checkout.Branch

	if !git("rev-parse", "--verify", "--quiet", pushed) || git("merge-base", "--is-ancestor", pushed, "HEAD") {
		return
	}

	switch {
	case !git("merge-base", "--is-ancestor", "HEAD", pushed):
		out.say("left %s as the last run left it: %s has moved on both here and on the remote", checkout.Path, checkout.Branch)
	case !git("merge", "--quiet", "--ff-only", pushed):
		out.say("left %s behind the remote's %s: uncommitted changes here block the fast-forward", checkout.Path, checkout.Branch)
	default:
		out.say("caught %s up with what was pushed to %s", checkout.Path, checkout.Branch)
	}
}

func (o Options) clone(ctx context.Context, checkout protocol.Checkout, extra ...string) error {
	tree := filepath.Join(o.Dir, checkout.Path)
	if err := os.MkdirAll(filepath.Dir(tree), 0o755); err != nil {
		return fmt.Errorf("make room for %s: %w", checkout.Path, err)
	}

	args := append(append([]string{"clone", "--quiet"}, extra...), checkout.Remote, tree)
	output, err := shell.Run(ctx, shell.Command{
		Dir:  o.Dir,
		Env:  map[string]string{"GIT_TERMINAL_PROMPT": "0"},
		Name: "git",
		Args: args,
	})
	if err != nil {
		return fmt.Errorf("git clone %s: %w: %s", checkout.Path, err, shell.Tail(output))
	}
	return nil
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
