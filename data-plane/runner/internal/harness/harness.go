package harness

import (
	"context"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"usespotlight.ai/data-plane/internal/protocol"
)

var (
	modelID      = regexp.MustCompile(`^[a-z0-9][a-z0-9._:@/-]*$`)
	versionToken = regexp.MustCompile(`^v?[0-9]+(\.[0-9A-Za-z-]+)*$`)
)

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
			ID:      candidate.ID,
			Models:  discover(ctx, candidate.Discovery),
			Version: version(ctx, candidate.VersionProbe),
		})
	}

	return found
}

func output(ctx context.Context, command []string) string {
	if len(command) == 0 {
		return ""
	}

	within, cancel := context.WithTimeout(ctx, discoveryTimeout)
	defer cancel()

	out, err := exec.CommandContext(within, command[0], command[1:]...).Output()
	if err != nil {
		return ""
	}

	return string(out)
}

func version(ctx context.Context, command []string) string {
	for _, token := range strings.Fields(output(ctx, command)) {
		if versionToken.MatchString(token) {
			return strings.TrimPrefix(token, "v")
		}
	}

	return ""
}

func discover(ctx context.Context, command []string) []string {
	var models []string
	seen := make(map[string]struct{})

	for _, line := range strings.Split(output(ctx, command), "\n") {
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
