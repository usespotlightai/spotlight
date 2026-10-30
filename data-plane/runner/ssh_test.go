package runner

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/ssh"

	"usespotlight.ai/data-plane/runner/internal/sshd"
)

const sshHelper = "SPOTLIGHT_TEST_SSH_HELPER"

func TestServeSSHHelper(t *testing.T) {
	if os.Getenv(sshHelper) == "" {
		t.Skip("runs only as the helper process of another test")
	}
	hostKeyPath = filepath.Join(os.Getenv(sshHelper), "host-key")
	workspaceOpenPath = filepath.Join(os.Getenv(sshHelper), "workspace-open")
	if err := serveSSH(nil); err != nil {
		t.Fatal(err)
	}
}

func TestAnswersOneSSHConnectionOnStdinAndStdout(t *testing.T) {
	workspace, run := t.TempDir(), t.TempDir()
	if err := os.WriteFile(filepath.Join(run, "workspace-open"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(os.Args[0], "-test.run=^TestServeSSHHelper$")
	cmd.Env = append(os.Environ(),
		sshHelper+"="+run,
		"SPOTLIGHT_AGENT_USER=",
		"SPOTLIGHT_WORKSPACE="+workspace,
		"SPOTLIGHT_RUN_TOKEN=secret",
		"HOME="+t.TempDir(),
	)
	in, err := cmd.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	out, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
	})

	conn, channels, requests, err := ssh.NewClientConn(sshd.Stdio(out, in, in.Close), "task-1.acme.spotlight", &ssh.ClientConfig{
		User:            "agent",
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	})
	if err != nil {
		t.Fatal(err)
	}
	client := ssh.NewClient(conn, channels, requests)
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	session.Stdout = &output
	if err := session.Run(`pwd; echo "token=$SPOTLIGHT_RUN_TOKEN editor=$SPOTLIGHT_EDITOR_SESSION"`); err != nil {
		t.Fatal(err)
	}

	resolved, _ := filepath.EvalSymlinks(workspace)
	lines := strings.Split(strings.TrimSpace(output.String()), "\n")
	if len(lines) != 2 || (lines[0] != workspace && lines[0] != resolved) || lines[1] != "token= editor=1" {
		t.Errorf("output: %q", output.String())
	}
}
