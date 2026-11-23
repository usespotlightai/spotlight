package session

import (
	"context"
	"fmt"
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
		if left, err := git("merge-base", "HEAD", baseBranchOf(checkout)); err == nil && left != "" {
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

func baseBranchOf(checkout protocol.Checkout) string {
	if checkout.Base != "" {
		return "refs/remotes/origin/" + checkout.Base
	}
	return "refs/remotes/origin/HEAD"
}

func checkBranches(ctx context.Context, dir string, checkouts []protocol.Checkout, journal *journalWriter) {
	for _, checkout := range checkouts {
		if checkout.Branch == "" {
			continue
		}
		on, err := gitIn(ctx, filepath.Join(dir, checkout.Path))("branch", "--show-current")
		if err != nil || on == checkout.Branch {
			continue
		}
		where := "a detached HEAD"
		if on != "" {
			where = "the branch " + on
		}
		journal.note(branchStep, true, fmt.Sprintf(
			"The run ended with %s on %s, not on %s, the branch of this task. Commits that are not on %s are not part of the change of this task. The next run switches %s back to %s.",
			checkout.Path, where, checkout.Branch, checkout.Branch, checkout.Path, checkout.Branch,
		))
	}
}

func gitIn(ctx context.Context, repository string) func(args ...string) (string, error) {
	return func(args ...string) (string, error) {
		output, err := exec.CommandContext(ctx, "git",
			append([]string{"-c", "safe.directory=*", "-C", repository}, args...)...,
		).CombinedOutput()
		return strings.TrimSpace(string(output)), err
	}
}
