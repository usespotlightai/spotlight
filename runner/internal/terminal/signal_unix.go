//go:build unix

package terminal

import "syscall"

func signalGroup(pid int, sig syscall.Signal) error {
	return syscall.Kill(-pid, sig)
}
