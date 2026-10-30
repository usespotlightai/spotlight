package ssh

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
)

const (
	timeoutKey     = "remote.SSH.connectTimeout"
	editorTimeout  = 600
	timeoutSetting = `"` + timeoutKey + `": 600`
)

type editor struct {
	name     string
	settings string
}

type editorTimeoutState struct {
	editor  editor
	seconds float64
	set     bool
	err     error
}

func (s editorTimeoutState) enough() bool {
	return s.set && s.seconds >= editorTimeout
}

func editors(system string, env func(string) string) []editor {
	var base string
	switch system {
	case "darwin":
		if home := env("HOME"); home != "" {
			base = filepath.Join(home, "Library", "Application Support")
		}
	case "windows":
		base = env("APPDATA")
	default:
		base = env("XDG_CONFIG_HOME")
		if home := env("HOME"); base == "" && home != "" {
			base = filepath.Join(home, ".config")
		}
	}
	if base == "" {
		return nil
	}

	var found []editor
	for _, each := range []struct{ name, dir string }{{"VS Code", "Code"}, {"Cursor", "Cursor"}} {
		user := filepath.Join(base, each.dir, "User")
		if info, err := os.Stat(user); err == nil && info.IsDir() {
			found = append(found, editor{name: each.name, settings: filepath.Join(user, "settings.json")})
		}
	}

	return found
}

func readEditorTimeout(e editor) editorTimeoutState {
	state := editorTimeoutState{editor: e}
	content, err := os.ReadFile(e.settings)
	if errors.Is(err, fs.ErrNotExist) {
		return state
	}
	if err != nil {
		state.err = err
		return state
	}

	settings, err := parseObject(string(content))
	if err != nil {
		state.err = err
		return state
	}
	if found, ok := settings.find(timeoutKey); ok && json.Unmarshal([]byte(found.value), &state.seconds) == nil {
		state.set = true
	}

	return state
}

func writeEditorTimeout(e editor) error {
	path := e.settings
	if resolved, err := filepath.EvalSymlinks(path); err == nil {
		path = resolved
	}

	mode := fs.FileMode(0o644)
	content, err := os.ReadFile(path)
	switch {
	case errors.Is(err, fs.ErrNotExist):
	case err != nil:
		return err
	default:
		if info, err := os.Stat(path); err == nil {
			mode = info.Mode().Perm()
		}
	}

	settings, err := parseObject(string(content))
	if err != nil {
		return err
	}

	return replace(path, []byte(settings.set(timeoutKey, strconv.Itoa(editorTimeout))), mode)
}

func (s editorTimeoutState) described() string {
	switch {
	case s.set:
		return fmt.Sprintf("%s waits %s seconds for a connection.", s.editor.name, strconv.FormatFloat(s.seconds, 'f', -1, 64))
	default:
		return s.editor.name + " uses its default connect timeout."
	}
}
