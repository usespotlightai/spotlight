package prepare

import (
	"context"
	"fmt"
	"time"

	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/shell"
)

const DefaultSetupTimeout = 15 * time.Minute

func Setup(
	ctx context.Context, tree, command string, as *account.User, timeout time.Duration, env map[string]string,
) (string, error) {
	if timeout <= 0 {
		timeout = DefaultSetupTimeout
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	output, err := shell.Run(ctx, shell.Command{Dir: tree, Env: env, RunAs: as, Name: "/bin/sh", Args: []string{"-c", command}})
	if ctx.Err() != nil {
		return shell.Tail(output), fmt.Errorf("did not finish within %s", timeout)
	}
	return shell.Tail(output), err
}
