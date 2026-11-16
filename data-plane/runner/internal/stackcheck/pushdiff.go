package stackcheck

import (
	"context"
	"fmt"
	"os"
	"strings"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/shell"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

type DiffControl interface {
	RenewPushDiffLease(ctx context.Context, diffID string) (bool, error)
	RecordPushDiff(ctx context.Context, diffID, diff, base string) error
	FailPushDiff(ctx context.Context, diffID, reason string) error
}

func PerformDiff(ctx context.Context, client DiffControl, push protocol.PushDiff, opts Options) {
	diffing, stop := context.WithTimeout(ctx, opts.or(opts.Total, defaultTotal))
	defer stop()

	leased, lost := opts.hold(diffing, func(ctx context.Context) (bool, error) {
		return client.RenewPushDiffLease(ctx, push.DiffID)
	}, opts.Log.With("diff", push.DiffID))

	diff, base, failed := opts.diffPush(leased, push)

	if lost() {
		opts.Log.Info("stopped diffing a push it no longer leases", "diff", push.DiffID)
		return
	}

	if failed != "" {
		if err := client.FailPushDiff(ctx, push.DiffID, failed); err != nil {
			opts.Log.Warn("could not say why a push could not be diffed", "diff", push.DiffID, "error", err)
		}
		return
	}

	if err := client.RecordPushDiff(ctx, push.DiffID, diff, base); err != nil {
		opts.Log.Warn("could not hand over the diff of a push", "diff", push.DiffID, "error", err)
	}
}

func (o Options) diffPush(ctx context.Context, push protocol.PushDiff) (diff, base, failed string) {
	if push.Repository == "" || push.BaseTip == "" || push.Head == "" {
		return "", "", "The push has no repository, base tip or head."
	}

	space, err := workspace.Open(o.Dir)
	if err != nil {
		o.Log.Warn("could not open a workspace to diff a push", "error", err)
		return "", "", err.Error()
	}

	tree, err := os.MkdirTemp(space.Dir, "push-diff-")
	if err != nil {
		o.Log.Warn("could not make room to diff a push", "error", err)
		return "", "", err.Error()
	}
	defer func() {
		if err := os.RemoveAll(tree); err != nil {
			o.Log.Warn("could not remove the copy a push was diffed in", "error", err)
		}
	}()

	if failed := o.fetchCommits(ctx, tree, push.Repository, push.BaseTip, push.Head); failed != "" {
		return "", "", failed
	}

	output, err := o.git(ctx, tree, "", "merge-base", push.BaseTip, push.Head)
	if err != nil {
		o.Log.Warn("could not find where a push branched off", "error", err, "output", output)
		return "", "", fmt.Sprintf("git merge-base: %s", shell.Tail(output))
	}
	base = strings.TrimSpace(output)

	diff, err = o.between(ctx, tree, base, push.Head)
	if err != nil {
		o.Log.Warn("could not diff a push", "error", err)
		return "", "", err.Error()
	}

	return diff, base, ""
}
