package host

import (
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func TestClosingTheLogStopsItsProcess(t *testing.T) {
	cmd := exec.Command("sh", "-c", "echo first; sleep 60")
	pipe, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	logs := &process{Reader: pipe, cmd: cmd}

	first := make([]byte, 6)
	if _, err := io.ReadFull(logs, first); err != nil || string(first) != "first\n" {
		t.Fatalf("read %q, %v", first, err)
	}
	closed := make(chan error, 2)
	go func() { closed <- logs.Close() }()
	select {
	case <-closed:
	case <-time.After(5 * time.Second):
		t.Fatal("Close did not stop the process")
	}
	if logs.Close() == nil {
		t.Error("a second Close lost the exit error")
	}
}

func TestRunPassesTheInputOnStdin(t *testing.T) {
	binary := filepath.Join(t.TempDir(), "spotlight")
	if err := os.WriteFile(binary, []byte("#!/bin/sh\nread value\necho \"$1 $2 got $value\"\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	out, err := localHost{binary: binary}.Run([]string{"config"}, "secret\n")
	if err != nil || out != "host config got secret" {
		t.Fatalf("out %q, %v", out, err)
	}
}
