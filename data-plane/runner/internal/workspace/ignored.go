package workspace

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"usespotlight.ai/data-plane/runner/internal/shell"
)

func (w *Workspace) Ignored(ctx context.Context, checkouts []string) ([]string, error) {
	var ignored []string
	var problems []error

	for _, checkout := range checkouts {
		tree := filepath.Join(w.Dir, checkout)
		if _, err := os.Stat(filepath.Join(tree, ".git")); err != nil {
			continue
		}

		listed, err := shell.Git(ctx, tree, nil,
			"ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory")
		if err != nil {
			problems = append(problems, fmt.Errorf("list what %s ignores: %w: %s", checkout, err, shell.Tail(listed)))
			continue
		}

		for _, each := range strings.Split(listed, "\x00") {
			if each = strings.TrimSuffix(each, "/"); each != "" {
				ignored = append(ignored, filepath.ToSlash(filepath.Join(checkout, each)))
			}
		}
	}

	return ignored, errors.Join(problems...)
}
