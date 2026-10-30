package ssh

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/console"
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
		system: "linux",
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
	if !strings.Contains(setup.out.String(), "! There is no login for https://app.usespotlight.ai.\n      spotlight login\n") {
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
	for _, want := range []string{"ProxyCommand /usr/local/bin/spotlight ssh proxy --url http://localhost:3000 %h", includeLine, `"remote.SSH.connectTimeout": 600`} {
		if !strings.Contains(setup.out.String(), want) {
			t.Errorf("printed\n%s\nwant %q", setup.out.String(), want)
		}
	}
}

func (r *setupRun) login(t *testing.T, logins map[string]string) {
	t.Helper()
	entries := map[string]any{}
	for address, user := range logins {
		entries[address] = map[string]string{"token": "tok", "user": user}
	}
	content, _ := json.Marshal(map[string]any{"logins": entries})
	if err := os.MkdirAll(filepath.Join(r.home, "spotlight"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(r.home, "spotlight", "credentials.json"), content, 0o600); err != nil {
		t.Fatal(err)
	}
}

func (r *setupRun) editor(t *testing.T, dir, settings string) string {
	t.Helper()
	user := filepath.Join(r.home, ".config", dir, "User")
	if err := os.MkdirAll(user, 0o700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(user, "settings.json")
	if settings != "" {
		if err := os.WriteFile(path, []byte(settings), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	return path
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	return string(content)
}

func TestSetupReportsEachCheckAndTheNextStep(t *testing.T) {
	setup := newSetup(t, "/usr/local/bin/spotlight")
	setup.login(t, map[string]string{"https://staging.example.com": "me@example.com"})
	setup.editor(t, "Code", "{\n  \"remote.SSH.connectTimeout\": 600\n}\n")
	setup.editor(t, "Cursor", "")

	setup.run(t, "--no-editor-timeout")

	want := `Spotlight SSH
  Address  https://staging.example.com
  Binary   /usr/local/bin/spotlight
  Hosts    *.spotlight

Checks
  ✓ Wrote ~/.ssh/spotlight/config.
  ✓ Added Include ~/.ssh/spotlight/config to the top of ~/.ssh/config.
  ✓ Logged in to https://staging.example.com as me@example.com.
  ✓ VS Code waits 600 seconds for a connection.
  ! Cursor uses its default connect timeout. A stopped sandbox can take minutes to start, so the first connection can fail.
      add "remote.SSH.connectTimeout": 600 to ~/.config/Cursor/User/settings.json, or run: spotlight ssh setup --editor-timeout

Next
  Open a task in VS Code or Cursor from Spotlight, or run: ssh task-<id>.<workspace>.spotlight
`
	if got := setup.out.String(); got != want {
		t.Errorf("printed\n%s\nwant\n%s", got, want)
	}
	if _, err := os.Stat(filepath.Join(setup.home, ".config", "Cursor", "User", "settings.json")); !os.IsNotExist(err) {
		t.Errorf("--no-editor-timeout wrote the Cursor settings: %v", err)
	}
}

func TestSetupUsesTheOneLoginWhenNoAddressIsGiven(t *testing.T) {
	setup := newSetup(t, "/usr/local/bin/spotlight")
	setup.login(t, map[string]string{"https://staging.example.com": "me@example.com"})

	setup.run(t)

	if managed := setup.read(t, "spotlight", "config"); !strings.Contains(managed, "--url https://staging.example.com %h") {
		t.Errorf("managed config\n%s", managed)
	}
}

func TestSetupAsksForAnAddressWhenThereAreSeveralLogins(t *testing.T) {
	setup := newSetup(t, "/usr/local/bin/spotlight")
	setup.login(t, map[string]string{"https://staging.example.com": "me@example.com", "https://app.usespotlight.ai": "me@example.com"})

	if code := setup.cli.main(context.Background(), []string{"setup"}); code != 1 {
		t.Fatalf("setup exited %d, want 1", code)
	}
	if got := setup.errs.String(); !strings.Contains(got, "https://app.usespotlight.ai, https://staging.example.com. Say which one with --url") {
		t.Errorf("stderr = %q", got)
	}
	if _, err := os.Stat(filepath.Join(setup.home, ".ssh")); !os.IsNotExist(err) {
		t.Errorf("setup wrote ~/.ssh: %v", err)
	}

	setup.run(t, "--url", "https://staging.example.com")
}

func TestSetupSetsTheEditorTimeoutAndKeepsTheComments(t *testing.T) {
	setup := newSetup(t, "/usr/local/bin/spotlight")
	settings := "{\n  // font\n  \"editor.fontSize\": 13,\n  \"remote.SSH.connectTimeout\": 15, // short\n}\n"
	path := setup.editor(t, "Code", settings)

	setup.run(t, "--editor-timeout")

	want := "{\n  // font\n  \"editor.fontSize\": 13,\n  \"remote.SSH.connectTimeout\": 600, // short\n}\n"
	if got := readFile(t, path); got != want {
		t.Errorf("settings =\n%s\nwant\n%s", got, want)
	}
	if !strings.Contains(setup.out.String(), "✓ Set remote.SSH.connectTimeout to 600 in ~/.config/Code/User/settings.json.") {
		t.Errorf("printed\n%s", setup.out.String())
	}

	setup.run(t, "--editor-timeout")

	if got := readFile(t, path); got != want {
		t.Errorf("the second setup changed the settings:\n%s", got)
	}
	if !strings.Contains(setup.out.String(), "✓ VS Code waits 600 seconds for a connection.") {
		t.Errorf("printed\n%s", setup.out.String())
	}
}

func TestSetupAsksBeforeItChangesTheEditorSettings(t *testing.T) {
	for answer, changed := range map[string]bool{"y\n": true, "yes\n": true, "n\n": false, "\n": false} {
		setup := newSetup(t, "/usr/local/bin/spotlight")
		path := setup.editor(t, "Cursor", "{}\n")
		var asked bytes.Buffer
		setup.cli.terminal = func() *console.Terminal { return console.New(strings.NewReader(answer), &asked) }

		setup.run(t)

		if !strings.Contains(asked.String(), "Set remote.SSH.connectTimeout to 600 in ~/.config/Cursor/User/settings.json? (y/N)") {
			t.Errorf("asked %q", asked.String())
		}
		if got := strings.Contains(readFile(t, path), timeoutSetting); got != changed {
			t.Errorf("answer %q: changed = %v, want %v", answer, got, changed)
		}
	}
}

func TestSetupFindsTheEditorsOfEachSystem(t *testing.T) {
	home := t.TempDir()
	for _, dir := range []string{
		"Library/Application Support/Code/User",
		"Library/Application Support/Cursor/User",
		"xdg/Cursor/User",
		"AppData/Roaming/Code/User",
	} {
		if err := os.MkdirAll(filepath.Join(home, dir), 0o700); err != nil {
			t.Fatal(err)
		}
	}

	for _, each := range []struct {
		system string
		env    map[string]string
		want   []string
	}{
		{"darwin", map[string]string{"HOME": home}, []string{
			"VS Code " + filepath.Join(home, "Library/Application Support/Code/User/settings.json"),
			"Cursor " + filepath.Join(home, "Library/Application Support/Cursor/User/settings.json"),
		}},
		{"linux", map[string]string{"HOME": home, "XDG_CONFIG_HOME": filepath.Join(home, "xdg")}, []string{
			"Cursor " + filepath.Join(home, "xdg/Cursor/User/settings.json"),
		}},
		{"linux", map[string]string{"HOME": home}, nil},
		{"windows", map[string]string{"APPDATA": filepath.Join(home, "AppData", "Roaming")}, []string{
			"VS Code " + filepath.Join(home, "AppData/Roaming/Code/User/settings.json"),
		}},
	} {
		var got []string
		for _, found := range editors(each.system, func(key string) string { return each.env[key] }) {
			got = append(got, found.name+" "+found.settings)
		}
		if strings.Join(got, "\n") != strings.Join(each.want, "\n") {
			t.Errorf("%s %v: found %q, want %q", each.system, each.env, got, each.want)
		}
	}
}
