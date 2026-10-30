package sshd

import (
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

const ptyDrain = 250 * time.Millisecond

var signals = map[string]syscall.Signal{
	"ABRT": syscall.SIGABRT, "ALRM": syscall.SIGALRM, "FPE": syscall.SIGFPE, "HUP": syscall.SIGHUP,
	"ILL": syscall.SIGILL, "INT": syscall.SIGINT, "KILL": syscall.SIGKILL, "PIPE": syscall.SIGPIPE,
	"QUIT": syscall.SIGQUIT, "SEGV": syscall.SIGSEGV, "TERM": syscall.SIGTERM, "USR1": syscall.SIGUSR1,
	"USR2": syscall.SIGUSR2,
}

type ptyRequest struct {
	Term     string
	Columns  uint32
	Rows     uint32
	Width    uint32
	Height   uint32
	Modelist string
}

type windowChange struct {
	Columns uint32
	Rows    uint32
	Width   uint32
	Height  uint32
}

type session struct {
	channel ssh.Channel
	opts    Options

	mu       sync.Mutex
	env      []string
	terminal *ptyRequest
	tty      *os.File
	process  *os.Process
	started  bool
}

func serveSession(incoming ssh.NewChannel, opts Options) {
	channel, requests, err := incoming.Accept()
	if err != nil {
		return
	}

	s := &session{channel: channel, opts: opts}
	for request := range requests {
		ok := s.handle(request)
		if request.WantReply {
			_ = request.Reply(ok, nil)
		}
	}

	s.hangUp()
}

func (s *session) handle(request *ssh.Request) bool {
	switch request.Type {
	case "env":
		var variable struct{ Name, Value string }
		if ssh.Unmarshal(request.Payload, &variable) != nil || variable.Name == "" {
			return false
		}
		s.mu.Lock()
		s.env = append(s.env, variable.Name+"="+variable.Value)
		s.mu.Unlock()
		return true
	case "pty-req":
		var terminal ptyRequest
		if ssh.Unmarshal(request.Payload, &terminal) != nil {
			return false
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.started {
			return false
		}
		s.terminal = &terminal
		return true
	case "window-change":
		var size windowChange
		if ssh.Unmarshal(request.Payload, &size) != nil {
			return false
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.terminal != nil {
			s.terminal.Columns, s.terminal.Rows = size.Columns, size.Rows
		}
		if s.tty != nil {
			_ = pty.Setsize(s.tty, &pty.Winsize{Cols: uint16(size.Columns), Rows: uint16(size.Rows)})
		}
		return true
	case "signal":
		var signal struct{ Signal string }
		if ssh.Unmarshal(request.Payload, &signal) != nil {
			return false
		}
		return s.signal(signals[signal.Signal])
	case "shell":
		return s.start(nil)
	case "exec":
		var command struct{ Command string }
		if ssh.Unmarshal(request.Payload, &command) != nil {
			return false
		}
		return s.start(&command.Command)
	case "subsystem":
		var subsystem struct{ Name string }
		if ssh.Unmarshal(request.Payload, &subsystem) != nil || subsystem.Name != "sftp" {
			return false
		}
		return s.sftp()
	default:
		return false
	}
}

func (s *session) begin() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.started {
		return false
	}
	s.started = true
	return true
}

func (s *session) sftp() bool {
	if !s.begin() {
		return false
	}

	server, err := sftp.NewServer(s.channel, sftp.WithServerWorkingDirectory(s.opts.Dir))
	if err != nil {
		s.exit(1, "")
		return true
	}

	go func() {
		code := uint32(0)
		if err := server.Serve(); err != nil && !errors.Is(err, io.EOF) {
			code = 1
		}
		server.Close()
		s.exit(code, "")
	}()

	return true
}

func (s *session) start(command *string) bool {
	if !s.begin() {
		return false
	}

	shell := s.opts.Shell
	if shell == "" {
		shell = "/bin/sh"
	}

	cmd := exec.Command(shell)
	if command != nil {
		cmd.Args = []string{shell, "-c", *command}
	} else {
		cmd.Args = []string{"-" + filepath.Base(shell)}
	}
	cmd.Dir = s.opts.Dir

	s.mu.Lock()
	cmd.Env = append(append([]string{}, s.opts.Env...), s.env...)
	terminal := s.terminal
	s.mu.Unlock()

	if terminal != nil {
		return s.startInTerminal(cmd, *terminal)
	}
	return s.startPiped(cmd)
}

func (s *session) startInTerminal(cmd *exec.Cmd, terminal ptyRequest) bool {
	if terminal.Term != "" {
		cmd.Env = append(cmd.Env, "TERM="+terminal.Term)
	}

	tty, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: uint16(terminal.Columns), Rows: uint16(terminal.Rows)})
	if err != nil {
		s.opts.Log.Warn("could not start a command in a terminal", "error", err)
		go s.exit(127, "")
		return true
	}

	s.mu.Lock()
	s.tty, s.process = tty, cmd.Process
	s.mu.Unlock()

	go func() { _, _ = io.Copy(tty, s.channel) }()
	output := make(chan struct{})
	go func() {
		defer close(output)
		_, _ = io.Copy(s.channel, tty)
	}()

	go func() {
		state, _ := cmd.Process.Wait()
		select {
		case <-output:
		case <-time.After(ptyDrain):
		}
		s.mu.Lock()
		s.tty = nil
		tty.Close()
		s.mu.Unlock()
		s.exited(state)
	}()

	return true
}

func (s *session) startPiped(cmd *exec.Cmd) bool {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Stdout = s.channel
	cmd.Stderr = s.channel.Stderr()
	stdin, err := cmd.StdinPipe()
	if err != nil {
		go s.exit(127, "")
		return true
	}

	if err := cmd.Start(); err != nil {
		s.opts.Log.Warn("could not start a command", "error", err)
		go s.exit(127, "")
		return true
	}

	s.mu.Lock()
	s.process = cmd.Process
	s.mu.Unlock()

	go func() {
		_, _ = io.Copy(stdin, s.channel)
		stdin.Close()
	}()

	go func() {
		_ = cmd.Wait()
		s.exited(cmd.ProcessState)
	}()

	return true
}

func (s *session) exited(state *os.ProcessState) {
	if state == nil {
		s.exit(255, "")
		return
	}

	if status, ok := state.Sys().(syscall.WaitStatus); ok && status.Signaled() {
		s.exit(0, signalName(status.Signal()))
		return
	}

	s.exit(uint32(state.ExitCode()), "")
}

func (s *session) exit(code uint32, signal string) {
	if signal != "" {
		_, _ = s.channel.SendRequest("exit-signal", false, ssh.Marshal(struct {
			Signal     string
			CoreDumped bool
			Message    string
			Language   string
		}{Signal: signal}))
	} else {
		_, _ = s.channel.SendRequest("exit-status", false, ssh.Marshal(struct{ Status uint32 }{code}))
	}
	_ = s.channel.CloseWrite()
	_ = s.channel.Close()
}

func (s *session) signal(signal syscall.Signal) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if signal == 0 || s.process == nil {
		return false
	}
	return syscall.Kill(-s.process.Pid, signal) == nil
}

func (s *session) hangUp() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.process != nil && s.tty != nil {
		_ = syscall.Kill(-s.process.Pid, syscall.SIGHUP)
	}
	_ = s.channel.Close()
}

func signalName(signal syscall.Signal) string {
	for name, each := range signals {
		if each == signal {
			return name
		}
	}
	return "KILL"
}
