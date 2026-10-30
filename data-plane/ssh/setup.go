package ssh

import (
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"usespotlight.ai/data-plane/credentials"
)

const (
	managedShown = "~/.ssh/spotlight/config"
	userShown    = "~/.ssh/config"
	includeLine  = "Include " + managedShown
	sshUser      = "spotlight"
)

func (c cli) setup(args []string) error {
	var printed bool
	address, positional, err := c.parse(setupHelp, args, func(set *flag.FlagSet) {
		set.BoolVar(&printed, "print", false, "show the configuration")
	})
	if err != nil {
		return err
	}
	if len(positional) > 0 {
		return fmt.Errorf("%s", setupHelp.Synopsis())
	}

	binary, err := c.binary()
	if err != nil {
		return fmt.Errorf("could not find the path of this spotlight binary: %w", err)
	}
	managed := managedConfig(binary, address)

	if printed {
		_, err := fmt.Fprintf(c.out, "# %s\n%s\n# Add to the top of %s\n%s\n", managedShown, managed, userShown, includeLine)
		return err
	}

	home := c.env("HOME")
	if home == "" {
		return errors.New("HOME is not set. Set it to the home folder that keeps ~/.ssh")
	}
	dir := filepath.Join(home, ".ssh")

	wrote, err := writeManaged(filepath.Join(dir, "spotlight", "config"), managed)
	if err != nil {
		return err
	}
	if wrote {
		fmt.Fprintf(c.out, "Wrote %s.\n", managedShown)
	} else {
		fmt.Fprintf(c.out, "%s is current.\n", managedShown)
	}

	added, err := addInclude(dir, home)
	if err != nil {
		return err
	}
	if added {
		fmt.Fprintf(c.out, "Added %q to the top of %s.\n", includeLine, userShown)
	} else {
		fmt.Fprintf(c.out, "%s includes %s.\n", userShown, managedShown)
	}

	if token, _ := credentials.Stored(c.env, address); token == "" {
		fmt.Fprintf(c.out, "There is no login for %s. Run: %s\n", address, loginCommand(address))
	}

	_, err = fmt.Fprintln(c.out, "Open a task in VS Code from Spotlight, or run: ssh task-<id>.<workspace>.spotlight")
	return err
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
