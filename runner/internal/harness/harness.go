// Package harness answers which of the tools the control plane asks about are
// actually here.
package harness

import (
	"os/exec"

	"usespotlight.ai/runner/internal/protocol"
)

// Installed looks for each executable and answers with the ids it found. The
// names come from the control plane, so the runner needs to know nothing about
// what any of them are.
func Installed(candidates []protocol.Installable) []string {
	found := make([]string, 0, len(candidates))

	for _, candidate := range candidates {
		if candidate.Executable == "" || candidate.ID == "" {
			continue
		}

		// The runner's own PATH, which the agent inherits, so what is found
		// here is what the agent can run.
		if _, err := exec.LookPath(candidate.Executable); err != nil {
			continue
		}

		found = append(found, candidate.ID)
	}

	return found
}
