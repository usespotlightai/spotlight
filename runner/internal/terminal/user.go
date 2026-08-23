package terminal

import (
	"fmt"
	"os"
	"os/user"
	"strconv"
	"syscall"
)

// User is the account the agent runs as. Running it as someone other than the
// runner is what makes the separation real: the runner's environment, its
// control plane token and its files stop being readable through /proc or the
// filesystem, rather than merely being scrubbed from what it is handed.
type User struct {
	UID uint32
	GID uint32
}

// LookupUser resolves the account the agent should run as. An empty name means
// the agent runs as the runner does, which is what a laptop wants: dropping to
// another user needs root, and nobody runs their own machine that way.
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

	return &User{UID: uint32(uid), GID: uint32(gid)}, nil
}

func (u *User) sysProcAttr() *syscall.SysProcAttr {
	if u == nil {
		return nil
	}
	return &syscall.SysProcAttr{
		Credential: &syscall.Credential{Uid: u.UID, Gid: u.GID},
	}
}
