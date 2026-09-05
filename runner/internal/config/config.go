// Package config reads the runner's settings from the environment. Everything
// that differs between a laptop, a container and a cloud sandbox is a value
// here.
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	URL           string
	Token         string
	WorkspaceRoot string
	// MaxRuns is how many runs to serve before exiting. Zero is unlimited.
	MaxRuns int
	// IdleTimeout exits the runner after this long with no work. Zero never
	// exits.
	IdleTimeout time.Duration
	// PrepareHook fills the workspace before the agent starts. Empty skips it.
	PrepareHook string
	PublishHook string
	// HookTimeout bounds each hook. Zero means no limit.
	HookTimeout time.Duration
	// AgentUser is the account to run agents as. Empty runs them as the runner.
	AgentUser string
	// RetireAt stops taking new work at this time. Zero means no deadline.
	RetireAt time.Time
}

// defaultHookTimeout allows for a large clone without holding the lease long.
const defaultHookTimeout = 10 * time.Minute

const (
	envURL         = "SPOTLIGHT_URL"
	envToken       = "SPOTLIGHT_TOKEN"
	envWorkspace   = "SPOTLIGHT_WORKSPACE"
	envMaxRuns     = "SPOTLIGHT_MAX_RUNS"
	envIdleTimeout = "SPOTLIGHT_IDLE_TIMEOUT"
	envRetireAt    = "SPOTLIGHT_RETIRE_AT"
	envAgentUser   = "SPOTLIGHT_AGENT_USER"
	envPrepareHook = "SPOTLIGHT_PREPARE_HOOK"
	envPublishHook = "SPOTLIGHT_PUBLISH_HOOK"
	envHookTimeout = "SPOTLIGHT_HOOK_TIMEOUT"
)

// Load reads the settings, reporting every problem at once. The persisted
// config file is the default for anything the environment does not set.
func Load() (Config, error) {
	var problems []error
	note := func(err error) {
		if err != nil {
			problems = append(problems, err)
		}
	}

	saved, err := Read()
	if err != nil {
		return Config{}, fmt.Errorf("read %s: %w", Path(), err)
	}
	// A blank var (an unset compose variable expands to one) falls to the file.
	get := func(key string) string {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
		return strings.TrimSpace(saved[key])
	}

	cfg := Config{
		URL:           get(envURL),
		Token:         get(envToken),
		WorkspaceRoot: get(envWorkspace),
		AgentUser:     get(envAgentUser),
		PrepareHook:   get(envPrepareHook),
		PublishHook:   get(envPublishHook),
	}

	for _, required := range []struct {
		name, value string
	}{
		{envURL, cfg.URL},
		{envToken, cfg.Token},
	} {
		if required.value == "" {
			note(fmt.Errorf("%s is required", required.name))
		}
	}

	if cfg.WorkspaceRoot == "" {
		cfg.WorkspaceRoot = defaultWorkspaceRoot()
	}

	cfg.MaxRuns, err = parseCount(get(envMaxRuns))
	note(err)

	cfg.IdleTimeout, err = parseDuration(get(envIdleTimeout))
	note(err)

	cfg.RetireAt, err = parseEpoch(get(envRetireAt))
	note(err)

	cfg.HookTimeout, err = parseDuration(get(envHookTimeout))
	note(err)
	if cfg.HookTimeout == 0 {
		cfg.HookTimeout = defaultHookTimeout
	}

	for _, hook := range []struct{ name, path string }{
		{envPrepareHook, cfg.PrepareHook},
		{envPublishHook, cfg.PublishHook},
	} {
		if hook.path == "" {
			continue
		}
		if info, statErr := os.Stat(hook.path); statErr != nil || info.IsDir() {
			note(fmt.Errorf("%s: %q is not an executable file", hook.name, hook.path))
		}
	}

	return cfg, errors.Join(problems...)
}

func defaultWorkspaceRoot() string {
	return filepath.Join(os.TempDir(), "spotlight")
}

func parseCount(raw string) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return 0, nil
	}

	count, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || count < 0 {
		return 0, fmt.Errorf("%s: %q is not a count", envMaxRuns, raw)
	}

	return count, nil
}

func parseDuration(raw string) (time.Duration, error) {
	if strings.TrimSpace(raw) == "" {
		return 0, nil
	}

	parsed, err := time.ParseDuration(strings.TrimSpace(raw))
	if err != nil || parsed < 0 {
		return 0, fmt.Errorf("%q is not a duration such as 30m", raw)
	}

	return parsed, nil
}

func parseEpoch(raw string) (time.Time, error) {
	if strings.TrimSpace(raw) == "" {
		return time.Time{}, nil
	}

	seconds, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || seconds <= 0 {
		return time.Time{}, fmt.Errorf("%s: %q is not epoch seconds", envRetireAt, raw)
	}

	return time.Unix(seconds, 0).UTC(), nil
}
