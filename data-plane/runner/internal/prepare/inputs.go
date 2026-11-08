package prepare

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"

	"usespotlight.ai/data-plane/runner/internal/shell"
)

var dependencyFiles = []string{
	".node-version", ".nvmrc", ".python-version", ".ruby-version", ".tool-versions",
	"bun.lock", "bun.lockb", "Cargo.lock", "Cargo.toml", "composer.json", "composer.lock",
	"Gemfile", "Gemfile.lock", "go.mod", "go.sum", "go.work", "go.work.sum", "mix.exs", "mix.lock",
	"npm-shrinkwrap.json", "package-lock.json", "package.json", "Pipfile", "Pipfile.lock",
	"pnpm-lock.yaml", "pnpm-workspace.yaml", "poetry.lock", "pyproject.toml", "uv.lock", "yarn.lock",
}

func dependencyFile(name string) bool {
	base := path.Base(name)
	if slices.Contains(dependencyFiles, base) {
		return true
	}
	return strings.HasPrefix(base, "requirements") && strings.HasSuffix(base, ".txt")
}

func SetupInputs(ctx context.Context, tree, command string) (string, error) {
	listed, err := shell.Git(ctx, tree, nil, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
	if err != nil {
		return "", fmt.Errorf("list the files of %s: %w: %s", tree, err, shell.Tail(listed))
	}

	names := slices.DeleteFunc(strings.Split(listed, "\x00"), func(name string) bool { return !dependencyFile(name) })
	slices.Sort(names)
	names = slices.Compact(names)

	hash := sha256.New()
	fmt.Fprintf(hash, "command %d\n%s\n", len(command), command)
	for _, name := range names {
		content, err := os.ReadFile(filepath.Join(tree, name))
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return "", fmt.Errorf("read %s: %w", name, err)
		}
		fmt.Fprintf(hash, "file %d %s %d\n", len(name), name, len(content))
		hash.Write(content)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}
