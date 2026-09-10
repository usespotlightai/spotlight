// Package harness answers which of the tools the control plane asks about are
// actually here, and which models each of them says it can answer with.
package harness

import (
	"context"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"usespotlight.ai/runner/internal/protocol"
)

// A model id as a CLI prints it: the first token of a line, lowercase, no
// spaces. Anything else on the line (a header, a table column, an error) is not
// one, so it is left out rather than guessed at.
var modelID = regexp.MustCompile(`^[a-z0-9][a-z0-9._:@/-]*$`)

// discoveryTimeout caps a single model listing: a CLI that hangs or waits on a
// prompt must not hold up registration.
const discoveryTimeout = 15 * time.Second

// Installed looks for each executable and answers with the ones it found, each
// with the models it could discover for it. The names come from the control
// plane, so the runner needs to know nothing about what any of them are.
func Installed(ctx context.Context, candidates []protocol.Installable) []protocol.HarnessReport {
	found := make([]protocol.HarnessReport, 0, len(candidates))

	for _, candidate := range candidates {
		if candidate.Executable == "" || candidate.ID == "" {
			continue
		}

		// The runner's own PATH, which the agent inherits, so what is found
		// here is what the agent can run.
		if _, err := exec.LookPath(candidate.Executable); err != nil {
			continue
		}

		found = append(found, protocol.HarnessReport{
			ID:     candidate.ID,
			Models: discover(ctx, candidate.Discovery),
		})
	}

	return found
}

// discover runs the listing command and reads a model id from each line. Any
// failure — no command, a non-zero exit, a timeout — leaves the list empty, and
// the control plane falls back to what it knows.
func discover(ctx context.Context, command []string) []string {
	if len(command) == 0 {
		return nil
	}

	within, cancel := context.WithTimeout(ctx, discoveryTimeout)
	defer cancel()

	// Inherits the runner's environment, so the same credentials the harness
	// runs with are what the listing is asked under.
	out, err := exec.CommandContext(within, command[0], command[1:]...).Output()
	if err != nil {
		return nil
	}

	var models []string
	seen := make(map[string]struct{})

	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}

		id := fields[0]
		if !modelID.MatchString(id) {
			continue
		}
		if _, had := seen[id]; had {
			continue
		}

		seen[id] = struct{}{}
		models = append(models, id)
	}

	return models
}
