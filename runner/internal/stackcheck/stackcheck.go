package stackcheck

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"usespotlight.ai/runner/internal/account"
	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/workspace"
)

const (
	BaseRef = "refs/spotlight/base"

	mostOutput   = 16 * 1024
	waitDelay    = 5 * time.Second
	shell        = "/bin/sh"
	defaultStep  = 5 * time.Minute
	defaultSetup = 15 * time.Minute
	defaultTotal = 60 * time.Minute
)

type Reporter interface {
	RecordChangeStackCheck(ctx context.Context, runID, stackID string, checked protocol.StackChecked) error
}

type Options struct {
	Dir      string
	Remote   string
	RunAs    *account.User
	Log      *slog.Logger
	Step     time.Duration
	Setup    time.Duration
	Total    time.Duration
	KeepDirs bool
}

func (o Options) or(value, fallback time.Duration) time.Duration {
	if value > 0 {
		return value
	}
	return fallback
}

func Perform(ctx context.Context, reporter Reporter, check protocol.StackCheck, opts Options) {
	checking, stop := context.WithTimeout(ctx, opts.or(opts.Total, defaultTotal))
	defer stop()

	checked := opts.perform(checking, check)

	if err := reporter.RecordChangeStackCheck(ctx, check.RunID, check.StackID, checked); err != nil {
		opts.Log.Warn("could not report a change stack check", "stack", check.StackID, "error", err)
	}
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

	space, err := workspace.Create(o.Dir, "check-"+check.StackID)
	if err != nil {
		o.Log.Warn("could not make room to check a stack", "stack", check.StackID, "error", err)
		return skipped(protocol.SkipNoRoom, err.Error())
	}
	if !o.KeepDirs {
		defer func() {
			if err := space.Remove(); err != nil {
				o.Log.Warn("could not remove the copy a check ran in", "error", err)
			}
		}()
	}

	tree := filepath.Join(space.Dir, check.Repository)

	if missing := o.fetch(ctx, tree, check); missing != "" {
		return skipped(protocol.SkipCheckoutFailed, missing)
	}
	if o.RunAs != nil {
		if err := space.GiveTo(o.RunAs.UID, o.RunAs.GID); err != nil {
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

	for _, args := range [][]string{
		{"init", "--quiet"},
		{"remote", "add", "origin", remote},
		{"fetch", "--quiet", "--no-tags", "origin", check.Base},
		{"checkout", "--quiet", "--detach", "FETCH_HEAD"},
	} {
		if output, err := o.git(ctx, tree, "", args...); err != nil {
			o.Log.Warn("could not lay out a checkout to check",
				"stack", check.StackID, "step", args[0], "error", err, "output", output)
			return fmt.Sprintf("git %s: %s", args[0], tail(output))
		}
	}

	if output, err := o.git(ctx, tree, "", "update-ref", BaseRef, "HEAD"); err != nil {
		o.Log.Warn("could not mark where a check began", "error", err, "output", output)
		return tail(output)
	}

	return ""
}

func (o Options) step(
	ctx context.Context, tree string, check protocol.StackCheck, step protocol.CheckStep,
) (protocol.CheckedStep, bool) {
	started := time.Now()
	failed := func(output string) protocol.CheckedStep {
		return protocol.CheckedStep{
			Step:   step.ID,
			Passed: false,
			Output: tail(output),
			TookMs: time.Since(started).Milliseconds(),
		}
	}

	if output, err := o.git(ctx, tree, "", "reset", "--hard", "--quiet", BaseRef); err != nil {
		return failed("Could not return the copy to where the run began: " + output), true
	}
	if output, err := o.git(ctx, tree, "", "clean", "-fdq"); err != nil {
		return failed("Could not return the copy to where the run began: " + output), true
	}

	if strings.TrimSpace(step.Patch) != "" {
		if output, err := o.git(ctx, tree, step.Patch, "apply", "--whitespace=nowarn", "-"); err != nil {
			return failed("These changes do not apply on their own:\n" + output), true
		}
	}

	// After the patch, so what the step installs is what the step asks for.
	if check.Setup != "" && step.RunsSetup {
		ready, stop := context.WithTimeout(ctx, o.or(o.Setup, defaultSetup))
		defer stop()

		if output, err := o.run(ready, tree, "", nil, shell, "-c", check.Setup); err != nil {
			o.Log.Warn("could not make the checkout ready", "step", step.ID, "error", err)
			return failed("The checkout could not be made ready to check:\n" + output), false
		}
	}

	running, stop := context.WithTimeout(ctx, o.or(o.Step, defaultStep))
	defer stop()

	output, err := o.run(running, tree, "", nil, shell, "-c", check.Command)
	if running.Err() != nil {
		return failed(output + fmt.Sprintf("\n\nThe check did not finish within %s.", o.or(o.Step, defaultStep))), true
	}

	return protocol.CheckedStep{
		Step:   step.ID,
		Passed: err == nil,
		Output: tail(output),
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
	command := exec.CommandContext(ctx, name, args...)
	command.Dir = dir
	command.Env = account.Environment(extra, o.RunAs)
	command.Stdin = strings.NewReader(stdin)
	command.SysProcAttr = o.RunAs.SysProcAttr()
	if command.SysProcAttr == nil {
		command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	}
	command.Cancel = func() error {
		if command.Process == nil {
			return nil
		}
		return syscall.Kill(-command.Process.Pid, syscall.SIGKILL)
	}
	command.WaitDelay = waitDelay

	var output bytes.Buffer
	command.Stdout = &output
	command.Stderr = &output

	err := command.Run()
	var exited *exec.ExitError
	if err != nil && !errors.As(err, &exited) && ctx.Err() == nil {
		return output.String(), fmt.Errorf("run %s: %w", name, err)
	}

	return strings.TrimSpace(output.String()), err
}

func tail(output string) string {
	if len(output) <= mostOutput {
		return output
	}
	return output[len(output)-mostOutput:]
}

func (o Options) own(path string) error {
	if o.RunAs == nil {
		return nil
	}
	return os.Lchown(path, int(o.RunAs.UID), int(o.RunAs.GID))
}
