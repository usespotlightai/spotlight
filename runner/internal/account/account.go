package account

import (
	"fmt"
	"os"
	"os/user"
	"strconv"
	"strings"
	"syscall"
)

// User is the account the agent runs as. A separate account is what makes the
// separation real: the runner's environment, token and files stop being
// readable through /proc or the filesystem, not just absent from what the
// agent is handed.
type User struct {
	UID uint32
	GID uint32
	// An agent CLI reads its configuration from HOME and runs commands through
	// SHELL, so an agent given neither is refused by its own tools.
	Name  string
	Home  string
	Shell string
}

// LookupUser resolves the account the agent should run as. An empty name runs
// it as the runner, which is all an unprivileged host can do: dropping to
// another user needs root.
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

	uid, err := strconv.ParseUint(found.Uid, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("agent user %q has a non-numeric uid %q", name, found.Uid)
	}
	gid, err := strconv.ParseUint(found.Gid, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("agent user %q has a non-numeric gid %q", name, found.Gid)
	}

	return &User{
		UID:   uint32(uid),
		GID:   uint32(gid),
		Name:  found.Username,
		Home:  found.HomeDir,
		Shell: shellOf(found.Username),
	}, nil
}

// SysProcAttr drops a process to this account, in its own process group so
// the whole tree can be signalled at once.
func (u *User) SysProcAttr() *syscall.SysProcAttr {
	if u == nil {
		return nil
	}
	return &syscall.SysProcAttr{
		Setpgid:    true,
		Credential: &syscall.Credential{Uid: u.UID, Gid: u.GID},
	}
}

// DefaultShell is what an account with none recorded is given. Something has
// to answer, or every command the agent runs fails before it starts.
const DefaultShell = "/bin/sh"

// shellOf reads the account's login shell, which os/user does not carry.
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
