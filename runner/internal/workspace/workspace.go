// Package workspace prepares and disposes of the directory a run works in.
//
// The directory is always removed when the run ends. On ephemeral compute that
// is belt and braces, since the sandbox is about to be destroyed; on someone's
// laptop it is the only cleanup there is.
package workspace

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"usespotlight.ai/runner/internal/protocol"
)

type Workspace struct {
	// Dir is the root the checkouts sit beneath.
	Dir string
	// Cwd is where the agent is started, which may be one checkout among
	// several.
	Cwd string
}

// Prepare clones every checkout the run asked for. It cleans up after itself
// if any of them fails, rather than leaving half a workspace behind.
func Prepare(ctx context.Context, root string, run protocol.Run) (*Workspace, error) {
	if len(run.Checkouts) == 0 {
		return nil, fmt.Errorf("run %s has no checkouts", run.ID)
	}

	// The root is traversable but not listable: an agent must be able to reach
	// its own workspace beneath it without being able to enumerate anyone
	// else's. The run's own directory stays private until it is handed over.
	if err := os.MkdirAll(root, 0o711); err != nil {
		return nil, fmt.Errorf("create workspace root: %w", err)
	}

	dir := filepath.Join(root, run.ID)
	if err := os.Mkdir(dir, 0o700); err != nil && !os.IsExist(err) {
		return nil, fmt.Errorf("create workspace: %w", err)
	}

	for _, checkout := range run.Checkouts {
		if err := clone(ctx, dir, checkout); err != nil {
			_ = os.RemoveAll(dir)
			return nil, err
		}
	}

	resolved, err := resolveCwd(dir, run.Cwd, run.Checkouts)
	if err != nil {
		_ = os.RemoveAll(dir)
		return nil, err
	}

	return &Workspace{Dir: dir, Cwd: resolved}, nil
}

// GiveTo hands the workspace to the account the agent runs as. Everything the
// runner keeps for itself — the recording, its own token — is outside this
// tree, so the agent owning it grants nothing else.
func (w *Workspace) GiveTo(uid, gid uint32) error {
	// MkdirAll leaves an existing root's mode alone, and a volume or temp
	// directory made by someone else is usually 0700. Without o+x here the
	// agent cannot traverse to the workspace it owns, and exec fails before
	// the agent ever starts.
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

// Remove disposes of the workspace. Called on every exit path.
func (w *Workspace) Remove() error {
	if w == nil || w.Dir == "" {
		return nil
	}
	return os.RemoveAll(w.Dir)
}

// Diff reports the working tree against the branch point, so the control plane
// can show what changed without anyone parsing terminal output for it.
func (w *Workspace) Diff(ctx context.Context, path string) (string, error) {
	return git(ctx, filepath.Join(w.Dir, path), "status", "--porcelain")
}

func clone(ctx context.Context, dir string, checkout protocol.Checkout) error {
	if checkout.Path == "" || checkout.Remote == "" {
		return fmt.Errorf("checkout needs a remote and a path, got %+v", checkout)
	}
	if !filepath.IsLocal(checkout.Path) {
		return fmt.Errorf("checkout path %q escapes the workspace", checkout.Path)
	}

	into := filepath.Join(dir, checkout.Path)

	if _, err := git(ctx, dir, "clone", checkout.Remote, into); err != nil {
		return fmt.Errorf("clone %s: %w", checkout.Remote, err)
	}

	if checkout.Ref != "" {
		if _, err := git(ctx, into, "checkout", checkout.Ref); err != nil {
			return fmt.Errorf("checkout %s: %w", checkout.Ref, err)
		}
	}

	if checkout.Branch != "" {
		if _, err := git(ctx, into, "switch", "-c", checkout.Branch); err != nil {
			return fmt.Errorf("branch %s: %w", checkout.Branch, err)
		}
	}

	return nil
}

// resolveCwd defaults to the only checkout when the run does not name one,
// which is the common case and saves every caller from spelling it out.
func resolveCwd(dir, cwd string, checkouts []protocol.Checkout) (string, error) {
	if cwd == "" {
		return filepath.Join(dir, checkouts[0].Path), nil
	}
	if !filepath.IsLocal(cwd) {
		return "", fmt.Errorf("cwd %q escapes the workspace", cwd)
	}

	resolved := filepath.Join(dir, cwd)
	if info, err := os.Stat(resolved); err != nil || !info.IsDir() {
		return "", fmt.Errorf("cwd %q is not a directory in the workspace", cwd)
	}

	return resolved, nil
}

func git(ctx context.Context, dir string, args ...string) (string, error) {
	command := exec.CommandContext(ctx, "git", args...)
	command.Dir = dir
	// Nothing authenticates yet: a private remote fails here rather than
	// hanging, until an egress broker holds the credential instead.
	command.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")

	out, err := command.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(string(out)))
	}

	return string(out), nil
}
