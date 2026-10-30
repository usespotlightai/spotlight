package account

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	procRoot   = "/proc"
	stopRounds = 5
	stopPause  = 100 * time.Millisecond
)

func (u *User) StopProcesses() (int, error) {
	if u == nil {
		return 0, nil
	}
	return stopOwned(procRoot, u.UID, syscall.Kill, stopPause)
}

func stopOwned(root string, uid uint32, kill func(int, syscall.Signal) error, pause time.Duration) (int, error) {
	stopped := 0

	for range stopRounds {
		pids, err := ownedBy(root, uid)
		if err != nil {
			return stopped, err
		}
		if len(pids) == 0 {
			return stopped, nil
		}

		for _, pid := range pids {
			if err := kill(pid, syscall.SIGKILL); err == nil {
				stopped++
			}
		}
		time.Sleep(pause)
	}

	left, err := ownedBy(root, uid)
	if err != nil {
		return stopped, err
	}
	if len(left) > 0 {
		return stopped, fmt.Errorf("%d processes of uid %d did not stop: %v", len(left), uid, left)
	}

	return stopped, nil
}

func ownedBy(root string, uid uint32) ([]int, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("list processes: %w", err)
	}

	var owned []int
	for _, entry := range entries {
		pid, err := strconv.Atoi(entry.Name())
		if err != nil || !entry.IsDir() {
			continue
		}

		live, ownerUID, ok := statusOf(filepath.Join(root, entry.Name(), "status"))
		if ok && live && ownerUID == uid {
			owned = append(owned, pid)
		}
	}

	return owned, nil
}

func statusOf(path string) (live bool, uid uint32, ok bool) {
	file, err := os.Open(path)
	if err != nil {
		return false, 0, false
	}
	defer file.Close()

	live, found := true, false
	lines := bufio.NewScanner(file)
	for lines.Scan() {
		key, value, _ := strings.Cut(lines.Text(), ":")
		fields := strings.Fields(value)
		switch {
		case key == "State" && len(fields) > 0:
			live = fields[0] != "Z" && fields[0] != "X"
		case key == "Uid" && len(fields) > 0:
			parsed, err := strconv.ParseUint(fields[0], 10, 32)
			if err != nil {
				return false, 0, false
			}
			uid, found = uint32(parsed), true
		}
	}

	return live, uid, found
}
