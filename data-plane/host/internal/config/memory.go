package config

import (
	"fmt"
	"strings"
)

const (
	NoMemoryLimit      = "none"
	LeastSandboxMemory = 6 * mebibyte
	HostHeadroom       = 2 * gibibyte
)

func parseSandboxMemory(raw string) (int64, error) {
	if strings.EqualFold(raw, NoMemoryLimit) {
		return 0, nil
	}

	memory, err := ParseSize(raw)
	if err != nil {
		return 0, fmt.Errorf("%w, or %s", err, NoMemoryLimit)
	}
	if memory < LeastSandboxMemory {
		return 0, fmt.Errorf("%q is below Docker's least limit, %s", raw, FormatSize(LeastSandboxMemory))
	}
	return memory, nil
}

// SuggestedSandboxMemory shares the runtime's memory, less the host's headroom, between the sandboxes.
// It rounds down to whole mebibytes.
func SuggestedSandboxMemory(runtimeMemory int64, sandboxes int) string {
	if sandboxes < 1 {
		return ""
	}
	share := (runtimeMemory - HostHeadroom) / int64(sandboxes) / mebibyte * mebibyte
	if share < LeastSandboxMemory {
		return ""
	}
	return FormatSize(share)
}
