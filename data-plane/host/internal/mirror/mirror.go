package mirror

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"
)

var plainName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)

type Mirrors struct {
	root string

	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

func At(root string) *Mirrors {
	return &Mirrors{root: root, locks: map[string]*sync.Mutex{}}
}

type Fetch struct {
	Workspace  string
	Repository string
	Remote     string
	Token      string
}

func (m *Mirrors) Dir(workspace, repository string) (string, bool) {
	if !plainName.MatchString(workspace) || !plainName.MatchString(repository) {
		return "", false
	}

	dir := filepath.Join(m.root, workspace, repository+".git")
	if _, err := os.Stat(filepath.Join(dir, "objects")); err != nil {
		return dir, false
	}

	return dir, true
}

func (m *Mirrors) Refresh(ctx context.Context, fetch Fetch) (string, error) {
	if !plainName.MatchString(fetch.Workspace) || !plainName.MatchString(fetch.Repository) {
		return "", fmt.Errorf("mirror %s/%s: not a name a mirror can be stored under", fetch.Workspace, fetch.Repository)
	}

	key := fetch.Workspace + "/" + fetch.Repository
	lock := m.lock(key)
	lock.Lock()
	defer lock.Unlock()

	dir := filepath.Join(m.root, fetch.Workspace, fetch.Repository+".git")
	if _, err := os.Stat(filepath.Join(dir, "objects")); err == nil {
		return dir, m.fetch(ctx, dir, fetch)
	}

	if err := os.MkdirAll(filepath.Dir(dir), 0o755); err != nil {
		return "", fmt.Errorf("mirror %s: %w", key, err)
	}

	// Clone into a temporary directory first. Then move the clone into place, so no sandbox mounts half a mirror.
	aside, err := os.MkdirTemp(filepath.Dir(dir), "."+fetch.Repository+"-")
	if err != nil {
		return "", fmt.Errorf("mirror %s: %w", key, err)
	}
	defer os.RemoveAll(aside)

	if out, err := git(ctx, nil, "init", "--bare", "--quiet", aside); err != nil {
		return "", fmt.Errorf("mirror %s: git init: %w: %s", key, err, out)
	}
	if err := m.fetch(ctx, aside, fetch); err != nil {
		return "", err
	}
	if err := os.Chmod(aside, 0o755); err != nil {
		return "", fmt.Errorf("mirror %s: %w", key, err)
	}
	if err := os.Rename(aside, dir); err != nil {
		return "", fmt.Errorf("mirror %s: %w", key, err)
	}

	return dir, nil
}

func (m *Mirrors) fetch(ctx context.Context, dir string, fetch Fetch) error {
	// Put the one-run credential in the environment, not in argv. Any process can read argv.
	env := []string{
		"GIT_CONFIG_COUNT=1",
		"GIT_CONFIG_KEY_0=http.extraHeader",
		"GIT_CONFIG_VALUE_0=Authorization: Bearer " + fetch.Token,
	}

	out, err := git(ctx, env, "--git-dir", dir, "fetch", "--quiet", "--prune", "--no-tags",
		fetch.Remote, "+refs/heads/*:refs/heads/*")
	if err != nil {
		return fmt.Errorf("mirror %s/%s: git fetch: %w: %s", fetch.Workspace, fetch.Repository, err, out)
	}

	return nil
}

// Tidy must run only when no host serves from the mirrors. A git process that still runs will lose its locks.
func (m *Mirrors) Tidy() error {
	workspaces, err := os.ReadDir(m.root)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}

	var problems []error
	for _, workspace := range workspaces {
		dir := filepath.Join(m.root, workspace.Name())
		entries, err := os.ReadDir(dir)
		if err != nil {
			problems = append(problems, err)
			continue
		}

		for _, each := range entries {
			path := filepath.Join(dir, each.Name())
			if strings.HasPrefix(each.Name(), ".") {
				problems = append(problems, os.RemoveAll(path))
				continue
			}

			problems = append(problems, filepath.WalkDir(path, func(file string, entry os.DirEntry, err error) error {
				if err == nil && !entry.IsDir() && strings.HasSuffix(file, ".lock") {
					return os.Remove(file)
				}
				return err
			}))
		}
	}

	return errors.Join(problems...)
}

func (m *Mirrors) lock(key string) *sync.Mutex {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.locks[key] == nil {
		m.locks[key] = &sync.Mutex{}
	}

	return m.locks[key]
}

func git(ctx context.Context, env []string, args ...string) (string, error) {
	command := exec.CommandContext(ctx, "git", args...)
	command.Cancel = func() error { return command.Process.Signal(syscall.SIGTERM) }
	command.WaitDelay = 10 * time.Second
	command.Env = append(os.Environ(), append([]string{"GIT_TERMINAL_PROMPT=0"}, env...)...)

	out, err := command.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}
