package editorservers

import (
	"os"
	"path/filepath"
	"testing"
)

func write(t *testing.T, path, body string, mode os.FileMode) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), mode); err != nil {
		t.Fatal(err)
	}
}

func read(t *testing.T, path string) string {
	t.Helper()
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(body)
}

func TestSeedsAHomeWithTheReleasesTheHostKeeps(t *testing.T) {
	cache, home := t.TempDir(), t.TempDir()
	write(t, filepath.Join(cache, ".vscode-server/cli/servers/Stable-abc/server/bin/code-server"), "server", 0o755)
	write(t, filepath.Join(cache, ".vscode-server/code-abc"), "cli", 0o755)

	if err := Share(cache, home, nil); err != nil {
		t.Fatal(err)
	}

	if got := read(t, filepath.Join(home, ".vscode-server/cli/servers/Stable-abc/server/bin/code-server")); got != "server" {
		t.Errorf("server: %q", got)
	}
	info, err := os.Stat(filepath.Join(home, ".vscode-server/code-abc"))
	if err != nil || info.Mode().Perm() != 0o755 {
		t.Errorf("cli: %v, %v", info, err)
	}
}

func TestKeepsOnlyTheReleasesOfAHomeAndNotItsState(t *testing.T) {
	cache, home := t.TempDir(), t.TempDir()
	write(t, filepath.Join(home, ".vscode-server/cli/servers/Stable-def/server/bin/code-server"), "server", 0o755)
	write(t, filepath.Join(home, ".vscode-server/cli/servers/Stable-def/pid.txt"), "42", 0o644)
	write(t, filepath.Join(home, ".vscode-server/data/Machine/settings.json"), "{}", 0o644)
	write(t, filepath.Join(home, ".cursor-server/bin/0123/node"), "node", 0o755)
	if err := os.Symlink("bin/code-server", filepath.Join(home, ".vscode-server/cli/servers/Stable-def/server/code")); err != nil {
		t.Fatal(err)
	}

	if err := Share(cache, home, nil); err != nil {
		t.Fatal(err)
	}

	if got := read(t, filepath.Join(cache, ".vscode-server/cli/servers/Stable-def/server/bin/code-server")); got != "server" {
		t.Errorf("server: %q", got)
	}
	if link, err := os.Readlink(filepath.Join(cache, ".vscode-server/cli/servers/Stable-def/server/code")); err != nil || link != "bin/code-server" {
		t.Errorf("link: %q, %v", link, err)
	}
	if got := read(t, filepath.Join(cache, ".cursor-server/bin/0123/node")); got != "node" {
		t.Errorf("cursor: %q", got)
	}
	for _, kept := range []string{".vscode-server/cli/servers/Stable-def/pid.txt", ".vscode-server/data"} {
		if _, err := os.Stat(filepath.Join(cache, kept)); err == nil {
			t.Errorf("shared %s", kept)
		}
	}
}

func TestLeavesAReleaseThatIsAlreadyThere(t *testing.T) {
	cache, home := t.TempDir(), t.TempDir()
	write(t, filepath.Join(cache, ".vscode-server/code-abc"), "cached", 0o755)
	write(t, filepath.Join(home, ".vscode-server/code-abc"), "own", 0o755)

	if err := Share(cache, home, nil); err != nil {
		t.Fatal(err)
	}

	if got := read(t, filepath.Join(home, ".vscode-server/code-abc")); got != "own" {
		t.Errorf("home: %q", got)
	}
	if got := read(t, filepath.Join(cache, ".vscode-server/code-abc")); got != "cached" {
		t.Errorf("cache: %q", got)
	}
}

func TestDoesNothingWithoutTheHostsFolder(t *testing.T) {
	home := t.TempDir()
	if err := Share(filepath.Join(t.TempDir(), "missing"), home, nil); err != nil {
		t.Fatal(err)
	}
	if entries, _ := os.ReadDir(home); len(entries) != 0 {
		t.Errorf("made %v", entries)
	}
}

func TestNeverFollowsALinkOutOfAHome(t *testing.T) {
	cache, home, outside := t.TempDir(), t.TempDir(), t.TempDir()
	write(t, filepath.Join(cache, ".vscode-server/bin/planted"), "planted", 0o755)
	write(t, filepath.Join(cache, ".cursor-server/cursor-abc"), "planted", 0o755)
	write(t, filepath.Join(outside, "secret"), "secret", 0o600)
	if err := os.MkdirAll(filepath.Join(home, ".vscode-server"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(home, ".vscode-server/bin")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(home, ".cursor-server")); err != nil {
		t.Fatal(err)
	}

	_ = Share(cache, home, nil)

	for _, planted := range []string{"planted", "cursor-abc"} {
		if _, err := os.Lstat(filepath.Join(outside, planted)); err == nil {
			t.Errorf("wrote %s outside the home", planted)
		}
	}
	if _, err := os.Lstat(filepath.Join(cache, ".vscode-server/bin/secret")); err == nil {
		t.Error("copied a file from outside the home into the cache")
	}
}
