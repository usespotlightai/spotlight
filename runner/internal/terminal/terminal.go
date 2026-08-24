// Package terminal supervises the agent under a pseudo-terminal.
//
// Output is teed to an on-disk recording with byte offsets, so a viewer can
// replay from where it left off, and to whoever is reading live. Fan-out to
// several viewers is the relay's job, so exactly one consumer leaves here.
package terminal

import (
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/creack/pty"
	"usespotlight.ai/runner/internal/protocol"
)

// Size is the terminal geometry to start at. A full-screen TUI redraws badly
// when resized after start, so the caller states it up front.
type Size struct {
	Cols uint16
	Rows uint16
}

// DefaultSize is used when nobody is watching yet. Wide enough to keep the
// recording from wrapping into nonsense.
var DefaultSize = Size{Cols: 120, Rows: 40}

type Chunk struct {
	Data   []byte
	Offset int64
}

type Spec struct {
	Command protocol.Command
	Dir     string
	// Recording is where its output is written, outside the workspace: the
	// agent must not be able to edit the record of what it did.
	Recording string
	Size      Size
	// RunAs is the account to drop to. Nil runs as the runner's own user.
	RunAs *User
}

type Session struct {
	command   *exec.Cmd
	pty       *os.File
	recording *os.File
	offset    int64
}

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

// Read returns the next chunk of output, reporting io.EOF once the agent has
// finished writing. On macOS the kernel raises EIO when the child exits, which
// means the same thing here.
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

func (s *Session) Write(data []byte) error {
	_, err := s.pty.Write(data)
	return err
}

func (s *Session) Resize(size Size) error {
	return pty.Setsize(s.pty, &pty.Winsize{Cols: size.Cols, Rows: size.Rows})
}

func (s *Session) Stop() error {
	if s.command.Process == nil {
		return nil
	}

	if err := signalGroup(s.command.Process.Pid, syscall.SIGTERM); err != nil {
		return s.command.Process.Signal(syscall.SIGTERM)
	}

	return nil
}

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

func (s *Session) Close() error {
	return errors.Join(s.pty.Close(), s.recording.Close())
}

// runnerOnly are the variables the agent must never see, including the
// runner's control plane token: an agent with a shell can read its own
// environment.
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

func isClosed(err error) bool {
	return errors.Is(err, io.EOF) || errors.Is(err, os.ErrClosed) || errors.Is(err, syscallEIO)
}
