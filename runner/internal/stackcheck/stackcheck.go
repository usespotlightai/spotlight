package stackcheck

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
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
)

const (
	BaseRef   = "refs/spotlight/base"
	WholeStep = "whole"

	checksPath   = ".spotlight/checks"
	mostOutput   = 16 * 1024
	mostLinked   = 1000
	waitDelay    = 5 * time.Second
	shell        = "/bin/sh"
	defaultWait  = 15 * time.Minute
	defaultPoll  = 5 * time.Second
	defaultStep  = 5 * time.Minute
	defaultTotal = 20 * time.Minute
)

type Source interface {
	ChangeStackChecks(ctx context.Context, runID string) (protocol.StackChecks, error)
	RecordChangeStackCheck(ctx context.Context, runID, stackID string, checked protocol.StackChecked) error
}

type Options struct {
	Dir       string
	Checkouts []protocol.Checkout
	RunAs     *account.User
	Log       *slog.Logger
	Wait      time.Duration
	Poll      time.Duration
	Step      time.Duration
	Total     time.Duration
}

func (o Options) or(value, fallback time.Duration) time.Duration {
	if value > 0 {
		return value
	}
	return fallback
}

func Run(ctx context.Context, source Source, runID string, opts Options) {
	waitUntil := time.Now().Add(opts.or(opts.Wait, defaultWait))
	checking, stop := context.WithTimeout(ctx, opts.or(opts.Total, defaultTotal))
	defer stop()

	done := map[string]bool{}

	for {
		found, err := source.ChangeStackChecks(ctx, runID)
		if err != nil {
			opts.Log.Warn("could not ask what change stacks to check", "error", err)
			return
		}

		for _, check := range found.Checks {
			key := planOf(check)
			if done[key] {
				continue
			}
			done[key] = true

			checked := opts.check(checking, check)
			if err := source.RecordChangeStackCheck(ctx, runID, check.StackID, checked); err != nil {
				opts.Log.Warn("could not report a change stack check", "stack", check.StackID, "error", err)
			}
		}

		if !found.Waiting || time.Now().After(waitUntil) || checking.Err() != nil {
			return
		}

		select {
		case <-checking.Done():
			return
		case <-time.After(opts.or(opts.Poll, defaultPoll)):
		}
	}
}

func planOf(check protocol.StackCheck) string {
	hash := sha256.New()
	for _, step := range check.Steps {
		hash.Write([]byte(step.ID + "\x00" + step.Patch + "\x00"))
	}
	return check.StackID + ":" + hex.EncodeToString(hash.Sum(nil))
}

func (o Options) checkoutFor(repository *string) (string, string) {
	if repository == nil {
		if len(o.Checkouts) == 1 {
			return filepath.Join(o.Dir, o.Checkouts[0].Path), ""
		}
		return "", "The run works several repositories, and the stack does not say which it is from."
	}

	for _, checkout := range o.Checkouts {
		if checkout.Path == *repository {
			return filepath.Join(o.Dir, checkout.Path), ""
		}
	}

	return "", fmt.Sprintf("The run has no checkout of %s.", *repository)
}

func (o Options) check(ctx context.Context, check protocol.StackCheck) protocol.StackChecked {
	checkout, missing := o.checkoutFor(check.Repository)
	if missing != "" {
		return protocol.StackChecked{Skipped: missing}
	}

	if _, err := o.git(ctx, checkout, "", "rev-parse", "--verify", "--quiet", BaseRef); err != nil {
		return protocol.StackChecked{Skipped: "The checkout has no record of where the run began."}
	}

	tree, err := o.setOut(ctx, checkout, check.StackID)
	if err != nil {
		o.Log.Warn("could not set out a copy to check", "stack", check.StackID, "error", err)
		return protocol.StackChecked{Skipped: "Spotlight could not set out a copy of the checkout to check."}
	}
	defer o.clearAway(checkout, tree)

	ignored := o.ignored(ctx, checkout)

	var steps []protocol.CheckedStep
	for _, step := range check.Steps {
		if ctx.Err() != nil {
			break
		}

		checked := o.step(ctx, checkout, tree, ignored, check.Command, step)
		steps = append(steps, checked)

		if step.ID == WholeStep && !checked.Passed {
			break
		}
	}

	if len(steps) == 0 {
		return protocol.StackChecked{Skipped: "There was no time left to check the stack."}
	}

	return protocol.StackChecked{Steps: steps}
}

func (o Options) setOut(ctx context.Context, checkout, stackID string) (string, error) {
	parent := filepath.Join(o.Dir, checksPath)
	if err := os.MkdirAll(parent, 0o700); err != nil {
		return "", err
	}
	if err := o.own(parent); err != nil {
		return "", err
	}

	tree := filepath.Join(parent, stackID)
	if err := os.RemoveAll(tree); err != nil {
		return "", err
	}

	if output, err := o.git(ctx, checkout, "", "worktree", "add", "--detach", "--quiet", tree, BaseRef); err != nil {
		return "", fmt.Errorf("%w: %s", err, output)
	}

	return tree, nil
}

func (o Options) ignored(ctx context.Context, checkout string) []string {
	listed, err := o.git(ctx, checkout, "", "ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z")
	if err != nil {
		o.Log.Warn("could not list what the checkout ignores", "error", err)
		return nil
	}

	var entries []string
	for _, entry := range strings.Split(listed, "\x00") {
		entry = strings.TrimSuffix(strings.TrimSpace(entry), "/")
		if entry != "" && len(entries) < mostLinked {
			entries = append(entries, entry)
		}
	}

	return entries
}

func (o Options) linkIgnored(checkout, tree string, entries []string) {
	for _, entry := range entries {
		link := filepath.Join(tree, entry)
		if _, err := os.Lstat(filepath.Dir(link)); err != nil {
			continue
		}
		if _, err := os.Lstat(link); err == nil {
			continue
		}

		if err := os.Symlink(filepath.Join(checkout, entry), link); err != nil {
			continue
		}
		if o.RunAs != nil {
			_ = os.Lchown(link, int(o.RunAs.UID), int(o.RunAs.GID))
		}
	}
}

func (o Options) clearAway(checkout, tree string) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	if output, err := o.git(ctx, checkout, "", "worktree", "remove", "--force", tree); err != nil {
		o.Log.Warn("could not remove the copy a check ran in", "error", err, "output", output)
	}
	_ = os.RemoveAll(tree)
	_, _ = o.git(ctx, checkout, "", "worktree", "prune")
}

func (o Options) step(
	ctx context.Context, checkout, tree string, ignored []string, command string, step protocol.CheckStep,
) protocol.CheckedStep {
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
		return failed("Could not return the copy to where the run began: " + output)
	}
	if output, err := o.git(ctx, tree, "", "clean", "-fdq"); err != nil {
		return failed("Could not return the copy to where the run began: " + output)
	}

	o.linkIgnored(checkout, tree, ignored)

	if strings.TrimSpace(step.Patch) != "" {
		if output, err := o.git(ctx, tree, step.Patch, "apply", "--whitespace=nowarn", "-"); err != nil {
			return failed("These changes do not apply on their own:\n" + output)
		}
	}

	running, stop := context.WithTimeout(ctx, o.or(o.Step, defaultStep))
	defer stop()

	output, err := o.run(running, tree, "", nil, shell, "-c", command)
	if running.Err() != nil {
		return failed(output + fmt.Sprintf("\n\nThe check did not finish within %s.", o.or(o.Step, defaultStep)))
	}

	return protocol.CheckedStep{
		Step:   step.ID,
		Passed: err == nil,
		Output: tail(output),
		TookMs: time.Since(started).Milliseconds(),
	}
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

func (o Options) own(path string) error {
	if o.RunAs == nil {
		return nil
	}
	return os.Lchown(path, int(o.RunAs.UID), int(o.RunAs.GID))
}

func tail(output string) string {
	if len(output) <= mostOutput {
		return output
	}
	return output[len(output)-mostOutput:]
}
