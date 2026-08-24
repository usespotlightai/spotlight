// Package hook runs the commands a deployment supplies at fixed points in a
// run: preparing the workspace, and publishing what came out of it.
//
// The runner owns when they run and what happens if they fail, but knows
// nothing about what they do. That is what lets one binary serve a sparse
// checkout, a warm cache, or something other than git.
package hook

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"time"
)

type Spec struct {
	// Path is the executable to run. Empty means no hook, which is not an
	// error.
	Path string
	Dir  string
	// Payload is written to the hook's stdin as JSON.
	Payload any
	// Env is added to the runner's own environment. Hooks run as the runner
	// and are trusted like it: they are the deployment's code, not the
	// agent's.
	Env map[string]string
	// Timeout bounds the hook. Without one a wedged clone holds the lease
	// until the run is requeued.
	Timeout time.Duration
}

var ErrNoHook = errors.New("no hook configured")

// Run executes the hook and returns everything it wrote, on failure too: the
// hook's stderr is the only explanation a failed checkout has.
func Run(ctx context.Context, spec Spec) (string, error) {
	if spec.Path == "" {
		return "", ErrNoHook
	}

	if spec.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, spec.Timeout)
		defer cancel()
	}

	payload, err := json.Marshal(spec.Payload)
	if err != nil {
		return "", fmt.Errorf("describe the run for %s: %w", spec.Path, err)
	}

	command := exec.CommandContext(ctx, spec.Path)
	command.Dir = spec.Dir
	command.Stdin = bytes.NewReader(payload)
	command.Env = environment(spec.Env)

	// Own process group, killed as a group. A hook is usually a shell script;
	// killing only the shell leaves its children holding the output pipe, and
	// the read blocks past the timeout anyway.
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	command.Cancel = func() error {
		return syscall.Kill(-command.Process.Pid, syscall.SIGKILL)
	}
	// If something still holds the pipe, stop reading anyway.
	command.WaitDelay = 5 * time.Second

	out, err := command.CombinedOutput()
	output := strings.TrimSpace(string(out))

	if ctx.Err() != nil {
		return output, fmt.Errorf("%s did not finish within %s", spec.Path, spec.Timeout)
	}
	if err != nil {
		return output, fmt.Errorf("%s: %w", spec.Path, err)
	}

	return output, nil
}

func environment(extra map[string]string) []string {
	env := append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	for key, value := range extra {
		env = append(env, key+"="+value)
	}
	return env
}
