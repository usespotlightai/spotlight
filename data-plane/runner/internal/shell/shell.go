package shell

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"usespotlight.ai/data-plane/runner/internal/account"
)

const (
	waitDelay  = 5 * time.Second
	MostOutput = 16 * 1024
)

type Command struct {
	Dir   string
	Stdin string
	Env   map[string]string
	RunAs *account.User
	Name  string
	Args  []string
}

func Run(ctx context.Context, c Command) (string, error) {
	command := exec.CommandContext(ctx, c.Name, c.Args...)
	command.Dir = c.Dir
	command.Env = account.Environment(c.Env, c.RunAs)
	command.Stdin = strings.NewReader(c.Stdin)
	command.SysProcAttr = c.RunAs.SysProcAttr()
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
		return output.String(), fmt.Errorf("run %s: %w", c.Name, err)
	}

	return strings.TrimSpace(output.String()), err
}

func Git(ctx context.Context, dir string, as *account.User, args ...string) (string, error) {
	return Run(ctx, Command{
		Dir:   dir,
		Env:   map[string]string{"GIT_TERMINAL_PROMPT": "0"},
		RunAs: as,
		Name:  "git",
		Args:  append([]string{"-c", "safe.directory=*", "-C", dir}, args...),
	})
}

func Tail(output string) string {
	if len(output) <= MostOutput {
		return output
	}
	return output[len(output)-MostOutput:]
}
