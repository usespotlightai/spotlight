package prepare

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/shell"
)

func FromMirror(ctx context.Context, mirrors, dir string, checkout protocol.WarmCheckout) error {
	if !filepath.IsLocal(checkout.Path) || strings.ContainsAny(checkout.Path, `/\`) {
		return fmt.Errorf("%q is not a name a checkout can have", checkout.Path)
	}

	source := filepath.Join(mirrors, checkout.Path+".git")
	tree := filepath.Join(dir, checkout.Path)
	if mirrors == "" || !exists(source) {
		return fmt.Errorf("this host has no mirror of %s", checkout.Path)
	}
	if exists(filepath.Join(tree, ".git")) {
		return nil
	}

	output, err := shell.Run(ctx, shell.Command{
		Dir:  dir,
		Env:  map[string]string{"GIT_TERMINAL_PROMPT": "0"},
		Name: "git",
		Args: []string{"-c", "safe.directory=*", "clone", "--quiet", source, tree},
	})
	if err != nil {
		return fmt.Errorf("git clone %s from the mirror: %w: %s", checkout.Path, err, shell.Tail(output))
	}

	if _, err := shell.Git(ctx, tree, nil, "rev-parse", "--verify", "--quiet", "HEAD"); err != nil {
		if err := os.RemoveAll(tree); err != nil {
			return fmt.Errorf("remove the empty clone of %s: %w", checkout.Path, err)
		}
		return fmt.Errorf("the mirror of %s names no default branch", checkout.Path)
	}

	return nil
}
