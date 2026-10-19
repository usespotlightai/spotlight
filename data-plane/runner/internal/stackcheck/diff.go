package stackcheck

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	wholeContext = "--unified=100000"
	maxDiff      = 5 * 1024 * 1024
)

func (o Options) Diff(ctx context.Context, checkout string) (string, error) {
	if _, err := o.git(ctx, checkout, "", "rev-parse", "--verify", "--quiet", BaseRef); err != nil {
		return "", fmt.Errorf("the checkout has no record of where the run began")
	}

	gitDir, err := o.git(ctx, checkout, "", "rev-parse", "--absolute-git-dir")
	if err != nil {
		return "", fmt.Errorf("find the git directory: %w", err)
	}

	index := filepath.Join(gitDir, "spotlight-stack-index")
	defer os.Remove(index)

	realIndex := filepath.Join(gitDir, "index")
	if real, err := os.ReadFile(realIndex); err == nil {
		written, err := os.Stat(realIndex)
		if err != nil {
			return "", err
		}
		if err := os.WriteFile(index, real, 0o600); err != nil {
			return "", err
		}
		// Keep the index's mtime: git trusts entries older than it, so a fresh one hides same-size edits.
		if err := os.Chtimes(index, written.ModTime(), written.ModTime()); err != nil {
			return "", err
		}
		if err := o.own(index); err != nil {
			return "", err
		}
	}

	staged := map[string]string{"GIT_INDEX_FILE": index, "GIT_TERMINAL_PROMPT": "0"}

	if output, err := o.gitWith(ctx, checkout, staged, "add", "--all"); err != nil {
		return "", fmt.Errorf("gather what changed: %w: %s", err, output)
	}

	diff, err := o.gitWith(ctx, checkout, staged, "diff", "--cached", "-M", wholeContext, BaseRef)
	if err != nil {
		return "", fmt.Errorf("diff the checkout: %w", err)
	}

	if len(diff) > maxDiff {
		diff, err = o.gitWith(ctx, checkout, staged, "diff", "--cached", "-M", BaseRef)
		if err != nil {
			return "", fmt.Errorf("diff the checkout: %w", err)
		}
	}

	return strings.TrimSpace(diff), nil
}

// Committed diffs what the checkout's HEAD contains against the point where the run started. It ignores the working tree.
func (o Options) Committed(ctx context.Context, checkout string) (string, error) {
	if _, err := o.git(ctx, checkout, "", "rev-parse", "--verify", "--quiet", BaseRef); err != nil {
		return "", fmt.Errorf("the checkout has no record of where the run began")
	}

	unstaged := map[string]string{"GIT_TERMINAL_PROMPT": "0"}

	diff, err := o.gitWith(ctx, checkout, unstaged, "diff", "-M", wholeContext, BaseRef, "HEAD")
	if err != nil {
		return "", fmt.Errorf("diff the checkout: %w", err)
	}

	if len(diff) > maxDiff {
		diff, err = o.gitWith(ctx, checkout, unstaged, "diff", "-M", BaseRef, "HEAD")
		if err != nil {
			return "", fmt.Errorf("diff the checkout: %w", err)
		}
	}

	return strings.TrimSpace(diff), nil
}

func (o Options) gitWith(ctx context.Context, dir string, env map[string]string, args ...string) (string, error) {
	return o.run(ctx, dir, "", env, "git", append([]string{"-c", "safe.directory=*", "-C", dir}, args...)...)
}
