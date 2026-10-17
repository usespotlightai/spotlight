package stackcheck

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"strings"
	"time"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/prepare"
	"usespotlight.ai/data-plane/runner/internal/shell"
	"usespotlight.ai/data-plane/runner/internal/workspace"
)

const (
	BaseRef = "refs/spotlight/base"

	sh           = "/bin/sh"
	defaultStep  = 5 * time.Minute
	defaultTotal = 60 * time.Minute
	defaultRenew = time.Minute
)

var errNoLongerLeased = errors.New("the check is no longer leased")

type Control interface {
	RenewCheckLease(ctx context.Context, runID, stackID string, recheck bool) (bool, error)
	RecordChangeStackCheck(ctx context.Context, runID, stackID string, recheck bool, checked protocol.StackChecked) error
}

type Options struct {
	Dir     string
	Remote  string
	Mirrors string
	RunAs   *account.User
	Env     map[string]string
	Log     *slog.Logger
	Step    time.Duration
	Setup   time.Duration
	Total   time.Duration
	Renew   time.Duration
}

func (o Options) or(value, fallback time.Duration) time.Duration {
	if value > 0 {
		return value
	}
	return fallback
}

func Perform(ctx context.Context, client Control, check protocol.StackCheck, opts Options) {
	checking, stop := context.WithTimeout(ctx, opts.or(opts.Total, defaultTotal))
	defer stop()

	leased, release := context.WithCancelCause(checking)
	renewing := opts.renew(leased, client, check, release)

	checked := opts.perform(leased, check)
	lost := errors.Is(context.Cause(leased), errNoLongerLeased)
	release(nil)
	<-renewing

	if lost {
		opts.Log.Info("stopped checking a change stack it no longer leases", "stack", check.StackID)
		return
	}

	if err := client.RecordChangeStackCheck(ctx, check.RunID, check.StackID, check.Recheck, checked); err != nil {
		opts.Log.Warn("could not report a change stack check", "stack", check.StackID, "error", err)
	}
}

func (o Options) renew(
	ctx context.Context, client Control, check protocol.StackCheck, release context.CancelCauseFunc,
) <-chan struct{} {
	done := make(chan struct{})

	go func() {
		defer close(done)
		ticker := time.NewTicker(o.or(o.Renew, defaultRenew))
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				stop, err := client.RenewCheckLease(ctx, check.RunID, check.StackID, check.Recheck)
				switch {
				case err == nil && stop:
					o.Log.Info("a stop was requested, so the change stack check stops", "stack", check.StackID)
					release(errNoLongerLeased)
					return
				case err != nil && control.CheckLeaseLost(err):
					o.Log.Warn("lost the lease of a change stack check", "stack", check.StackID, "error", err)
					release(errNoLongerLeased)
					return
				case err != nil && ctx.Err() == nil:
					o.Log.Warn("could not renew the lease of a change stack check", "stack", check.StackID, "error", err)
				}
			}
		}
	}()

	return done
}

func skipped(code, detail string) protocol.StackChecked {
	return protocol.StackChecked{Skipped: &protocol.SkippedCheck{Code: code, Detail: detail}}
}

func (o Options) perform(ctx context.Context, check protocol.StackCheck) protocol.StackChecked {
	if check.Base == "" {
		return skipped(protocol.SkipNoBase, "")
	}
	if check.Repository == "" {
		return skipped(protocol.SkipNoCheckout, "")
	}

	space, err := workspace.Open(o.Dir)
	if err != nil {
		o.Log.Warn("could not make room to check a stack", "stack", check.StackID, "error", err)
		return skipped(protocol.SkipNoRoom, err.Error())
	}

	tree := filepath.Join(space.Dir, check.Repository)

	if missing := o.fetch(ctx, tree, check); missing != "" {
		return skipped(protocol.SkipCheckoutFailed, missing)
	}
	if o.RunAs != nil {
		if err := space.ChownAll(o.RunAs.UID, o.RunAs.GID); err != nil {
			o.Log.Warn("could not hand over the copy a check runs in", "error", err)
			return skipped(protocol.SkipNoRoom, err.Error())
		}
	}

	var steps []protocol.CheckedStep
	for at, step := range check.Steps {
		if ctx.Err() != nil {
			break
		}

		checked, ready := o.step(ctx, tree, check, step)

		if !ready && at == 0 {
			return skipped(protocol.SkipSetupFailed, checked.Output)
		}

		steps = append(steps, checked)

		if step.StopsOnFailure && !checked.Passed {
			break
		}
	}

	if len(steps) == 0 {
		return skipped(protocol.SkipOutOfTime, "")
	}

	return protocol.StackChecked{Steps: steps}
}

func (o Options) fetch(ctx context.Context, tree string, check protocol.StackCheck) string {
	remote := strings.TrimSuffix(o.Remote, "/") + "/" + check.Repository

	if err := os.MkdirAll(tree, 0o700); err != nil {
		o.Log.Warn("could not make room for a checkout", "error", err)
		return err.Error()
	}

	if output, err := o.git(ctx, tree, "", "init", "--quiet"); err != nil {
		o.Log.Warn("could not lay out a checkout to check",
			"stack", check.StackID, "step", "init", "error", err, "output", output)
		return fmt.Sprintf("git init: %s", shell.Tail(output))
	}

	o.borrow(tree, check.Repository)

	if _, err := o.git(ctx, tree, "", "remote", "set-url", "origin", remote); err != nil {
		if output, err := o.git(ctx, tree, "", "remote", "add", "origin", remote); err != nil {
			o.Log.Warn("could not lay out a checkout to check",
				"stack", check.StackID, "step", "remote", "error", err, "output", output)
			return fmt.Sprintf("git remote: %s", shell.Tail(output))
		}
	}

	for _, args := range [][]string{
		{"fetch", "--quiet", "--no-tags", "origin", check.Base},
		{"checkout", "--quiet", "--force", "--detach", "FETCH_HEAD"},
	} {
		if output, err := o.git(ctx, tree, "", args...); err != nil {
			o.Log.Warn("could not lay out a checkout to check",
				"stack", check.StackID, "step", args[0], "error", err, "output", output)
			return fmt.Sprintf("git %s: %s", args[0], shell.Tail(output))
		}
	}

	if output, err := o.git(ctx, tree, "", "update-ref", BaseRef, "HEAD"); err != nil {
		o.Log.Warn("could not mark where a check began", "error", err, "output", output)
		return shell.Tail(output)
	}

	return ""
}

func (o Options) borrow(tree, repository string) {
	if o.Mirrors == "" {
		return
	}

	objects := filepath.Join(o.Mirrors, repository+".git", "objects")
	if info, err := os.Stat(objects); err != nil || !info.IsDir() {
		return
	}

	alternates := filepath.Join(tree, ".git", "objects", "info", "alternates")
	if err := os.MkdirAll(filepath.Dir(alternates), 0o755); err != nil {
		return
	}
	if err := os.WriteFile(alternates, []byte(objects+"\n"), 0o644); err != nil {
		o.Log.Warn("could not borrow from the host's mirror", "repository", repository, "error", err)
	}
}

func (o Options) step(
	ctx context.Context, tree string, check protocol.StackCheck, step protocol.CheckStep,
) (protocol.CheckedStep, bool) {
	started := time.Now()
	failed := func(output string) protocol.CheckedStep {
		return protocol.CheckedStep{
			Step:   step.ID,
			Passed: false,
			Output: shell.Tail(output),
			TookMs: time.Since(started).Milliseconds(),
		}
	}

	if output, err := o.git(ctx, tree, "", "reset", "--hard", "--quiet", BaseRef); err != nil {
		return failed("Git couldn't reset the copy to where the run began.\n\n" + output), true
	}
	if output, err := o.git(ctx, tree, "", "clean", "-fdq"); err != nil {
		return failed("Git couldn't reset the copy to where the run began.\n\n" + output), true
	}

	if strings.TrimSpace(step.Patch) != "" {
		if output, err := o.git(ctx, tree, step.Patch, "apply", "--whitespace=nowarn", "-"); err != nil {
			return failed("These changes don't apply on their own.\n\n" + output), true
		}
	}

	// Run setup after the patch, so the step installs what it requests.
	if check.Setup != "" && step.RunsSetup {
		if output, err := prepare.Setup(ctx, tree, check.Setup, o.RunAs, o.Setup, o.Env); err != nil {
			o.Log.Warn("could not make the checkout ready", "step", step.ID, "error", err)
			return failed("The setup command failed in this checkout.\n\n" + output), false
		}
	}

	running, stop := context.WithTimeout(ctx, o.or(o.Step, defaultStep))
	defer stop()

	output, err := o.run(running, tree, "", nil, sh, "-c", check.Command)
	if running.Err() != nil {
		return failed(output + fmt.Sprintf("\n\nThe check didn't finish in time. Time limit: %s", o.or(o.Step, defaultStep))), true
	}

	return protocol.CheckedStep{
		Step:   step.ID,
		Passed: err == nil,
		Output: shell.Tail(output),
		TookMs: time.Since(started).Milliseconds(),
	}, true
}

func (o Options) git(ctx context.Context, dir, stdin string, args ...string) (string, error) {
	return o.run(ctx, dir, stdin, map[string]string{"GIT_TERMINAL_PROMPT": "0"},
		"git", append([]string{"-c", "safe.directory=*", "-C", dir}, args...)...)
}

func (o Options) run(
	ctx context.Context, dir, stdin string, extra map[string]string, name string, args ...string,
) (string, error) {
	env := maps.Clone(o.Env)
	if env == nil {
		env = map[string]string{}
	}
	maps.Copy(env, extra)

	return shell.Run(ctx, shell.Command{Dir: dir, Stdin: stdin, Env: env, RunAs: o.RunAs, Name: name, Args: args})
}

func (o Options) own(path string) error {
	if o.RunAs == nil {
		return nil
	}
	return os.Lchown(path, int(o.RunAs.UID), int(o.RunAs.GID))
}
