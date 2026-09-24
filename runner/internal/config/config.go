package config

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	URL           string
	Token         string
	PoolToken     string
	Workload      Workload
	Once          bool
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

const (
	defaultHookTimeout = 10 * time.Minute
	defaultOnceIdle    = 5 * time.Minute
)

const usage = "usage: runner [--once]"

const (
	envURL         = "SPOTLIGHT_URL"
	envToken       = "SPOTLIGHT_TOKEN"
	envPoolToken   = "SPOTLIGHT_POOL_TOKEN"
	envOnce        = "SPOTLIGHT_ONCE"
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

func Load(args []string) (Config, error) {
	flags := flag.NewFlagSet("runner", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	once := flags.Bool("once", false, "handle one run or check, then exit")
	if err := flags.Parse(args); err != nil || flags.NArg() > 0 {
		return Config{}, errors.New(usage)
	}

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
		PoolToken:     get(envPoolToken),
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

	cfg.Once, err = parseSwitch(envOnce, get(envOnce))
	note(err)
	cfg.Once = cfg.Once || *once

	note(credential(cfg))

	if cfg.Workload.Enrols() && cfg.Workload.Name == "" {
		cfg.Workload.Name, err = os.Hostname()
		note(err)
	}

	if cfg.WorkspaceRoot == "" {
		cfg.WorkspaceRoot = defaultWorkspaceRoot()
	}

	cfg.MaxRuns, err = parseCount(get(envMaxRuns))
	note(err)

	idle := get(envIdleTimeout)
	cfg.IdleTimeout, err = parseDuration(idle)
	note(err)
	if idle == "" && cfg.Once {
		cfg.IdleTimeout = defaultOnceIdle
	}

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

func credential(cfg Config) error {
	var given []string
	for _, credential := range []struct {
		name  string
		given bool
	}{
		{envToken, cfg.Token != ""},
		{envPoolToken, cfg.PoolToken != ""},
		{envTokenFile, cfg.Workload.Enrols()},
	} {
		if credential.given {
			given = append(given, credential.name)
		}
	}

	switch {
	case len(given) > 1:
		return fmt.Errorf("%s are different ways to connect; give one", strings.Join(given, " and "))
	case len(given) == 0:
		return fmt.Errorf(
			"%s is required, or %s with --once to claim from a pool, or %s and %s to enrol as a platform workload",
			envToken, envPoolToken, envTokenFile, envTrust,
		)
	case cfg.Workload.Enrols() && cfg.Workload.Trust == "":
		return fmt.Errorf("%s names the runner trust to enrol through, and is required with %s", envTrust, envTokenFile)
	case cfg.PoolToken != "" && !cfg.Once:
		return fmt.Errorf("a pool token claims one piece of work, so run with --once or %s=true", envOnce)
	}

	return nil
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

func parseSwitch(name, raw string) (bool, error) {
	if strings.TrimSpace(raw) == "" {
		return false, nil
	}

	on, err := strconv.ParseBool(strings.TrimSpace(raw))
	if err != nil {
		return false, fmt.Errorf("%s: %q is not true or false", name, raw)
	}

	return on, nil
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
