package workspace

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func (w *Workspace) Prune(dir string, preserve []string) error {
	if !filepath.IsLocal(dir) {
		return fmt.Errorf("%q escapes the workspace", dir)
	}
	dir = filepath.Clean(dir)

	preserved := map[string]bool{}
	parents := map[string]bool{}
	for _, path := range preserve {
		if !filepath.IsLocal(path) {
			return fmt.Errorf("%q escapes the workspace", path)
		}
		path = filepath.Clean(path)
		preserved[path] = true
		for parent := filepath.Dir(path); parent != "."; parent = filepath.Dir(parent) {
			parents[parent] = true
		}
	}

	root, err := os.OpenRoot(w.Dir)
	if err != nil {
		return fmt.Errorf("open workspace: %w", err)
	}
	defer root.Close()

	walked := ""
	for _, part := range strings.Split(dir, string(filepath.Separator)) {
		walked = filepath.Join(walked, part)

		info, err := root.Lstat(walked)
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("look for %s: %w", walked, err)
		}
		if !info.IsDir() {
			return fmt.Errorf("%s is not a directory to prune", walked)
		}
	}

	return prune(root, dir, preserved, parents)
}

func prune(root *os.Root, dir string, preserved, parents map[string]bool) error {
	opened, err := root.Open(dir)
	if err != nil {
		return fmt.Errorf("open %s: %w", dir, err)
	}
	entries, err := opened.ReadDir(-1)
	_ = opened.Close()
	if err != nil {
		return fmt.Errorf("read %s: %w", dir, err)
	}

	for _, entry := range entries {
		path := filepath.Join(dir, entry.Name())

		switch {
		case preserved[path]:
		case parents[path] && entry.Type().IsDir():
			if err := prune(root, path, preserved, parents); err != nil {
				return err
			}
		default:
			if err := root.RemoveAll(path); err != nil {
				return fmt.Errorf("remove %s: %w", path, err)
			}
		}
	}

	return nil
}

func (w *Workspace) Remove(path string) error {
	if !filepath.IsLocal(path) {
		return fmt.Errorf("%q escapes the workspace", path)
	}

	root, err := os.OpenRoot(w.Dir)
	if err != nil {
		return fmt.Errorf("open workspace: %w", err)
	}
	defer root.Close()

	if err := root.RemoveAll(filepath.Clean(path)); err != nil {
		return fmt.Errorf("remove %s: %w", path, err)
	}

	return nil
}
