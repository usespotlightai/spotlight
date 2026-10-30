package sshd

import (
	"bytes"
	"errors"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

func connect(t *testing.T) (*ssh.Client, string) {
	t.Helper()

	key, err := HostKey(filepath.Join(t.TempDir(), "host-key"))
	if err != nil {
		t.Fatal(err)
	}
	signer, err := Signer(key)
	if err != nil {
		t.Fatal(err)
	}

	dir := t.TempDir()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	served := make(chan error, 1)
	go func() {
		server, err := listener.Accept()
		if err != nil {
			served <- err
			return
		}
		served <- Serve(Stdio(server, server, server.Close), Options{
			HostKey: signer,
			Dir:     dir,
			Env:     []string{"PATH=" + os.Getenv("PATH"), "HOME=" + dir, "GREETING=hello"},
			Shell:   "/bin/sh",
		})
	}()

	client, err := net.Dial("tcp", listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	conn, channels, requests, err := ssh.NewClientConn(client, "task-1.acme.spotlight", &ssh.ClientConfig{
		User:            "agent",
		HostKeyCallback: ssh.FixedHostKey(signer.PublicKey()),
		Timeout:         10 * time.Second,
	})
	if err != nil {
		t.Fatal(err)
	}
	ssh := ssh.NewClient(conn, channels, requests)
	t.Cleanup(func() {
		ssh.Close()
		select {
		case <-served:
		case <-time.After(5 * time.Second):
			t.Error("the server did not stop after the client left")
		}
	})

	return ssh, dir
}

func TestRunsACommandInTheWorkspaceWithItsEnvironmentAndExitStatus(t *testing.T) {
	client, dir := connect(t)

	session, err := client.NewSession()
	if err != nil {
		t.Fatal(err)
	}
	if err := session.Setenv("ASKED", "yes"); err != nil {
		t.Fatal(err)
	}
	var out, errs bytes.Buffer
	session.Stdout, session.Stderr = &out, &errs
	session.Stdin = strings.NewReader("from stdin")

	err = session.Run(`pwd; echo "$GREETING $ASKED"; cat; echo oops >&2; exit 3`)

	var exit *ssh.ExitError
	if !errors.As(err, &exit) || exit.ExitStatus() != 3 {
		t.Fatalf("exit: %v", err)
	}
	resolved, _ := filepath.EvalSymlinks(dir)
	if got := strings.TrimSpace(out.String()); got != resolved+"\nhello yes\nfrom stdin" && got != dir+"\nhello yes\nfrom stdin" {
		t.Errorf("stdout: %q", got)
	}
	if errs.String() != "oops\n" {
		t.Errorf("stderr: %q", errs.String())
	}
}

func TestSaysWhichSignalStoppedACommand(t *testing.T) {
	client, _ := connect(t)

	session, err := client.NewSession()
	if err != nil {
		t.Fatal(err)
	}
	err = session.Run(`kill -TERM $$`)

	var exit *ssh.ExitError
	if !errors.As(err, &exit) || exit.Signal() != "TERM" {
		t.Fatalf("exit: %v", err)
	}
}

func TestRunsAShellInATerminalThatFollowsTheWindowSize(t *testing.T) {
	client, _ := connect(t)

	session, err := client.NewSession()
	if err != nil {
		t.Fatal(err)
	}
	if err := session.RequestPty("xterm-256color", 24, 80, ssh.TerminalModes{ssh.ECHO: 0}); err != nil {
		t.Fatal(err)
	}
	stdin, err := session.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	var out lockedBuffer
	session.Stdout = &out
	if err := session.Shell(); err != nil {
		t.Fatal(err)
	}

	if err := session.WindowChange(40, 120); err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)
	if _, err := io.WriteString(stdin, "[ -t 0 ] && echo tty-$TERM; stty size; exit 5\n"); err != nil {
		t.Fatal(err)
	}

	err = session.Wait()
	var exit *ssh.ExitError
	if !errors.As(err, &exit) || exit.ExitStatus() != 5 {
		t.Fatalf("exit: %v (output %q)", err, out.String())
	}
	if !strings.Contains(out.String(), "tty-xterm-256color") || !strings.Contains(out.String(), "40 120") {
		t.Errorf("output: %q", out.String())
	}
}

func TestServesSFTPRelativeToTheWorkspace(t *testing.T) {
	client, dir := connect(t)

	files, err := sftp.NewClient(client)
	if err != nil {
		t.Fatal(err)
	}
	defer files.Close()

	written, err := files.Create("notes.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := written.Write([]byte("cap the retries")); err != nil {
		t.Fatal(err)
	}
	written.Close()

	got, err := os.ReadFile(filepath.Join(dir, "notes.txt"))
	if err != nil || string(got) != "cap the retries" {
		t.Fatalf("read %q, %v", got, err)
	}

	entries, err := files.ReadDir(".")
	if err != nil || len(entries) != 1 || entries[0].Name() != "notes.txt" {
		t.Errorf("listed %v, %v", entries, err)
	}
}

func TestForwardsToAPortOnLocalhostOnly(t *testing.T) {
	client, _ := connect(t)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_, _ = io.Copy(conn, conn)
	}()

	forwarded, err := client.Dial("tcp", listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := forwarded.Write([]byte("ping")); err != nil {
		t.Fatal(err)
	}
	echoed := make([]byte, 4)
	if _, err := io.ReadFull(forwarded, echoed); err != nil || string(echoed) != "ping" {
		t.Fatalf("echoed %q, %v", echoed, err)
	}
	forwarded.Close()

	if _, err := client.Dial("tcp", "192.0.2.1:80"); err == nil {
		t.Error("forwarded to an address that is not localhost")
	}
}

func TestGivesEveryConnectionOfASandboxTheSameHostKey(t *testing.T) {
	path := filepath.Join(t.TempDir(), "run", "host-key")

	var (
		wait sync.WaitGroup
		keys = make([][]byte, 8)
	)
	for each := range keys {
		wait.Go(func() {
			key, err := HostKey(path)
			if err != nil {
				t.Error(err)
			}
			keys[each] = key
		})
	}
	wait.Wait()

	for _, key := range keys[1:] {
		if !bytes.Equal(key, keys[0]) {
			t.Fatal("two connections got different host keys")
		}
	}
	if info, err := os.Stat(path); err != nil || info.Mode().Perm() != 0o600 {
		t.Errorf("the host key is %v, %v", info, err)
	}
	if _, err := Signer(keys[0]); err != nil {
		t.Error(err)
	}
}

type lockedBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}
