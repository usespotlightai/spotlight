package runner

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/account"
	"usespotlight.ai/data-plane/runner/internal/config"
	"usespotlight.ai/data-plane/runner/internal/editorservers"
	"usespotlight.ai/data-plane/runner/internal/sshd"
)

const (
	asAgent = "serve"
	keyFile = 3
)

const (
	workspaceWait = 10 * time.Minute
	workspacePoll = 500 * time.Millisecond
)

var (
	hostKeyPath       = "/run/spotlight/ssh-host-key"
	workspaceOpenPath = protocol.SandboxWorkspaceOpen
)

func serveSSH(args []string) error {
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))

	if len(args) == 2 && args[0] == asAgent {
		key, err := io.ReadAll(os.NewFile(keyFile, "host-key"))
		if err != nil {
			return fmt.Errorf("read the sandbox's host key: %w", err)
		}
		return serveSSHWith(key, args[1], os.Environ(), log)
	}
	if len(args) != 0 {
		return errors.New("usage: spotlight runner ssh")
	}

	cfg := config.LoadEditor()
	agentUser, err := account.LookupUser(cfg.AgentUser)
	if err != nil {
		return err
	}

	key, err := sshd.HostKey(hostKeyPath)
	if err != nil {
		return err
	}

	env := append(account.Environment(nil, agentUser), account.EditorSession)
	shareEditorServers(agentUser, log)
	awaitWorkspace(log)

	if agentUser == nil {
		return serveSSHWith(key, cfg.Workspace, env, log)
	}

	keys, sending, err := os.Pipe()
	if err != nil {
		return err
	}
	defer keys.Close()

	self, err := os.Executable()
	if err != nil {
		return err
	}

	cmd := exec.Command(self, "runner", "ssh", asAgent, cfg.Workspace)
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	cmd.ExtraFiles = []*os.File{keys}
	cmd.Env = env
	cmd.Dir = cfg.Workspace
	cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: agentUser.UID, Gid: agentUser.GID}}
	if err := cmd.Start(); err != nil {
		sending.Close()
		return fmt.Errorf("serve SSH as %s: %w", agentUser.Name, err)
	}
	keys.Close()

	_, err = sending.Write(key)
	sending.Close()
	if err != nil {
		_ = cmd.Process.Kill()
	}

	return errors.Join(err, cmd.Wait())
}

func serveSSHWith(key []byte, workspace string, env []string, log *slog.Logger) error {
	signer, err := sshd.Signer(key)
	if err != nil {
		return err
	}

	shell := account.DefaultShell
	for _, entry := range env {
		if value, ok := strings.CutPrefix(entry, "SHELL="); ok && value != "" {
			shell = value
		}
	}

	return sshd.Serve(sshd.Stdio(os.Stdin, os.Stdout, nil), sshd.Options{
		HostKey: signer,
		Dir:     workspace,
		Env:     env,
		Shell:   shell,
		Log:     log,
	})
}

func awaitWorkspace(log *slog.Logger) {
	deadline := time.Now().Add(workspaceWait)
	for {
		if _, err := os.Stat(workspaceOpenPath); err == nil {
			return
		}
		if time.Now().After(deadline) {
			log.Warn("the workspace did not open in time; the editor connects anyway")
			return
		}
		time.Sleep(workspacePoll)
	}
}

func shareEditorServers(agentUser *account.User, log *slog.Logger) {
	home, owner := os.Getenv("HOME"), (*editorservers.Owner)(nil)
	if agentUser != nil {
		if agentUser.UID > math.MaxInt32 || agentUser.GID > math.MaxInt32 {
			log.Warn("the agent user's ids are out of range, so the editor servers are not shared", "uid", agentUser.UID, "gid", agentUser.GID)
			return
		}
		home, owner = agentUser.Home, &editorservers.Owner{UID: int(agentUser.UID), GID: int(agentUser.GID)}
	}
	if home == "" {
		return
	}

	if err := editorservers.Share(protocol.SandboxEditorServers, home, owner); err != nil {
		log.Warn("could not share the editor servers that the host keeps", "error", err)
	}
}
