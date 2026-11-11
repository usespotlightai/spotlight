package account

import (
	"fmt"
	"os"
	"os/user"
	"strconv"
	"strings"
	"syscall"
)

type User struct {
	UID   uint32
	GID   uint32
	Name  string
	Home  string
	Shell string
}

func LookupUser(name string) (*User, error) {
	if name == "" {
		return nil, nil
	}

	if os.Getuid() != 0 {
		return nil, fmt.Errorf(
			"running the agent as %q needs root, but the runner is uid %d",
			name, os.Getuid(),
		)
	}

	found, err := user.Lookup(name)
	if err != nil {
		return nil, fmt.Errorf("agent user %q: %w", name, err)
	}

	uid, err := strconv.ParseUint(found.Uid, 10, 31)
	if err != nil {
		return nil, fmt.Errorf("agent user %q has a uid %q that is not a number below 2^31", name, found.Uid)
	}
	gid, err := strconv.ParseUint(found.Gid, 10, 31)
	if err != nil {
		return nil, fmt.Errorf("agent user %q has a gid %q that is not a number below 2^31", name, found.Gid)
	}

	return &User{
		UID:   uint32(uid),
		GID:   uint32(gid),
		Name:  found.Username,
		Home:  found.HomeDir,
		Shell: shellOf(found.Username),
	}, nil
}

func (u *User) SysProcAttr() *syscall.SysProcAttr {
	if u == nil {
		return nil
	}
	return &syscall.SysProcAttr{
		Setpgid:    true,
		Credential: &syscall.Credential{Uid: u.UID, Gid: u.GID},
	}
}

const DefaultShell = "/bin/sh"

func shellOf(name string) string {
	passwd, err := os.ReadFile("/etc/passwd")
	if err != nil {
		return DefaultShell
	}

	for _, line := range strings.Split(string(passwd), "\n") {
		fields := strings.Split(line, ":")
		if len(fields) < 7 || fields[0] != name {
			continue
		}

		if shell := strings.TrimSpace(fields[6]); shell != "" {
			return shell
		}
	}

	return DefaultShell
}
