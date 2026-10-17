package workspace

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"syscall"
)

type Workspace struct {
	Dir string
}

func Open(dir string) (*Workspace, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("open workspace: %w", err)
	}

	return &Workspace{Dir: dir}, nil
}

const StatePath = ".spotlight/state"

func (w *Workspace) State() (string, error) {
	dir := filepath.Join(w.Dir, StatePath)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("create state directory: %w", err)
	}

	return dir, nil
}

func (w *Workspace) ChownAll(uid, gid uint32) error {
	return filepath.WalkDir(w.Dir, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}
		if owned, ok := info.Sys().(*syscall.Stat_t); ok && owned.Uid == uid && owned.Gid == gid {
			return nil
		}

		return os.Lchown(path, int(uid), int(gid))
	})
}

func (w *Workspace) Clear(preserve []string) error {
	return clearAt(w.Dir, "", preserve)
}

func clearAt(dir, at string, preserve []string) error {
	entries, err := os.ReadDir(filepath.Join(dir, at))
	if err != nil {
		return err
	}

	var problems []error
	for _, entry := range entries {
		name := filepath.ToSlash(filepath.Join(at, entry.Name()))

		switch {
		case slices.Contains(preserve, name):
		case entry.IsDir() && containsPreserved(preserve, name):
			problems = append(problems, clearAt(dir, name, preserve))
		default:
			problems = append(problems, os.RemoveAll(filepath.Join(dir, name)))
		}
	}

	return errors.Join(problems...)
}

func containsPreserved(preserve []string, name string) bool {
	for _, each := range preserve {
		if strings.HasPrefix(each, name+"/") {
			return true
		}
	}
	return false
}
