package stackcheck

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"slices"
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

var errNoLongerLeased = errors.New("the work is no longer leased")

type Control interface {
	RenewCheckLease(ctx context.Context, stackID string, recheck bool) (bool, error)
	RecordChangeStackCheck(ctx context.Context, stackID string, recheck bool, checked protocol.StackCheckResult) error
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

	leased, lost := opts.hold(checking, func(ctx context.Context) (bool, error) {
		return client.RenewCheckLease(ctx, check.StackID, check.Recheck)
	}, opts.Log.With("stack", check.StackID))

	checked := opts.perform(leased, check)

	if lost() {
		opts.Log.Info("stopped checking a change stack it no longer leases", "stack", check.StackID)
		return
	}

	if err := client.RecordChangeStackCheck(ctx, check.StackID, check.Recheck, checked); err != nil {
		opts.Log.Warn("could not report a change stack check", "stack", check.StackID, "error", err)
	}
}

func (o Options) hold(
	ctx context.Context, renew func(context.Context) (bool, error), log *slog.Logger,
) (context.Context, func() bool) {
	leased, release := context.WithCancelCause(ctx)
	done := make(chan struct{})

	go func() {
		defer close(done)
		ticker := time.NewTicker(o.or(o.Renew, defaultRenew))
		defer ticker.Stop()

		for {
			select {
			case <-leased.Done():
				return
			case <-ticker.C:
				stop, err := renew(leased)
				switch {
				case err == nil && stop:
					log.Info("a stop was requested, so the work stops")
					release(errNoLongerLeased)
					return
				case err != nil && control.CheckLeaseLost(err):
					log.Warn("lost the lease of its work", "error", err)
					release(errNoLongerLeased)
					return
				case err != nil && leased.Err() == nil:
					log.Warn("could not renew the lease of its work", "error", err)
				}
			}
		}
	}()

	return leased, func() bool {
		lost := errors.Is(context.Cause(leased), errNoLongerLeased)
		release(nil)
		<-done
		return lost
	}
}

func skipped(code, detail string) protocol.StackCheckResult {
	return protocol.StackCheckResult{Skipped: &protocol.SkippedCheck{Code: code, Detail: detail}}
}

func (o Options) perform(ctx context.Context, check protocol.StackCheck) protocol.StackCheckResult {
	if check.Base == "" {
		return skipped(protocol.SkipNoBase, "")
	}
	if check.Repository == "" {
		return skipped(protocol.SkipNoCheckout, "")
	}

	space, err := workspace.Open(o.Dir)
	if err != nil {
		o.Log.Warn("could not open a workspace to check a stack", "stack", check.StackID, "error", err)
		return skipped(protocol.SkipWorkingCopyFailed, err.Error())
	}

	tree := filepath.Join(space.Dir, check.Repository)

	if missing := o.fetch(ctx, tree, check); missing != "" {
		return skipped(protocol.SkipCheckoutFailed, missing)
	}
	if o.RunAs != nil {
		if err := space.ChownAll(o.RunAs.UID, o.RunAs.GID); err != nil {
			o.Log.Warn("could not hand over the copy a check runs in", "error", err)
			return skipped(protocol.SkipWorkingCopyFailed, err.Error())
		}
	}

	var steps []protocol.CheckStepResult
	installed := map[string]string{}
	for at, step := range check.Steps {
		if ctx.Err() != nil {
			break
		}

		checked, ready := o.step(ctx, tree, check, step, installed)

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

	return protocol.StackCheckResult{Steps: steps}
}

func (o Options) fetch(ctx context.Context, tree string, check protocol.StackCheck) string {
	if failed := o.fetchCommits(ctx, tree, check.Repository, check.Base); failed != "" {
		return failed
	}

	if output, err := o.git(ctx, tree, "", "checkout", "--quiet", "--force", "--detach", "FETCH_HEAD"); err != nil {
		o.Log.Warn("could not prepare a checkout to check", "step", "checkout", "error", err, "output", output)
		return fmt.Sprintf("git checkout: %s", shell.Tail(output))
	}

	if output, err := o.git(ctx, tree, "", "update-ref", BaseRef, "HEAD"); err != nil {
		o.Log.Warn("could not mark where a check began", "error", err, "output", output)
		return shell.Tail(output)
	}

	return ""
}

func (o Options) fetchCommits(ctx context.Context, tree, repository string, commits ...string) string {
	remote := strings.TrimSuffix(o.Remote, "/") + "/" + repository

	if err := os.MkdirAll(tree, 0o700); err != nil {
		o.Log.Warn("could not make room for a checkout", "error", err)
		return err.Error()
	}

	if output, err := o.git(ctx, tree, "", "init", "--quiet"); err != nil {
		o.Log.Warn("could not prepare a checkout", "step", "init", "error", err, "output", output)
		return fmt.Sprintf("git init: %s", shell.Tail(output))
	}

	o.useMirrorAlternates(tree, repository)

	if _, err := o.git(ctx, tree, "", "remote", "set-url", "origin", remote); err != nil {
		if output, err := o.git(ctx, tree, "", "remote", "add", "origin", remote); err != nil {
			o.Log.Warn("could not prepare a checkout", "step", "remote", "error", err, "output", output)
			return fmt.Sprintf("git remote: %s", shell.Tail(output))
		}
	}

	fetch := append([]string{"fetch", "--quiet", "--no-tags", "origin"}, commits...)
	if output, err := o.git(ctx, tree, "", fetch...); err != nil {
		o.Log.Warn("could not prepare a checkout", "step", "fetch", "error", err, "output", output)
		return fmt.Sprintf("git fetch: %s", shell.Tail(output))
	}

	return ""
}

func (o Options) useMirrorAlternates(tree, repository string) {
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
		o.Log.Warn("could not use the host's mirror as git alternates", "repository", repository, "error", err)
	}
}

func (o Options) step(
	ctx context.Context, tree string, check protocol.StackCheck, step protocol.CheckStep, installed map[string]string,
) (protocol.CheckStepResult, bool) {
	started := time.Now()
	failed := func(output string) protocol.CheckStepResult {
		return protocol.CheckStepResult{
			Step:       step.ID,
			Passed:     false,
			Output:     shell.Tail(output),
			DurationMs: time.Since(started).Milliseconds(),
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
	warning := ""
	if step.RunsSetup {
		output, warned, err := o.setUp(ctx, tree, check, installed)
		if err != nil {
			o.Log.Warn("could not make the checkout ready", "step", step.ID, "error", err)
			return failed("The setup failed in this checkout.\n\n" + output), false
		}
		if warned != nil {
			o.Log.Warn("ran the check without installs Spotlight found from lockfiles", "step", step.ID, "error", warned)
			warning = "\n\nThe check ran without what these installs Spotlight found from the lockfiles would have installed:\n" +
				warned.Error()
		}
	}

	running, stop := context.WithTimeout(ctx, o.or(o.Step, defaultStep))
	defer stop()

	output, err := o.run(running, tree, "", nil, sh, "-c", check.Command)
	if running.Err() != nil {
		return failed(output + fmt.Sprintf("\n\nThe check didn't finish in time. Time limit: %s", o.or(o.Step, defaultStep))), true
	}

	return protocol.CheckStepResult{
		Step:       step.ID,
		Passed:     err == nil,
		Output:     shell.Tail(output) + warning,
		DurationMs: time.Since(started).Milliseconds(),
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

// installedKey tells apart two steps in one directory, such as npm and uv at the root.
func installedKey(step prepare.SetupStep) string {
	return step.Dir + "\x00" + step.From
}

// setUp installs what the checkout needs: the line's setup where it names one, else the steps Spotlight finds from
// the lockfiles. Of the found steps, only those whose dependency files changed since they last installed in this
// check run again, so a layer that changes one lockfile of a monorepo reinstalls only that project; when none
// changed, as for a file the step does not track, every step runs.
//
// A setup the line names that fails is an error, which skips the step. A found step that fails is only a warning:
// the check runs without it, as the run itself did, and it was never the line's to repair.
func (o Options) setUp(
	ctx context.Context, tree string, check protocol.StackCheck, installed map[string]string,
) (output string, warning, err error) {
	if check.Setup != "" {
		output, err := prepare.Setup(ctx, tree, check.Setup, o.RunAs, o.Setup, o.Env)
		return output, nil, err
	}

	steps, err := prepare.DetectSetup(ctx, tree)
	if err != nil {
		o.Log.Warn("could not look for a setup in the checkout", "error", err)
		return "", nil, nil
	}

	inputs := make([]string, len(steps))
	var due []prepare.SetupStep
	for i, step := range steps {
		inputs[i], _ = prepare.SetupInputs(ctx, filepath.Join(tree, filepath.FromSlash(step.Dir)), step.Command)
		if inputs[i] == "" || installed[installedKey(step)] != inputs[i] {
			due = append(due, step)
		}
	}
	if len(due) == 0 {
		due = steps
	}
	if len(due) == 0 {
		return "", nil, nil
	}

	output, failures := prepare.SetupAll(ctx, tree, due, o.RunAs, o.Setup, o.Env)
	for i, step := range due {
		at := slices.IndexFunc(steps, func(each prepare.SetupStep) bool { return installedKey(each) == installedKey(step) })
		if failures[i] == nil && inputs[at] != "" {
			installed[installedKey(step)] = inputs[at]
		}
	}
	return output, errors.Join(failures...), nil
}
