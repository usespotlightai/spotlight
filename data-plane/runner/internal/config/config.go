package config

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/prepare"
)

type Config struct {
	URL            string
	Token          string
	AssignmentFile string
	Workspace      string
	AgentUser      string
	Author         prepare.Author
	RunTimeout     time.Duration
	BackgroundWait time.Duration
	Egress         Egress
}

type Egress struct {
	URL        string
	Credential string
	Direct     bool
}

func (e Egress) Configured() bool { return e.URL != "" }

func (c Config) HasAssignmentFile() bool { return c.AssignmentFile != "" }

const (
	DefaultWorkspace      = "/workspace"
	defaultAuthorName     = "Spotlight"
	defaultAuthorEmail    = "noreply@usespotlight.ai"
	defaultBackgroundWait = 30 * time.Minute
)

const usage = "usage: spotlight runner [harnesses <json>]"

const (
	envURL             = "SPOTLIGHT_URL"
	envRunToken        = "SPOTLIGHT_RUN_TOKEN"
	envAssignmentFile  = "SPOTLIGHT_ASSIGNMENT_FILE"
	envWorkspace       = "SPOTLIGHT_WORKSPACE"
	envAgentUser       = "SPOTLIGHT_AGENT_USER"
	envAuthorName      = "SPOTLIGHT_GIT_AUTHOR_NAME"
	envAuthorEmail     = "SPOTLIGHT_GIT_AUTHOR_EMAIL"
	envRunTimeout      = protocol.RunTimeoutVar
	envBackgroundWait  = "SPOTLIGHT_BACKGROUND_WAIT"
	envEgressURL       = protocol.EgressURLVar
	envProxyCredential = protocol.EgressProxyCredentialVar
	envTraffic         = protocol.EgressTrafficVar
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
		URL:            get(envURL),
		Token:          get(envRunToken),
		AssignmentFile: get(envAssignmentFile),
		Workspace:      get(envWorkspace),
		AgentUser:      get(envAgentUser),
		Author: prepare.Author{
			Name:  or(get(envAuthorName), defaultAuthorName),
			Email: or(get(envAuthorEmail), defaultAuthorEmail),
		},
	}

	if cfg.URL == "" {
		note(fmt.Errorf("%s is required", envURL))
	}

	switch {
	case cfg.Token != "" && cfg.AssignmentFile != "":
		note(fmt.Errorf("%s and %s are different ways to get work; set one", envRunToken, envAssignmentFile))
	case cfg.Token == "" && cfg.AssignmentFile == "":
		note(fmt.Errorf(
			"%s names the file with the work a host assigned to this runner, or %s is the one-run credential a push pool provisioned it with",
			envAssignmentFile, envRunToken,
		))
	}

	cfg.Workspace = or(cfg.Workspace, DefaultWorkspace)

	if cfg.Token != "" {
		cfg.Egress = Egress{URL: get(envEgressURL), Credential: get(envProxyCredential)}
		switch {
		case (cfg.Egress.URL == "") != (cfg.Egress.Credential == ""):
			note(fmt.Errorf("%s and %s go together; set both or neither", envEgressURL, envProxyCredential))
		case cfg.Egress.Configured():
			direct, err := directFrom(get(envTraffic))
			note(err)
			cfg.Egress.Direct = direct
		}
	}

	if raw := get(envRunTimeout); raw != "" {
		timeout, err := time.ParseDuration(raw)
		if err != nil || timeout < 0 {
			note(fmt.Errorf("%s: %q is not a duration such as 6h, or 0 for no limit", envRunTimeout, raw))
		} else {
			cfg.RunTimeout = timeout
		}
	}

	cfg.BackgroundWait = defaultBackgroundWait
	if raw := get(envBackgroundWait); raw != "" {
		wait, err := time.ParseDuration(raw)
		if err != nil || wait < 0 {
			note(fmt.Errorf("%s: %q is not a duration such as 30m, or 0 for no wait", envBackgroundWait, raw))
		} else {
			cfg.BackgroundWait = wait
		}
	}

	return cfg, errors.Join(problems...)
}

func or(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func directFrom(traffic string) (bool, error) {
	switch traffic {
	case "", protocol.EgressTrafficAll:
		return false, nil
	case protocol.EgressTrafficBound:
		return true, nil
	default:
		return false, fmt.Errorf("%s: %q is not %s or %s", envTraffic, traffic, protocol.EgressTrafficAll, protocol.EgressTrafficBound)
	}
}

type Editor struct {
	Workspace string
	AgentUser string
}

func LoadEditor() Editor {
	return Editor{
		Workspace: or(strings.TrimSpace(os.Getenv(envWorkspace)), DefaultWorkspace),
		AgentUser: strings.TrimSpace(os.Getenv(envAgentUser)),
	}
}
