// Package hook runs the commands a deployment supplies at fixed points in a
// run: preparing the workspace, and publishing what came out of it.
//
// The runner owns when they run and what happens if they fail. It knows
// nothing about what they do, which is what lets one binary serve a monorepo
// with a sparse checkout, a pre-warmed cache, and a version control system
// that is not git.
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
	// Path is the executable to run. Empty means there is no hook, which is
	// not an error: a run against an already-prepared tree needs neither.
	Path string
	// Dir is the working directory, always the run's own.
	Dir string
	// Payload is written to the hook's stdin as JSON.
	Payload any
	// Env is added to the runner's own environment. Hooks run as the runner
	// and are trusted the same way it is: they are the deployment's code, not
	// the agent's.
	Env map[string]string
	// Timeout bounds the hook. Without one a wedged clone holds the lease and
	// the sandbox until the run is requeued from elsewhere.
	Timeout time.Duration
}

// ErrNoHook reports that nothing was configured.
var ErrNoHook = errors.New("no hook configured")

// Run executes the hook and returns everything it wrote. The output is
// returned on failure too, since a hook's stderr is the only explanation a
// failed checkout will ever have.
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

	// Its own process group, killed as a group. A hook is a shell script, and
	// killing only the shell leaves whatever it spawned holding the output
	// pipe — so the timeout would elapse and the run would wait anyway, which
	// is the exact situation the timeout exists to prevent.
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	command.Cancel = func() error {
		return syscall.Kill(-command.Process.Pid, syscall.SIGKILL)
	}
	// Belt and braces: if something still holds the pipe, stop reading anyway.
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
