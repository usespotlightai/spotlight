// Package workspace owns the directory a run works in: making it, handing it
// to the agent, and disposing of it.
//
// What goes inside is the prepare hook's business. Checkout varies too much
// (sparse checkouts, submodules, warm caches, something other than git) to be
// fixed here.
package workspace

import (
	"fmt"
	"os"
	"path/filepath"
)

type Workspace struct {
	// Dir is the run's own directory, and the only thing this package created.
	Dir string
}

func Create(root, runID string) (*Workspace, error) {
	// Traversable but not listable: an agent reaches its own workspace without
	// enumerating anyone else's.
	if err := os.MkdirAll(root, 0o711); err != nil {
		return nil, fmt.Errorf("create workspace root: %w", err)
	}

	dir := filepath.Join(root, runID)
	if err := os.Mkdir(dir, 0o700); err != nil && !os.IsExist(err) {
		return nil, fmt.Errorf("create workspace: %w", err)
	}

	return &Workspace{Dir: dir}, nil
}

// Resolve turns the run's requested working directory into an absolute one,
// after the prepare hook has had its chance to create it.
func (w *Workspace) Resolve(cwd string) (string, error) {
	if cwd == "" {
		return w.Dir, nil
	}
	if !filepath.IsLocal(cwd) {
		return "", fmt.Errorf("cwd %q escapes the workspace", cwd)
	}

	resolved := filepath.Join(w.Dir, cwd)
	if info, err := os.Stat(resolved); err != nil || !info.IsDir() {
		return "", fmt.Errorf("cwd %q is not a directory in the workspace", cwd)
	}

	return resolved, nil
}

// GiveTo hands the workspace to the account the agent runs as. Everything the
// runner keeps is outside this tree, so owning it grants nothing else.
func (w *Workspace) GiveTo(uid, gid uint32) error {
	// MkdirAll leaves an existing root's mode alone, and a volume or temp
	// directory made elsewhere is usually 0700. Without o+x the agent cannot
	// traverse to its own workspace and exec fails before it starts.
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

// Remove disposes of the directory this package made. Anywhere else a hook
// chose to work, such as a warm cache or a bind mount, is left alone.
func (w *Workspace) Remove() error {
	if w == nil || w.Dir == "" {
		return nil
	}
	return os.RemoveAll(w.Dir)
}
