package session

import (
	"context"
	"log/slog"
	"os/exec"
	"path/filepath"
	"strings"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/stackcheck"
)

func markBases(ctx context.Context, dir string, checkouts []protocol.Checkout, log *slog.Logger) map[string]string {
	marked := make(map[string]string, len(checkouts))

	for _, checkout := range checkouts {
		git := gitIn(ctx, filepath.Join(dir, checkout.Path))

		base := "HEAD"
		if left, err := git("merge-base", "HEAD", "refs/remotes/origin/HEAD"); err == nil && left != "" {
			base = left
		}

		if output, err := git("update-ref", stackcheck.BaseRef, base); err != nil {
			log.Warn("could not mark where a checkout began",
				"path", checkout.Path,
				"error", err,
				"output", output,
			)
			continue
		}

		commit, err := git("rev-parse", "--verify", stackcheck.BaseRef)
		if err != nil {
			log.Warn("could not read where a checkout began", "path", checkout.Path, "error", err)
			continue
		}

		marked[checkout.Path] = commit
	}

	return marked
}

func gitIn(ctx context.Context, repository string) func(args ...string) (string, error) {
	return func(args ...string) (string, error) {
		output, err := exec.CommandContext(ctx, "git",
			append([]string{"-c", "safe.directory=*", "-C", repository}, args...)...,
		).CombinedOutput()
		return strings.TrimSpace(string(output)), err
	}
}
