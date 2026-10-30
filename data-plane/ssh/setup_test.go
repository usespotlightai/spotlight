package ssh

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type setupRun struct {
	home string
	out  bytes.Buffer
	errs bytes.Buffer
	cli  cli
}

func newSetup(t *testing.T, binary string) *setupRun {
	t.Helper()

	run := &setupRun{home: t.TempDir()}
	env := map[string]string{"HOME": run.home, "SPOTLIGHT_CONFIG_DIR": filepath.Join(run.home, "spotlight")}
	run.cli = cli{
		env:    func(key string) string { return env[key] },
		out:    &run.out,
		errs:   &run.errs,
		binary: func() (string, error) { return binary, nil },
	}

	return run
}

func (r *setupRun) run(t *testing.T, args ...string) {
	t.Helper()
	r.out.Reset()
	r.errs.Reset()
	if code := r.cli.main(context.Background(), append([]string{"setup"}, args...)); code != 0 {
		t.Fatalf("setup exited %d: %s", code, r.errs.String())
	}
}

func (r *setupRun) read(t *testing.T, path ...string) string {
	t.Helper()
	content, err := os.ReadFile(filepath.Join(append([]string{r.home, ".ssh"}, path...)...))
	if err != nil {
		t.Fatal(err)
	}

	return string(content)
}

func mode(t *testing.T, path string) os.FileMode {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}

	return info.Mode().Perm()
}

func TestSetupWritesTheHostBlockAndCreatesTheConfig(t *testing.T) {
	setup := newSetup(t, "/usr/local/bin/spotlight")
	setup.run(t)

	managed := setup.read(t, "spotlight", "config")
	for _, want := range []string{
		"Host *.spotlight\n",
		"  ProxyCommand /usr/local/bin/spotlight ssh proxy --url https://app.usespotlight.ai %h\n",
		"  StrictHostKeyChecking no\n",
		"  UserKnownHostsFile /dev/null\n",
		"  User spotlight\n",
		"  ServerAliveInterval 30\n",
	} {
		if !strings.Contains(managed, want) {
			t.Errorf("managed config\n%s\nwant %q", managed, want)
		}
	}
	if got := setup.read(t, "config"); got != includeLine+"\n" {
		t.Errorf("~/.ssh/config = %q", got)
	}
	if got := mode(t, filepath.Join(setup.home, ".ssh", "config")); got != 0o600 {
		t.Errorf("~/.ssh/config mode %o, want 600", got)
	}
	if got := mode(t, filepath.Join(setup.home, ".ssh", "spotlight", "config")); got != 0o600 {
		t.Errorf("managed config mode %o, want 600", got)
	}
	for _, dir := range []string{".ssh", ".ssh/spotlight"} {
		if got := mode(t, filepath.Join(setup.home, dir)); got != 0o700 {
			t.Errorf("%s mode %o, want 700", dir, got)
		}
	}
	if !strings.Contains(setup.out.String(), "There is no login for https://app.usespotlight.ai. Run: spotlight login") {
		t.Errorf("printed\n%s\nwant it to ask for a login", setup.out.String())
	}
}

func TestSetupPutsTheIncludeAboveTheFirstHostAndKeepsTheRest(t *testing.T) {
	setup := newSetup(t, "/usr/local/bin/spotlight")
	user := "# mine\nAddKeysToAgent yes\n\nHost github.com\n  User git\n"
	if err := os.MkdirAll(filepath.Join(setup.home, ".ssh"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(setup.home, ".ssh", "config"), []byte(user), 0o644); err != nil {
		t.Fatal(err)
	}

	setup.run(t)

	if got := setup.read(t, "config"); got != includeLine+"\n\n"+user {
		t.Errorf("~/.ssh/config =\n%s", got)
	}
	if got := mode(t, filepath.Join(setup.home, ".ssh", "config")); got != 0o644 {
		t.Errorf("~/.ssh/config mode %o, want the person's 644 kept", got)
	}
}

func TestSetupTwiceChangesNothing(t *testing.T) {
	setup := newSetup(t, "/usr/local/bin/spotlight")
	setup.run(t)
	first, managed := setup.read(t, "config"), setup.read(t, "spotlight", "config")

	setup.run(t)

	if setup.read(t, "config") != first || setup.read(t, "spotlight", "config") != managed {
		t.Fatal("the second setup changed a file")
	}
	for _, want := range []string{"~/.ssh/spotlight/config is current.", "~/.ssh/config includes ~/.ssh/spotlight/config."} {
		if !strings.Contains(setup.out.String(), want) {
			t.Errorf("printed\n%s\nwant %q", setup.out.String(), want)
		}
	}
}

func TestSetupMovesAnIncludeThatAHostBlockHides(t *testing.T) {
	config := "Host github.com\n  User git\nInclude ~/.ssh/spotlight/config\n"

	got, changed := withInclude(config, "/home/me/.ssh/spotlight/config")

	if !changed || got != includeLine+"\n\nHost github.com\n  User git\n" {
		t.Errorf("withInclude = %q, %v", got, changed)
	}
}

func TestSetupKeepsAGlobalIncludeOfTheAbsolutePath(t *testing.T) {
	config := "Include /home/me/.ssh/spotlight/config\nHost *\n  User me\n"

	if got, changed := withInclude(config, "/home/me/.ssh/spotlight/config"); changed || got != config {
		t.Errorf("withInclude = %q, %v", got, changed)
	}
}

func TestSetupWritesThroughASymlinkedConfig(t *testing.T) {
	setup := newSetup(t, "/usr/local/bin/spotlight")
	dotfiles := filepath.Join(setup.home, "dotfiles-ssh-config")
	if err := os.WriteFile(dotfiles, []byte("Host *\n  User me\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(setup.home, ".ssh"), 0o700); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(setup.home, ".ssh", "config")
	if err := os.Symlink(dotfiles, link); err != nil {
		t.Fatal(err)
	}

	setup.run(t)

	if info, err := os.Lstat(link); err != nil || info.Mode()&os.ModeSymlink == 0 {
		t.Fatalf("~/.ssh/config is no longer a symlink: %v", err)
	}
	if content, _ := os.ReadFile(dotfiles); !strings.HasPrefix(string(content), includeLine+"\n") {
		t.Errorf("the linked file =\n%s", content)
	}
}

func TestSetupQuotesABinaryPathWithSpaces(t *testing.T) {
	managed := managedConfig("/Users/me/My Tools/spotlight", "http://localhost:3000")

	if !strings.Contains(managed, "  ProxyCommand '/Users/me/My Tools/spotlight' ssh proxy --url http://localhost:3000 %h\n") {
		t.Errorf("managed config\n%s", managed)
	}
}

func TestSetupPrintWritesNothing(t *testing.T) {
	setup := newSetup(t, "/usr/local/bin/spotlight")
	setup.run(t, "--print", "--url", "http://localhost:3000")

	if _, err := os.Stat(filepath.Join(setup.home, ".ssh")); !os.IsNotExist(err) {
		t.Errorf("--print made ~/.ssh: %v", err)
	}
	for _, want := range []string{"ProxyCommand /usr/local/bin/spotlight ssh proxy --url http://localhost:3000 %h", includeLine} {
		if !strings.Contains(setup.out.String(), want) {
			t.Errorf("printed\n%s\nwant %q", setup.out.String(), want)
		}
	}
}
