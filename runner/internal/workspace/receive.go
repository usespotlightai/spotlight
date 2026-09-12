package workspace

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"usespotlight.ai/runner/internal/account"
)

// Receive places one file at path inside the workspace, skipping one already
// there. Owner is nil before the hand-over, which gives what this makes along
// with everything else.
func (w *Workspace) Receive(path string, owner *account.User, fetch func(io.Writer) error) error {
	if !filepath.IsLocal(path) {
		return fmt.Errorf("attachment %q escapes the workspace", path)
	}
	path = filepath.Clean(path)

	// Opened as a root, so a link the agent left in its workspace cannot lead
	// the runner, with rights the agent lacks, to write somewhere else.
	root, err := os.OpenRoot(w.Dir)
	if err != nil {
		return fmt.Errorf("open workspace: %w", err)
	}
	defer root.Close()

	_, err = root.Lstat(path)
	if err == nil {
		return nil
	}
	if !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("look for %s: %w", path, err)
	}

	if err := parents(root, filepath.Dir(path), owner); err != nil {
		return err
	}

	return place(root, path, owner, fetch)
}

func parents(root *os.Root, dir string, owner *account.User) error {
	if dir == "." {
		return nil
	}

	walked := ""
	for _, part := range strings.Split(dir, string(filepath.Separator)) {
		walked = filepath.Join(walked, part)

		err := root.Mkdir(walked, 0o700)
		if errors.Is(err, fs.ErrExist) {
			continue
		}
		if err != nil {
			return fmt.Errorf("create %s: %w", walked, err)
		}

		if owner != nil {
			if err := root.Lchown(walked, int(owner.UID), int(owner.GID)); err != nil {
				return fmt.Errorf("hand over %s: %w", walked, err)
			}
		}
	}

	return nil
}

func place(root *os.Root, path string, owner *account.User, fetch func(io.Writer) error) error {
	partial := filepath.Join(filepath.Dir(path), "."+filepath.Base(path)+"."+rand.Text())

	file, err := root.OpenFile(partial, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}

	err = fetch(file)
	// Given before it is renamed in, so the file is never visible as anyone's
	// but the agent's.
	if err == nil && owner != nil {
		err = file.Chown(int(owner.UID), int(owner.GID))
	}
	if closed := file.Close(); err == nil {
		err = closed
	}
	if err == nil {
		err = root.Rename(partial, path)
	}

	if err != nil {
		_ = root.Remove(partial)
		return fmt.Errorf("place %s: %w", path, err)
	}

	return nil
}
