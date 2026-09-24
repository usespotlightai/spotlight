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
	Workload      Workload
	WorkspaceRoot string
	MaxRuns       int
	IdleTimeout   time.Duration
	PrepareHook   string
	PublishHook   string
	HookTimeout   time.Duration
	AgentUser     string
	RetireAt      time.Time
}

type Workload struct {
	TokenFile string
	Trust     string
	Name      string
}

func (w Workload) Enrols() bool { return w.TokenFile != "" }

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
	envTokenFile   = "SPOTLIGHT_RUNNER_OIDC_TOKEN_FILE"
	envTrust       = "SPOTLIGHT_RUNNER_TRUST"
	envName        = "SPOTLIGHT_RUNNER_NAME"
)

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
		Workload: Workload{
			TokenFile: get(envTokenFile),
			Trust:     get(envTrust),
			Name:      get(envName),
		},
	}

	if cfg.URL == "" {
		note(fmt.Errorf("%s is required", envURL))
	}

	switch {
	case cfg.Token != "" && cfg.Workload.Enrols():
		note(fmt.Errorf("%s and %s are two ways to enrol; give one", envToken, envTokenFile))
	case cfg.Workload.Enrols() && cfg.Workload.Trust == "":
		note(fmt.Errorf("%s names the runner trust to enrol through, and is required with %s", envTrust, envTokenFile))
	case cfg.Token == "" && !cfg.Workload.Enrols():
		note(fmt.Errorf("%s is required, or %s and %s to enrol as a platform workload", envToken, envTokenFile, envTrust))
	}

	if cfg.Workload.Enrols() && cfg.Workload.Name == "" {
		cfg.Workload.Name, err = os.Hostname()
		note(err)
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
