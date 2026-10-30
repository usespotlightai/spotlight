package account

import (
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"syscall"
	"testing"
)

func process(t *testing.T, root, pid, state, uid string) {
	t.Helper()

	dir := filepath.Join(root, pid)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	status := "Name:\tnode\nState:\t" + state + " (running)\nUid:\t" + uid + "\t" + uid + "\t" + uid + "\t" + uid + "\n"
	if err := os.WriteFile(filepath.Join(dir, "status"), []byte(status), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestStopsEveryLiveProcessOfTheAgentAndNothingElse(t *testing.T) {
	root := t.TempDir()
	process(t, root, "1", "S", "0")
	process(t, root, "40", "S", "1000")
	process(t, root, "41", "R", "1000")
	process(t, root, "42", "Z", "1000")
	process(t, root, "43", "S", "1001")
	if err := os.MkdirAll(filepath.Join(root, "self"), 0o755); err != nil {
		t.Fatal(err)
	}

	var killed []int
	stopped, err := stopOwned(root, 1000, func(pid int, signal syscall.Signal) error {
		if signal != syscall.SIGKILL {
			t.Errorf("sent %v to %d", signal, pid)
		}
		killed = append(killed, pid)
		return os.RemoveAll(filepath.Join(root, strconv.Itoa(pid)))
	}, 0)
	if err != nil {
		t.Fatal(err)
	}

	slices.Sort(killed)
	if stopped != 2 || !slices.Equal(killed, []int{40, 41}) {
		t.Errorf("stopped %d: %v", stopped, killed)
	}
}

func TestLeavesTheProcessesOfAnEditorRunning(t *testing.T) {
	root := t.TempDir()
	process(t, root, "40", "S", "1000")
	process(t, root, "41", "S", "1000")
	environ := "HOME=/home/agent\x00" + EditorSession + "\x00PATH=/usr/bin\x00"
	if err := os.WriteFile(filepath.Join(root, "41", "environ"), []byte(environ), 0o644); err != nil {
		t.Fatal(err)
	}

	var killed []int
	if _, err := stopOwned(root, 1000, func(pid int, _ syscall.Signal) error {
		killed = append(killed, pid)
		return os.RemoveAll(filepath.Join(root, strconv.Itoa(pid)))
	}, 0); err != nil {
		t.Fatal(err)
	}

	if !slices.Equal(killed, []int{40}) {
		t.Errorf("stopped %v", killed)
	}
}

func TestSaysWhenAProcessOutlivesEveryRound(t *testing.T) {
	root := t.TempDir()
	process(t, root, "40", "S", "1000")

	if _, err := stopOwned(root, 1000, func(int, syscall.Signal) error { return nil }, 0); err == nil {
		t.Error("a process that never stopped went unreported")
	}
}
