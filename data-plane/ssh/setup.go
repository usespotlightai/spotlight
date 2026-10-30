package ssh

import (
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"text/tabwriter"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/credentials"
)

const (
	managedShown = "~/.ssh/spotlight/config"
	userShown    = "~/.ssh/config"
	includeLine  = "Include " + managedShown
	sshUser      = "spotlight"
)

type check struct {
	level string
	text  string
	fix   string
}

func (c cli) setup(args []string) error {
	var printed, setTimeout, keepTimeout bool
	address, positional, err := c.parse(setupHelp, args, func(set *flag.FlagSet) {
		set.BoolVar(&printed, "print", false, "show the configuration")
		set.BoolVar(&setTimeout, "editor-timeout", false, "set the editor connect timeout")
		set.BoolVar(&keepTimeout, "no-editor-timeout", false, "keep the editor connect timeout")
	})
	if err != nil {
		return err
	}
	if len(positional) > 0 || (setTimeout && keepTimeout) {
		return fmt.Errorf("%s", setupHelp.Synopsis())
	}

	binary, err := c.binary()
	if err != nil {
		return fmt.Errorf("could not find the path of this spotlight binary: %w", err)
	}
	managed := managedConfig(binary, address)

	if printed {
		_, err := fmt.Fprintf(c.out, "# %s\n%s\n# Add to the top of %s\n%s\n\n# Add to the VS Code or Cursor settings\n%s\n", managedShown, managed, userShown, includeLine, timeoutSetting)
		return err
	}

	home := c.env("HOME")
	if home == "" {
		return errors.New("HOME is not set. Set it to the home folder that keeps ~/.ssh")
	}
	dir := filepath.Join(home, ".ssh")

	var checks []check
	wrote, err := writeManaged(filepath.Join(dir, "spotlight", "config"), managed)
	if err != nil {
		return err
	}
	if wrote {
		checks = append(checks, check{level: console.Passed, text: "Wrote " + managedShown + "."})
	} else {
		checks = append(checks, check{level: console.Passed, text: managedShown + " is current."})
	}

	added, err := addInclude(dir, home)
	if err != nil {
		return err
	}
	if added {
		checks = append(checks, check{level: console.Passed, text: "Added " + includeLine + " to the top of " + userShown + "."})
	} else {
		checks = append(checks, check{level: console.Passed, text: userShown + " includes " + managedShown + "."})
	}

	checks = append(checks, c.loginCheck(address))
	checks = append(checks, c.editorChecks(home, setTimeout, keepTimeout)...)

	c.report(address, binary, checks)
	return nil
}

func (c cli) loginCheck(address string) check {
	path, err := credentials.Path(c.env)
	if err != nil {
		return check{level: console.Warned, text: "There is no login for " + address + ".", fix: loginCommand(address)}
	}
	file, err := credentials.Load(path)
	if err != nil {
		return check{level: console.Failed, text: "Sorry, the logins cannot be read: " + err.Error()}
	}
	login, found := file.Login(address)
	switch {
	case !found:
		return check{level: console.Warned, text: "There is no login for " + address + ".", fix: loginCommand(address)}
	case login.User != "":
		return check{level: console.Passed, text: "Logged in to " + address + " as " + login.User + "."}
	default:
		return check{level: console.Passed, text: "Logged in to " + address + "."}
	}
}

func (c cli) editorChecks(home string, setTimeout, keepTimeout bool) []check {
	var tty *console.Terminal
	defer func() {
		if tty != nil {
			tty.Close()
		}
	}()

	var checks []check
	for _, each := range editors(c.system, c.env) {
		state := readEditorTimeout(each)
		shown := homeShown(each.settings, home)
		if state.err != nil {
			checks = append(checks, check{level: console.Failed, text: fmt.Sprintf("Sorry, %s cannot be read: %v.", shown, state.err), fix: "add " + timeoutSetting + " to " + shown})
			continue
		}
		if state.enough() {
			checks = append(checks, check{level: console.Passed, text: state.described()})
			continue
		}

		change := setTimeout
		if !setTimeout && !keepTimeout && c.terminal != nil {
			if tty == nil {
				tty = c.terminal()
			}
			if tty != nil {
				change = tty.Confirm(fmt.Sprintf("%s A stopped sandbox can take minutes to start. Set %s to %d in %s?", state.described(), timeoutKey, editorTimeout, shown))
			}
		}

		if change {
			if err := writeEditorTimeout(each); err != nil {
				checks = append(checks, check{level: console.Failed, text: fmt.Sprintf("Sorry, %s cannot be changed: %v.", shown, err), fix: "add " + timeoutSetting + " to " + shown})
				continue
			}
			checks = append(checks, check{level: console.Passed, text: fmt.Sprintf("Set %s to %d in %s.", timeoutKey, editorTimeout, shown)})
			continue
		}

		checks = append(checks, check{
			level: console.Warned,
			text:  state.described() + " A stopped sandbox can take minutes to start, so the first connection can fail.",
			fix:   "add " + timeoutSetting + " to " + shown + ", or run: spotlight ssh setup --editor-timeout",
		})
	}

	return checks
}

func (c cli) report(address, binary string, checks []check) {
	table := tabwriter.NewWriter(c.out, 0, 0, 2, ' ', 0)
	fmt.Fprintln(table, console.Paint(c.out, console.Bold, "Spotlight SSH"))
	fmt.Fprintf(table, "  Address\t%s\n", address)
	fmt.Fprintf(table, "  Binary\t%s\n", binary)
	fmt.Fprintf(table, "  Hosts\t*%s\n", domain)
	table.Flush()

	fmt.Fprintln(c.out)
	fmt.Fprintln(c.out, console.Paint(c.out, console.Bold, "Checks"))
	for _, each := range checks {
		fmt.Fprintf(c.out, "  %s %s\n", console.Mark(c.out, each.level), each.text)
		if each.fix != "" {
			fmt.Fprintf(c.out, "      %s\n", each.fix)
		}
	}

	fmt.Fprintln(c.out)
	fmt.Fprintln(c.out, console.Paint(c.out, console.Bold, "Next"))
	fmt.Fprintln(c.out, "  Open a task in VS Code or Cursor from Spotlight, or run: ssh task-<id>.<workspace>.spotlight")
}

func homeShown(path, home string) string {
	if rest, err := filepath.Rel(home, path); err == nil && !strings.HasPrefix(rest, "..") {
		return filepath.Join("~", rest)
	}

	return path
}

func managedConfig(binary, address string) string {
	return strings.Join([]string{
		"# Written by spotlight ssh setup. Run it again to change this file.",
		"Host *" + domain,
		"  ProxyCommand " + shellQuoted(binary) + " ssh proxy --url " + shellQuoted(address) + " %h",
		"  User " + sshUser,
		"  StrictHostKeyChecking no",
		"  UserKnownHostsFile /dev/null",
		"  LogLevel ERROR",
		"  ServerAliveInterval 30",
		"  ServerAliveCountMax 6",
		"",
	}, "\n")
}

func shellQuoted(word string) string {
	word = strings.ReplaceAll(word, "%", "%%")
	plain := strings.Trim(word, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-+=/.,:@%") == ""
	if plain && word != "" {
		return word
	}

	return "'" + strings.ReplaceAll(word, "'", `'\''`) + "'"
}

func writeManaged(path, content string) (bool, error) {
	if existing, err := os.ReadFile(path); err == nil && string(existing) == content {
		return false, nil
	}

	return true, replace(path, []byte(content), 0o600)
}

func addInclude(dir, home string) (bool, error) {
	path := filepath.Join(dir, "config")
	if resolved, err := filepath.EvalSymlinks(path); err == nil {
		path = resolved
	}

	mode := fs.FileMode(0o600)
	existing, err := os.ReadFile(path)
	switch {
	case errors.Is(err, fs.ErrNotExist):
	case err != nil:
		return false, fmt.Errorf("could not read %s: %w", userShown, err)
	default:
		if info, err := os.Stat(path); err == nil {
			mode = info.Mode().Perm()
		}
	}

	updated, changed := withInclude(string(existing), filepath.Join(home, ".ssh", "spotlight", "config"))
	if !changed {
		return false, nil
	}

	return true, replace(path, []byte(updated), mode)
}

func withInclude(config, absolute string) (string, bool) {
	lines := strings.SplitAfter(config, "\n")
	var kept []string
	global := true

	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) > 0 {
			switch strings.ToLower(fields[0]) {
			case "host", "match":
				global = false
			case "include":
				if len(fields) == 2 && (fields[1] == managedShown || fields[1] == absolute) {
					if global {
						return config, false
					}
					continue
				}
			}
		}
		kept = append(kept, line)
	}

	rest := strings.Join(kept, "")
	if strings.TrimSpace(rest) == "" {
		return includeLine + "\n", true
	}

	return includeLine + "\n\n" + rest, true
}

func replace(path string, content []byte, mode fs.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("could not make %s: %w", filepath.Dir(path), err)
	}

	temp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*")
	if err != nil {
		return fmt.Errorf("could not write %s: %w", path, err)
	}
	defer os.Remove(temp.Name())

	if _, err := temp.Write(content); err != nil {
		temp.Close()
		return fmt.Errorf("could not write %s: %w", path, err)
	}
	if err := temp.Chmod(mode); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}

	if err := os.Rename(temp.Name(), path); err != nil {
		return fmt.Errorf("could not write %s: %w", path, err)
	}

	return nil
}
