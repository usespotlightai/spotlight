// Package workingcopyhook keeps the workspaces of sandboxes in a store that an operator's program, the working copy
// hook, reaches. Spotlight knows nothing of the store: a hook can keep working copies as branches of a block store,
// as file system snapshots, or as anything that opens a directory and freezes it under a name.
//
// The host runs the hook once for each event, as `<hook> <event>`, with one JSON object on standard input. The hook
// answers with one JSON object on standard output and exits 0, or exits with another status and may print
// {"error": "..."} to say why. Every request carries "version": 1 and the event's fields:
//
//	check    {store}                       can this host serve the store? Answers {}.
//	open     {store, base, name, from}     open the working copy of sandbox name from snapshot from, else from the
//	                                       snapshot base, else as the hook sees fit. Answers {"dir": "<absolute
//	                                       directory>", "restored": true when it opened from from}.
//	snapshot {store, name, snapshot}       freeze everything written to the working copy as snapshot. Answers {}.
//	close    {store, name}                 release the working copy; its snapshots stay. Answers {}.
//	remove   {store, snapshot}             delete a snapshot of a removed archive. Answers {}.
//
// base and from are null or absent when there is none. The hook runs with only PATH, HOME and LANG of the host's
// environment, so no credential of Spotlight reaches it; it reads its own settings and the store's credentials.
package workingcopyhook

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const (
	Version = 1

	quickWait = 2 * time.Minute
	longWait  = 15 * time.Minute

	stateFile = "state.json"
	socketDir = "socket"
)

// Hook runs the working copy hook at path, and keeps what the host needs of each working copy under root.
type Hook struct {
	path string
	root string
}

func New(path, root string) *Hook {
	return &Hook{path: path, root: root}
}

// WorkingCopy is the workspace the hook opened for one sandbox.
type WorkingCopy struct {
	hook  *Hook
	state state
}

type state struct {
	Name  string `json:"name"`
	Store string `json:"store"`
	Dir   string `json:"dir"`
}

type request struct {
	Version  int     `json:"version"`
	Store    string  `json:"store"`
	Base     *string `json:"base,omitempty"`
	Name     string  `json:"name,omitempty"`
	From     *string `json:"from,omitempty"`
	Snapshot string  `json:"snapshot,omitempty"`
}

type answer struct {
	Dir      string `json:"dir"`
	Restored bool   `json:"restored"`
	Error    string `json:"error"`
}

// Check says why this host cannot serve the store, or nil when it can.
func (h *Hook) Check(ctx context.Context, store protocol.WorkingCopyStore) error {
	if _, err := h.call(ctx, quickWait, "check", request{Store: store.Store}); err != nil {
		return fmt.Errorf("the working copy hook cannot serve %s: %w", store.Store, err)
	}
	return nil
}

// Open has the hook open the working copy of sandbox name from snapshot from, or from the store's base when from is
// empty or the hook cannot open it. It says whether the hook opened it from from.
func (h *Hook) Open(ctx context.Context, store protocol.WorkingCopyStore, name, from string) (*WorkingCopy, bool, error) {
	if err := os.MkdirAll(filepath.Join(h.root, name, socketDir), 0o755); err != nil {
		return nil, false, err
	}

	asked := request{Store: store.Store, Base: store.Base, Name: name}
	if from != "" {
		asked.From = &from
	}

	answered, err := h.call(ctx, longWait, "open", asked)
	if err != nil {
		_ = os.RemoveAll(filepath.Join(h.root, name))
		return nil, false, fmt.Errorf("open the working copy: %w", err)
	}

	opened := &WorkingCopy{hook: h, state: state{Name: name, Store: store.Store, Dir: answered.Dir}}
	if !filepath.IsAbs(answered.Dir) {
		_ = opened.Close(context.WithoutCancel(ctx))
		return nil, false, fmt.Errorf("the working copy hook opened %q, which is not an absolute directory", answered.Dir)
	}
	if info, err := os.Stat(answered.Dir); err != nil || !info.IsDir() {
		_ = opened.Close(context.WithoutCancel(ctx))
		return nil, false, fmt.Errorf("the working copy hook opened %s, which is not a directory", answered.Dir)
	}

	if err := opened.save(); err != nil {
		_ = opened.Close(context.WithoutCancel(ctx))
		return nil, false, err
	}

	return opened, answered.Restored && from != "", nil
}

// Adopt takes over the working copy of sandbox name that an earlier host process left open.
func (h *Hook) Adopt(name string) (*WorkingCopy, bool) {
	body, err := os.ReadFile(filepath.Join(h.root, name, stateFile))
	if err != nil {
		return nil, false
	}

	var kept state
	if err := json.Unmarshal(body, &kept); err != nil || kept.Dir == "" || kept.Store == "" {
		return nil, false
	}
	return &WorkingCopy{hook: h, state: kept}, true
}

// Left names the working copies an earlier host process left open on this host.
func (h *Hook) Left() []string {
	entries, err := os.ReadDir(h.root)
	if err != nil {
		return nil
	}

	var names []string
	for _, entry := range entries {
		if _, err := os.Stat(filepath.Join(h.root, entry.Name(), stateFile)); err == nil {
			names = append(names, entry.Name())
		}
	}
	return names
}

// RemoveSnapshot has the hook delete a snapshot of a removed archive.
func (h *Hook) RemoveSnapshot(ctx context.Context, store protocol.WorkingCopyStore, snapshot string) error {
	if _, err := h.call(ctx, quickWait, "remove", request{Store: store.Store, Snapshot: snapshot}); err != nil {
		return fmt.Errorf("remove snapshot %s: %w", snapshot, err)
	}
	return nil
}

// Dir is the directory the hook opened, for the sandbox's workspace.
func (w *WorkingCopy) Dir() string { return w.state.Dir }

// Sockets is the directory of the sandbox's host socket.
func (w *WorkingCopy) Sockets() string { return filepath.Join(w.hook.root, w.state.Name, socketDir) }

// Snapshot has the hook freeze everything the sandbox wrote so far as snapshot name.
func (w *WorkingCopy) Snapshot(ctx context.Context, name string) error {
	if _, err := w.hook.call(ctx, longWait, "snapshot", request{Store: w.state.Store, Name: w.state.Name, Snapshot: name}); err != nil {
		return fmt.Errorf("make snapshot %s: %w", name, err)
	}
	return nil
}

// Close has the hook release the working copy once the sandbox is gone.
func (w *WorkingCopy) Close(ctx context.Context) error {
	if _, err := w.hook.call(ctx, longWait, "close", request{Store: w.state.Store, Name: w.state.Name}); err != nil {
		return fmt.Errorf("close the working copy: %w", err)
	}
	return os.RemoveAll(filepath.Join(w.hook.root, w.state.Name))
}

func (w *WorkingCopy) save() error {
	body, err := json.Marshal(w.state)
	if err != nil {
		return err
	}
	path := filepath.Join(w.hook.root, w.state.Name, stateFile)
	if err := os.WriteFile(path+".new", body, 0o600); err != nil {
		return err
	}
	return os.Rename(path+".new", path)
}

// call runs the hook for one event. It passes on only PATH, HOME and LANG, so the hook sees no credential of the host.
func (h *Hook) call(ctx context.Context, wait time.Duration, event string, asked request) (answer, error) {
	ctx, cancel := context.WithTimeout(ctx, wait)
	defer cancel()

	asked.Version = Version
	body, err := json.Marshal(asked)
	if err != nil {
		return answer{}, err
	}

	command := exec.CommandContext(ctx, h.path, event)
	command.Cancel = func() error { return command.Process.Signal(syscall.SIGTERM) }
	command.WaitDelay = 10 * time.Second
	command.Env = environment()
	command.Stdin = bytes.NewReader(body)
	var stdout, stderr bytes.Buffer
	command.Stdout, command.Stderr = &stdout, &stderr

	ran := command.Run()

	var answered answer
	if stdout.Len() > 0 {
		if err := json.Unmarshal(bytes.TrimSpace(stdout.Bytes()), &answered); err != nil && ran == nil {
			return answer{}, fmt.Errorf("the hook answered %s with what is not one JSON object: %s", event, tail(stdout.String()))
		}
	}

	switch {
	case ctx.Err() != nil:
		return answer{}, fmt.Errorf("the hook did not answer %s within %s", event, wait)
	case ran != nil && answered.Error != "":
		return answer{}, errors.New(answered.Error)
	case ran != nil:
		return answer{}, fmt.Errorf("%s %s: %w: %s", h.path, event, ran, tail(stderr.String()))
	}
	return answered, nil
}

func environment() []string {
	var env []string
	for _, name := range []string{"PATH", "HOME", "LANG"} {
		if value, ok := os.LookupEnv(name); ok {
			env = append(env, name+"="+value)
		}
	}
	return env
}

func tail(text string) string {
	text = strings.TrimSpace(text)
	if len(text) > 400 {
		text = text[len(text)-400:]
	}
	return text
}
