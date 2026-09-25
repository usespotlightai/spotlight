package config

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Config struct {
	URL           string
	Token         string
	Handed        string
	WorkspaceRoot string
	PrepareHook   string
	PublishHook   string
	HookTimeout   time.Duration
	AgentUser     string
}

func (c Config) WasHanded() bool { return c.Handed != "" }

const defaultHookTimeout = 10 * time.Minute

const usage = "usage: runner [harnesses]"

const (
	envURL         = "SPOTLIGHT_URL"
	envToken       = "SPOTLIGHT_TOKEN"
	envHanded      = "SPOTLIGHT_HANDED"
	envWorkspace   = "SPOTLIGHT_WORKSPACE"
	envAgentUser   = "SPOTLIGHT_AGENT_USER"
	envPrepareHook = "SPOTLIGHT_PREPARE_HOOK"
	envPublishHook = "SPOTLIGHT_PUBLISH_HOOK"
	envHookTimeout = "SPOTLIGHT_HOOK_TIMEOUT"
)

func Load(args []string) (Config, error) {
	flags := flag.NewFlagSet("runner", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	if err := flags.Parse(args); err != nil || flags.NArg() > 0 {
		return Config{}, errors.New(usage)
	}

	var problems []error
	note := func(err error) {
		if err != nil {
			problems = append(problems, err)
		}
	}

	get := func(key string) string { return strings.TrimSpace(os.Getenv(key)) }

	cfg := Config{
		URL:           get(envURL),
		Token:         get(envToken),
		Handed:        get(envHanded),
		WorkspaceRoot: get(envWorkspace),
		AgentUser:     get(envAgentUser),
		PrepareHook:   get(envPrepareHook),
		PublishHook:   get(envPublishHook),
	}

	if cfg.URL == "" {
		note(fmt.Errorf("%s is required", envURL))
	}

	switch {
	case cfg.Token != "" && cfg.Handed != "":
		note(fmt.Errorf("%s and %s are different ways to be given work; give one", envToken, envHanded))
	case cfg.Token == "" && cfg.Handed == "":
		note(fmt.Errorf(
			"%s names the work a host handed this runner, or %s is the one-run credential a push pool provisioned it with",
			envHanded, envToken,
		))
	}

	if cfg.WorkspaceRoot == "" {
		cfg.WorkspaceRoot = defaultWorkspaceRoot()
	}

	var err error
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

func parseDuration(raw string) (time.Duration, error) {
	if raw == "" {
		return 0, nil
	}

	parsed, err := time.ParseDuration(raw)
	if err != nil || parsed < 0 {
		return 0, fmt.Errorf("%s: %q is not a duration such as 30m", envHookTimeout, raw)
	}

	return parsed, nil
}
