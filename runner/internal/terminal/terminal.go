// Package terminal supervises the agent under a pseudo-terminal.
//
// Output is teed: to an on-disk recording with byte offsets, which is what
// lets a viewer replay from where it left off rather than joining midway, and
// to whoever is reading live. Fan-out to several viewers is the gateway's job,
// so exactly one consumer leaves here.
package terminal

import (
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/creack/pty"
	"usespotlight.ai/runner/internal/protocol"
)

// Size is the terminal geometry to start at. A full-screen TUI redraws badly
// if it starts at one size and is resized after, so the caller states this up
// front rather than letting it default.
type Size struct {
	Cols uint16
	Rows uint16
}

// DefaultSize is used when nobody is watching yet. Wide enough that an agent's
// output is not wrapped into nonsense in the recording.
var DefaultSize = Size{Cols: 120, Rows: 40}

// Chunk is a slice of terminal output and where it sits in the recording.
type Chunk struct {
	Data   []byte
	Offset int64
}

// Spec is everything needed to start an agent.
type Spec struct {
	Command protocol.Command
	// Dir is where the agent starts, inside the workspace.
	Dir string
	// Recording is where its output is written. Deliberately outside the
	// workspace: the agent must not be able to edit the record of what it did.
	Recording string
	Size      Size
	// RunAs is the account to drop to. Nil runs as the runner's own user.
	RunAs *User
}

// Session is a running agent attached to a pty.
type Session struct {
	command   *exec.Cmd
	pty       *os.File
	recording *os.File
	offset    int64
}

// Start spawns the agent under a pty, recording everything it writes.
func Start(ctx context.Context, spec Spec) (*Session, error) {
	command := exec.CommandContext(ctx, spec.Command.Executable, spec.Command.Args...)
	command.Dir = spec.Dir
	command.Env = environment(spec.Command.Env)
	command.SysProcAttr = spec.RunAs.sysProcAttr()

	if err := os.MkdirAll(filepath.Dir(spec.Recording), 0o700); err != nil {
		return nil, err
	}
	recording, err := os.Create(spec.Recording)
	if err != nil {
		return nil, err
	}

	attached, err := pty.StartWithSize(command, &pty.Winsize{Cols: spec.Size.Cols, Rows: spec.Size.Rows})
	if err != nil {
		_ = recording.Close()
		return nil, err
	}

	return &Session{command: command, pty: attached, recording: recording}, nil
}

// Read returns the next chunk of output. It reports io.EOF once the agent has
// finished writing; on macOS the kernel raises EIO rather than EOF when the
// child exits, which means the same thing here.
func (s *Session) Read(buffer []byte) (Chunk, error) {
	read, err := s.pty.Read(buffer)

	if read > 0 {
		data := buffer[:read]
		offset := s.offset

		if _, writeErr := s.recording.Write(data); writeErr != nil {
			return Chunk{}, writeErr
		}
		s.offset += int64(read)

		return Chunk{Data: data, Offset: offset}, nil
	}

	if err == nil {
		return Chunk{}, nil
	}
	if isClosed(err) {
		return Chunk{}, io.EOF
	}

	return Chunk{}, err
}

// Write sends keystrokes to the agent.
func (s *Session) Write(data []byte) error {
	_, err := s.pty.Write(data)
	return err
}

// Resize follows a viewer's window.
func (s *Session) Resize(size Size) error {
	return pty.Setsize(s.pty, &pty.Winsize{Cols: size.Cols, Rows: size.Rows})
}

// Wait reaps the agent and reports its exit code.
func (s *Session) Wait() int {
	if err := s.command.Wait(); err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			return exit.ExitCode()
		}
		return -1
	}
	return 0
}

// Close releases the pty and the recording. Waiting is the caller's job.
func (s *Session) Close() error {
	return errors.Join(s.pty.Close(), s.recording.Close())
}

// runnerOnly are the variables the agent must never see. The runner's own
// control plane token is among them: an agent with a shell can read its
// environment, and that token speaks for the runner.
const runnerOnly = "SPOTLIGHT_"

func environment(extra map[string]string) []string {
	env := make([]string, 0, len(os.Environ())+len(extra)+2)

	for _, entry := range os.Environ() {
		if !strings.HasPrefix(entry, runnerOnly) {
			env = append(env, entry)
		}
	}

	env = append(env, "TERM=xterm-256color", "COLORTERM=truecolor")
	for key, value := range extra {
		env = append(env, key+"="+value)
	}

	return env
}

// isClosed reports whether the error means the child is gone rather than that
// something went wrong.
func isClosed(err error) bool {
	return errors.Is(err, io.EOF) || errors.Is(err, os.ErrClosed) || errors.Is(err, syscallEIO)
}
