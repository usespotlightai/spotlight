package account

import (
	"os"
	"strings"
)

// Never inherited: the agent can read its own env, and the runner's token is here.
const runnerOnly = "SPOTLIGHT_"

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

	// Containers carry no SHELL, and agent CLIs refuse to run without one.
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
