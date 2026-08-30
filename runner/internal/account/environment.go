package account

import (
	"os"
	"strings"
)

// runnerOnly are the variables the agent must never inherit, including the
// runner's control plane token: an agent with a shell can read its own
// environment. What the agent is meant to have is passed in the spec instead,
// so every variable it sees under this prefix was granted on purpose.
const runnerOnly = "SPOTLIGHT_"

// theRunners are the variables that describe whoever started the runner. An
// agent running as its own account must be told about that account instead.
var theRunners = []string{"HOME=", "USER=", "LOGNAME=", "SHELL="}

func Environment(extra map[string]string, as *User) []string {
	env := make([]string, 0, len(os.Environ())+len(extra)+5)

	for _, entry := range os.Environ() {
		if strings.HasPrefix(entry, runnerOnly) {
			continue
		}
		if as != nil && startsWithAny(entry, theRunners) {
			continue
		}

		env = append(env, entry)
	}

	if as != nil {
		env = append(env,
			"HOME="+as.Home,
			"USER="+as.Name,
			"LOGNAME="+as.Name,
			"SHELL="+as.Shell,
		)
	}

	// A container carries no SHELL of its own, and an agent CLI that finds
	// none refuses to run anything at all.
	if as == nil && os.Getenv("SHELL") == "" {
		env = append(env, "SHELL="+DefaultShell)
	}

	env = append(env, "TERM=xterm-256color", "COLORTERM=truecolor")
	for key, value := range extra {
		env = append(env, key+"="+value)
	}

	return env
}

func startsWithAny(entry string, prefixes []string) bool {
	for _, prefix := range prefixes {
		if strings.HasPrefix(entry, prefix) {
			return true
		}
	}

	return false
}
