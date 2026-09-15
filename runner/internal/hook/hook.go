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
	Path    string
	Dir     string
	Payload any
	Env     map[string]string
	Timeout time.Duration
}

var ErrNoHook = errors.New("no hook configured")

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

	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	command.Cancel = func() error {
		return syscall.Kill(-command.Process.Pid, syscall.SIGKILL)
	}
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
