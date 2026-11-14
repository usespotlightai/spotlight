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

	trusted, err := trustingConfig()
	if err != nil {
		return err
	}
	defer os.Remove(trusted)
	git := func(dir string, args ...string) (string, error) {
		return shell.Run(ctx, shell.Command{
			Dir:  dir,
			Env:  map[string]string{"GIT_TERMINAL_PROMPT": "0", "GIT_CONFIG_GLOBAL": trusted},
			Name: "git",
			Args: args,
		})
	}

	if output, err := git(dir, "clone", "--quiet", source, tree); err != nil {
		return fmt.Errorf("git clone %s from the mirror: %w: %s", checkout.Path, err, shell.Tail(output))
	}

	if _, err := git(tree, "rev-parse", "--verify", "--quiet", "HEAD"); err != nil {
		if err := os.RemoveAll(tree); err != nil {
			return fmt.Errorf("remove the empty clone of %s: %w", checkout.Path, err)
		}
		return fmt.Errorf("the mirror of %s names no default branch", checkout.Path)
	}

	return nil
}

// The host's user owns the mirrors, and Debian's git takes safe.directory only from global or system config, not from -c.
func trustingConfig() (string, error) {
	file, err := os.CreateTemp("", "spotlight-mirror-*.gitconfig")
	if err != nil {
		return "", err
	}
	defer file.Close()
	if _, err := file.WriteString("[safe]\n\tdirectory = *\n"); err != nil {
		os.Remove(file.Name())
		return "", err
	}
	return file.Name(), nil
}
