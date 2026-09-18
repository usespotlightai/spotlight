package workspace

import (
	"fmt"
	"os"
	"path/filepath"
)

type Workspace struct {
	Dir string
}

func Create(root, key string) (*Workspace, error) {
	if err := os.MkdirAll(root, 0o711); err != nil {
		return nil, fmt.Errorf("create workspace root: %w", err)
	}

	dir := filepath.Join(root, key)
	if err := os.Mkdir(dir, 0o700); err != nil && !os.IsExist(err) {
		return nil, fmt.Errorf("create workspace: %w", err)
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

func (w *Workspace) GiveTo(uid, gid uint32) error {
	if err := os.Chmod(filepath.Dir(w.Dir), 0o711); err != nil {
		return fmt.Errorf("make workspace root traversable: %w", err)
	}

	return filepath.WalkDir(w.Dir, func(path string, _ os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		return os.Lchown(path, int(uid), int(gid))
	})
}

func (w *Workspace) Remove() error {
	if w == nil || w.Dir == "" {
		return nil
	}
	return os.RemoveAll(w.Dir)
}
