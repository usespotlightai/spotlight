package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

// File is host.env as lines, so a change keeps the comments and order a person wrote.
type File struct {
	Path  string
	lines []string
}

func Open(path string) (*File, error) {
	raw, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}

	file := &File{Path: path}
	if text := strings.TrimRight(string(raw), "\n"); text != "" {
		file.lines = strings.Split(text, "\n")
	}
	return file, nil
}

func (f *File) Values() map[string]string {
	values := map[string]string{}
	for _, line := range f.lines {
		if key, value, ok := assignment(line); ok {
			values[key] = value
		}
	}
	return values
}

func (f *File) Set(env, value string) error {
	value = strings.TrimSpace(value)
	if strings.ContainsAny(value, "\r\n") {
		return fmt.Errorf("%s: a value is one line", KeyOf(env))
	}

	line := env + "=" + value
	kept := f.lines[:0]
	written := false
	for _, each := range f.lines {
		if key, _, ok := assignment(each); ok && key == env {
			if !written {
				kept, written = append(kept, line), true
			}
			continue
		}
		kept = append(kept, each)
	}
	if !written {
		kept = append(kept, line)
	}
	f.lines = kept

	return nil
}

func (f *File) Unset(env string) bool {
	kept := f.lines[:0]
	for _, each := range f.lines {
		if key, _, ok := assignment(each); ok && key == env {
			continue
		}
		kept = append(kept, each)
	}
	removed := len(kept) < len(f.lines)
	f.lines = kept

	return removed
}

// Save replaces the file in one rename, so a host reading it never sees half of it.
// A link stays a link, and the file keeps its owner, so a service running as another user still reads it.
func (f *File) Save() error {
	path := f.Path
	if resolved, err := filepath.EvalSymlinks(path); err == nil {
		path = resolved
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	temp, err := os.CreateTemp(filepath.Dir(path), ".host.env-*")
	if err != nil {
		return err
	}
	defer os.Remove(temp.Name())

	body := strings.Join(f.lines, "\n") + "\n"
	if err := errors.Join(temp.Chmod(0o600), write(temp, body), temp.Sync(), temp.Close()); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	if info, err := os.Stat(path); err == nil {
		if owner, ok := info.Sys().(*syscall.Stat_t); ok {
			_ = os.Chown(temp.Name(), int(owner.Uid), int(owner.Gid))
		}
	}

	return os.Rename(temp.Name(), path)
}

func write(file *os.File, body string) error {
	_, err := file.WriteString(body)
	return err
}

func assignment(line string) (string, string, bool) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "#") {
		return "", "", false
	}
	key, value, ok := strings.Cut(line, "=")
	if !ok {
		return "", "", false
	}
	return strings.TrimSpace(key), strings.Trim(strings.TrimSpace(value), `"'`), true
}
