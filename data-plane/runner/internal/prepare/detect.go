package prepare

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/shell"
)

// SetupStep is one install that a checkout needs, found from a lockfile where the line names no setup.
type SetupStep struct {
	// Dir is where the command runs, relative to the checkout: "." for its root.
	Dir string
	// Command installs the dependencies the lockfile pins.
	Command string
	// From is the lockfile the step was found from, relative to the checkout.
	From string
}

type ecosystem string

const (
	javascript ecosystem = "javascript"
	python     ecosystem = "python"
	golang     ecosystem = "go"
	rust       ecosystem = "rust"
	ruby       ecosystem = "ruby"
	php        ecosystem = "php"
)

// lockfiles lists, for each ecosystem, the files a step is found from, the preferred first: a directory with two
// of one ecosystem's lockfiles installs with the first.
var lockfiles = map[ecosystem][]string{
	javascript: {"pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "package-lock.json", "npm-shrinkwrap.json"},
	python:     {"uv.lock", "poetry.lock", "requirements.txt"},
	golang:     {"go.work", "go.sum"},
	rust:       {"Cargo.lock"},
	ruby:       {"Gemfile.lock"},
	php:        {"composer.lock"},
}

// skippedDirs are directories detection never looks in: installed dependencies, and examples and fixtures that
// nobody installs to work on the repository.
var skippedDirs = []string{
	"node_modules", "vendor", ".git", "examples", "example", "fixtures", "fixture", "__fixtures__", "testdata",
}

// DetectSetup finds the installs a checkout needs from its lockfiles, one step per independent project. A
// workspace root (pnpm, Yarn or npm workspaces, a uv workspace, go.work, a Cargo workspace) covers every project of its ecosystem
// under it, which gets no step of its own. Files git ignores are not looked at.
func DetectSetup(ctx context.Context, tree string) ([]SetupStep, error) {
	files, err := listedFiles(ctx, tree)
	if err != nil {
		return nil, err
	}

	found := map[string]map[ecosystem]string{}
	for _, name := range files {
		dir, base := path.Dir(name), path.Base(name)
		if skipped(dir) {
			continue
		}
		for kind, names := range lockfiles {
			at := slices.Index(names, base)
			if at < 0 {
				continue
			}
			if found[dir] == nil {
				found[dir] = map[ecosystem]string{}
			}
			if chosen, ok := found[dir][kind]; !ok || at < slices.Index(names, path.Base(chosen)) {
				found[dir][kind] = name
			}
		}
	}

	var steps []SetupStep
	for dir, kinds := range found {
		for kind, lockfile := range kinds {
			if coveredByWorkspace(tree, dir, kind, found) {
				continue
			}
			steps = append(steps, SetupStep{Dir: dir, Command: commandFor(tree, dir, lockfile), From: lockfile})
		}
	}

	slices.SortFunc(steps, func(a, b SetupStep) int {
		if a.Dir != b.Dir {
			return strings.Compare(a.Dir, b.Dir)
		}
		return strings.Compare(a.From, b.From)
	})
	return steps, nil
}

// Describe names the steps for a person, as "`npm ci` at the root · `uv sync --frozen` in api/".
func Describe(steps []SetupStep) string {
	parts := make([]string, len(steps))
	for i, step := range steps {
		parts[i] = fmt.Sprintf("`%s` %s", step.Command, where(step.Dir))
	}
	return strings.Join(parts, " · ")
}

func listedFiles(ctx context.Context, tree string) ([]string, error) {
	listed, err := shell.Git(ctx, tree, nil, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
	if err != nil {
		return nil, fmt.Errorf("list the files of %s: %w: %s", tree, err, shell.Tail(listed))
	}

	names := slices.DeleteFunc(strings.Split(listed, "\x00"), func(name string) bool { return name == "" })
	slices.Sort(names)
	return slices.Compact(names), nil
}

func skipped(dir string) bool {
	for segment := range strings.SplitSeq(dir, "/") {
		if slices.Contains(skippedDirs, segment) {
			return true
		}
	}
	return false
}

// coveredByWorkspace says whether a workspace root of the same ecosystem above dir installs it.
func coveredByWorkspace(tree, dir string, kind ecosystem, found map[string]map[ecosystem]string) bool {
	for above := parent(dir); above != ""; above = parent(above) {
		if _, ok := found[above][kind]; ok && workspaceRoot(tree, above, kind) {
			return true
		}
	}
	return false
}

func parent(dir string) string {
	if dir == "." {
		return ""
	}
	return path.Dir(dir)
}

func workspaceRoot(tree, dir string, kind ecosystem) bool {
	at := func(name string) string { return filepath.Join(tree, filepath.FromSlash(dir), name) }

	switch kind {
	case javascript:
		if exists(at("pnpm-workspace.yaml")) {
			return true
		}
		var manifest struct {
			Workspaces json.RawMessage `json:"workspaces"`
		}
		return readJSON(at("package.json"), &manifest) && len(manifest.Workspaces) > 0
	case python:
		content, err := os.ReadFile(at("pyproject.toml"))
		return err == nil && bytes.Contains(content, []byte("[tool.uv.workspace]"))
	case golang:
		return exists(at("go.work"))
	case rust:
		content, err := os.ReadFile(at("Cargo.toml"))
		return err == nil && bytes.Contains(content, []byte("[workspace]"))
	}
	return false
}

func commandFor(tree, dir, lockfile string) string {
	switch path.Base(lockfile) {
	case "pnpm-lock.yaml":
		return "pnpm install --frozen-lockfile"
	case "yarn.lock":
		if berry(tree, dir) {
			return "yarn install --immutable"
		}
		return "yarn install --frozen-lockfile"
	case "bun.lock", "bun.lockb":
		return "bun install --frozen-lockfile"
	case "package-lock.json", "npm-shrinkwrap.json":
		return "npm ci"
	case "uv.lock":
		return "uv sync --frozen"
	case "poetry.lock":
		return "poetry install --no-root"
	case "requirements.txt":
		return "pip install -r requirements.txt"
	case "Cargo.lock":
		return "cargo fetch --locked"
	case "Gemfile.lock":
		return "bundle install"
	case "composer.lock":
		return "composer install --no-interaction"
	default:
		return "go mod download"
	}
}

// berry says whether a Yarn project uses Yarn 2 or later, which takes --immutable instead of --frozen-lockfile.
func berry(tree, dir string) bool {
	at := func(name string) string { return filepath.Join(tree, filepath.FromSlash(dir), name) }

	if exists(at(".yarnrc.yml")) {
		return true
	}
	var manifest struct {
		PackageManager string `json:"packageManager"`
	}
	if !readJSON(at("package.json"), &manifest) {
		return false
	}
	version, ok := strings.CutPrefix(manifest.PackageManager, "yarn@")
	if !ok {
		return false
	}
	major, err := strconv.Atoi(strings.SplitN(version, ".", 2)[0])
	return err == nil && major >= 2
}

func readJSON(name string, into any) bool {
	content, err := os.ReadFile(name)
	return err == nil && json.Unmarshal(content, into) == nil
}

// parallelSteps bounds how many setup steps of one checkout install at once.
const parallelSteps = 4

// SetupAll runs each step in its own directory under tree, at most parallelSteps at once. The output keeps each
// step's in a section of its own, and the error names every step that failed; the others still finish.
func SetupAll(
	ctx context.Context, tree string, steps []SetupStep, as *account.User, timeout time.Duration, env map[string]string,
) (string, error) {
	outputs := make([]string, len(steps))
	failures := make([]error, len(steps))
	slots := make(chan struct{}, parallelSteps)
	var installing sync.WaitGroup
	for i, step := range steps {
		installing.Go(func() {
			slots <- struct{}{}
			defer func() { <-slots }()

			started := time.Now()
			output, err := Setup(ctx, filepath.Join(tree, filepath.FromSlash(step.Dir)), step.Command, as, timeout, env)
			outcome := "done"
			if err != nil {
				outcome = "failed"
				failures[i] = fmt.Errorf("setup failed %s (`%s`): %w", where(step.Dir), step.Command, err)
			}
			outputs[i] = fmt.Sprintf("== `%s` %s · %s in %s ==\n%s",
				step.Command, where(step.Dir), outcome, time.Since(started).Round(time.Second), strings.TrimSpace(output))
		})
	}
	installing.Wait()

	return strings.Join(outputs, "\n\n"), errors.Join(failures...)
}

func where(dir string) string {
	if dir == "." {
		return "at the root"
	}
	return "in " + dir + "/"
}
