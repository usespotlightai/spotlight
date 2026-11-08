package prepare_test

import (
	"context"
	"path/filepath"
	"testing"

	"usespotlight.ai/data-plane/runner/internal/prepare"
)

func TestSetupInputsChangeOnlyWithTheCommandOrADependencyFile(t *testing.T) {
	tree := t.TempDir()
	git(t, tree, "init", "--quiet")
	write(t, filepath.Join(tree, ".gitignore"), "node_modules/\n")
	write(t, filepath.Join(tree, "web", "package.json"), `{"name":"web"}`)
	write(t, filepath.Join(tree, "web", "package-lock.json"), `{"lockfileVersion":3}`)
	write(t, filepath.Join(tree, "web", "src", "app.ts"), "export {}")
	git(t, tree, "add", ".")

	inputs := func(command string) string {
		t.Helper()
		got, err := prepare.SetupInputs(context.Background(), tree, command)
		if err != nil {
			t.Fatal(err)
		}
		return got
	}

	before := inputs("npm ci")

	write(t, filepath.Join(tree, "web", "src", "app.ts"), "export const changed = true")
	write(t, filepath.Join(tree, "web", "node_modules", "left-pad", "package.json"), `{"name":"left-pad"}`)
	if inputs("npm ci") != before {
		t.Error("a source file or an ignored dependency changed the setup inputs")
	}

	if inputs("npm install") == before {
		t.Error("another setup command kept the setup inputs")
	}

	write(t, filepath.Join(tree, "web", "package-lock.json"), `{"lockfileVersion":3,"packages":{}}`)
	changed := inputs("npm ci")
	if changed == before {
		t.Error("a changed lockfile kept the setup inputs")
	}

	write(t, filepath.Join(tree, "api", "go.sum"), "example.com/x v1.0.0 h1:abc=\n")
	if inputs("npm ci") == changed {
		t.Error("a new untracked lockfile kept the setup inputs")
	}
}
