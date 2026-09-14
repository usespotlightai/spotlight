package harness

import (
	"context"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"usespotlight.ai/runner/internal/protocol"
)

var modelID = regexp.MustCompile(`^[a-z0-9][a-z0-9._:@/-]*$`)

const discoveryTimeout = 15 * time.Second

func Installed(ctx context.Context, candidates []protocol.Installable) []protocol.HarnessReport {
	found := make([]protocol.HarnessReport, 0, len(candidates))

	for _, candidate := range candidates {
		if candidate.Executable == "" || candidate.ID == "" {
			continue
		}

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

func discover(ctx context.Context, command []string) []string {
	if len(command) == 0 {
		return nil
	}

	within, cancel := context.WithTimeout(ctx, discoveryTimeout)
	defer cancel()

	// Inherits the runner's env, so listing runs under the harness's own credentials.
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
