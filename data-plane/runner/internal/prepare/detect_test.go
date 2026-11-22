package prepare_test

import (
	"context"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/runner/internal/prepare"
)

func detected(t *testing.T, files map[string]string) []prepare.SetupStep {
	t.Helper()

	tree := t.TempDir()
	git(t, tree, "init", "--quiet")
	for name, content := range files {
		write(t, filepath.Join(tree, filepath.FromSlash(name)), content)
	}

	steps, err := prepare.DetectSetup(context.Background(), tree)
	if err != nil {
		t.Fatal(err)
	}
	return steps
}

func TestDetectSetupInstallsEachLockfileWithItsManager(t *testing.T) {
	cases := map[string]string{
		"pnpm-lock.yaml":      "pnpm install --frozen-lockfile",
		"package-lock.json":   "npm ci",
		"npm-shrinkwrap.json": "npm ci",
		"uv.lock":             "uv sync --frozen",
		"poetry.lock":         "poetry install --no-root",
		"requirements.txt":    "pip install -r requirements.txt",
		"go.sum":              "go mod download",
		"bun.lock":            "bun install --frozen-lockfile",
		"bun.lockb":           "bun install --frozen-lockfile",
		"Cargo.lock":          "cargo fetch --locked",
		"Gemfile.lock":        "bundle install",
		"composer.lock":       "composer install --no-interaction",
	}

	for lockfile, command := range cases {
		steps := detected(t, map[string]string{lockfile: "x"})

		if len(steps) != 1 || steps[0].Command != command || steps[0].Dir != "." || steps[0].From != lockfile {
			t.Errorf("%s: got %+v, want %q at the root", lockfile, steps, command)
		}
	}
}

func TestDetectSetupTellsYarnOneFromLaterYarns(t *testing.T) {
	classic := detected(t, map[string]string{"yarn.lock": "x", "package.json": `{"name":"web"}`})
	pinned := detected(t, map[string]string{"yarn.lock": "x", "package.json": `{"packageManager":"yarn@4.5.0"}`})
	configured := detected(t, map[string]string{"yarn.lock": "x", ".yarnrc.yml": "nodeLinker: node-modules\n"})

	if classic[0].Command != "yarn install --frozen-lockfile" {
		t.Errorf("Yarn 1: got %q", classic[0].Command)
	}
	if pinned[0].Command != "yarn install --immutable" || configured[0].Command != "yarn install --immutable" {
		t.Errorf("Yarn 2 and later: got %q and %q", pinned[0].Command, configured[0].Command)
	}
}

func TestDetectSetupPrefersOneLockfileOfAnEcosystemInADirectory(t *testing.T) {
	steps := detected(t, map[string]string{
		"package-lock.json": "x", "pnpm-lock.yaml": "x", "requirements.txt": "x", "uv.lock": "x",
	})

	commands := []string{steps[0].Command, steps[1].Command}
	slices.Sort(commands)
	if len(steps) != 2 || !slices.Equal(commands, []string{"pnpm install --frozen-lockfile", "uv sync --frozen"}) {
		t.Errorf("got %+v, want pnpm and uv only", steps)
	}
}

func TestDetectSetupGivesEachIndependentProjectOfAMonorepoItsOwnStep(t *testing.T) {
	steps := detected(t, map[string]string{
		"pnpm-lock.yaml":      "x",
		"api/uv.lock":         "x",
		"worker/go.sum":       "x",
		"tools/cli/yarn.lock": "x",
	})

	want := []prepare.SetupStep{
		{Dir: ".", Command: "pnpm install --frozen-lockfile", From: "pnpm-lock.yaml"},
		{Dir: "api", Command: "uv sync --frozen", From: "api/uv.lock"},
		{Dir: "tools/cli", Command: "yarn install --frozen-lockfile", From: "tools/cli/yarn.lock"},
		{Dir: "worker", Command: "go mod download", From: "worker/go.sum"},
	}
	if !slices.Equal(steps, want) {
		t.Errorf("got %+v, want %+v", steps, want)
	}
}

func TestDetectSetupLetsAWorkspaceRootInstallTheProjectsUnderIt(t *testing.T) {
	pnpm := detected(t, map[string]string{
		"pnpm-lock.yaml": "x", "pnpm-workspace.yaml": "packages: [apps/*]\n", "apps/web/pnpm-lock.yaml": "x",
	})
	npm := detected(t, map[string]string{
		"package-lock.json": "x", "package.json": `{"workspaces":["apps/*"]}`, "apps/web/package-lock.json": "x",
	})
	uv := detected(t, map[string]string{
		"uv.lock": "x", "pyproject.toml": "[tool.uv.workspace]\nmembers = [\"api\"]\n", "api/uv.lock": "x",
	})
	golang := detected(t, map[string]string{"go.work": "go 1.24\n", "svc/go.sum": "x"})
	cargo := detected(t, map[string]string{
		"Cargo.lock": "x", "Cargo.toml": "[workspace]\nmembers = [\"crates/*\"]\n", "crates/cli/Cargo.lock": "x",
	})

	for name, steps := range map[string][]prepare.SetupStep{"pnpm": pnpm, "npm": npm, "uv": uv, "cargo": cargo} {
		if len(steps) != 1 || steps[0].Dir != "." {
			t.Errorf("%s: got %+v, want the workspace root only", name, steps)
		}
	}
	if len(golang) != 1 || golang[0].Dir != "." || golang[0].Command != "go mod download" {
		t.Errorf("go.work: got %+v, want one download at the workspace root", golang)
	}
}

func TestDetectSetupKeepsAProjectNoWorkspaceCovers(t *testing.T) {
	steps := detected(t, map[string]string{
		"package-lock.json": "x", "package.json": `{"name":"root"}`, "site/package-lock.json": "x",
	})

	if len(steps) != 2 {
		t.Errorf("got %+v, want the root and site/ apart", steps)
	}
}

func TestDetectSetupSkipsIgnoredFilesExamplesAndFixtures(t *testing.T) {
	steps := detected(t, map[string]string{
		".gitignore":                           "build/\n",
		"go.sum":                               "x",
		"build/package-lock.json":              "x",
		"examples/demo/package-lock.json":      "x",
		"internal/testdata/poetry.lock":        "x",
		"web/node_modules/x/package-lock.json": "x",
		"src/__fixtures__/app/yarn.lock":       "x",
	})

	if len(steps) != 1 || steps[0].From != "go.sum" {
		t.Errorf("got %+v, want go.sum only", steps)
	}
}

func TestDetectSetupFindsNothingWithoutALockfile(t *testing.T) {
	if steps := detected(t, map[string]string{"README.md": "hello"}); len(steps) != 0 {
		t.Errorf("got %+v, want no steps", steps)
	}
}

func TestDescribeNamesEachStepAndWhereItRuns(t *testing.T) {
	got := prepare.Describe([]prepare.SetupStep{
		{Dir: ".", Command: "pnpm install --frozen-lockfile"},
		{Dir: "api", Command: "uv sync --frozen"},
	})

	if want := "`pnpm install --frozen-lockfile` at the root · `uv sync --frozen` in api/"; got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestSetupAllRunsEveryStepAndNamesTheOnesThatFailed(t *testing.T) {
	tree := t.TempDir()
	write(t, filepath.Join(tree, "web", "package.json"), "{}")
	write(t, filepath.Join(tree, "api", "uv.lock"), "")

	output, err := prepare.SetupAll(context.Background(), tree, []prepare.SetupStep{
		{Dir: "web", Command: "echo installed web"},
		{Dir: "api", Command: "echo broken api; exit 3"},
	}, nil, time.Minute, nil)

	if err == nil || !strings.Contains(err.Error(), "setup failed in api/ (`echo broken api; exit 3`)") {
		t.Fatalf("error %v, want the api step named", err)
	}
	for _, part := range []string{
		"== `echo installed web` in web/ · done in", "installed web",
		"== `echo broken api; exit 3` in api/ · failed in", "broken api",
	} {
		if !strings.Contains(output, part) {
			t.Errorf("output %q lacks %q", output, part)
		}
	}
}
