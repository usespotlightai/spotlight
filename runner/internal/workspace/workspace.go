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

// Create makes the directory a run works in. Runs told to share a key find
// what the last one left, which is what carrying a conversation on requires.
func Create(root, key string) (*Workspace, error) {
	// Traversable but not listable: an agent reaches its own workspace without
	// enumerating anyone else's.
	if err := os.MkdirAll(root, 0o711); err != nil {
		return nil, fmt.Errorf("create workspace root: %w", err)
	}

	dir := filepath.Join(root, key)
	if err := os.Mkdir(dir, 0o700); err != nil && !os.IsExist(err) {
		return nil, fmt.Errorf("create workspace: %w", err)
	}

	return &Workspace{Dir: dir}, nil
}

// StatePath is where a harness keeps what it needs between runs. It sits in
// the workspace rather than the machine's home directory, so that what
// survives the run survives with the workspace, and travels with it.
const StatePath = ".spotlight/state"

// State makes that directory and answers with it. Called before the workspace
// is handed over, so the agent comes to own it along with everything else.
func (w *Workspace) State() (string, error) {
	dir := filepath.Join(w.Dir, StatePath)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("create state directory: %w", err)
	}

	return dir, nil
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
