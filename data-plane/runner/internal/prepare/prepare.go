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
}

func (o *output) add(format string, args ...any) {
	o.lines = append(o.lines, fmt.Sprintf(format, args...))
}

func Checkouts(ctx context.Context, checkouts []protocol.Checkout, opts Options) (string, error) {
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

	var lines []string
	for _, out := range outs {
		lines = append(lines, out.lines...)
	}
	return strings.Join(lines, "\n"), errors.Join(errs...)
}

func (o Options) checkout(ctx context.Context, checkout protocol.Checkout, out *output) error {
	tree := filepath.Join(o.Dir, checkout.Path)
	git := func(args ...string) error {
		output, err := retried(ctx, "git "+args[0]+" in "+checkout.Path, out, func() (string, error) {
			return shell.Git(ctx, tree, nil, args...)
		})
		if err != nil {
			return fmt.Errorf("git %s in %s: %w: %s", args[0], checkout.Path, err, shell.Tail(output))
		}
		return nil
	}

	start := "HEAD"

	switch {
	case exists(filepath.Join(tree, ".git")):
		out.add("reusing %s", checkout.Path)
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

	fastForward(checkout, func(args ...string) bool { return git(args...) == nil }, out)
	return nil
}

func fastForward(checkout protocol.Checkout, git func(args ...string) bool, out *output) {
	pushed := "refs/remotes/origin/" + checkout.Branch

	if !git("rev-parse", "--verify", "--quiet", pushed) || git("merge-base", "--is-ancestor", pushed, "HEAD") {
		return
	}

	switch {
	case !git("merge-base", "--is-ancestor", "HEAD", pushed):
		out.add("left %s as the last run left it: %s has moved on both here and on the remote", checkout.Path, checkout.Branch)
	case !git("merge", "--quiet", "--ff-only", pushed):
		out.add("left %s behind the remote's %s: uncommitted changes here block the fast-forward", checkout.Path, checkout.Branch)
	default:
		out.add("caught %s up with what was pushed to %s", checkout.Path, checkout.Branch)
	}
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

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
