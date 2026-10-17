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
	URL        string
	Token      string
	Handed     string
	Workspace  string
	AgentUser  string
	Author     prepare.Author
	AnswerWait time.Duration
	Egress     Egress
}

type Egress struct {
	URL        string
	Credential string
	Direct     bool
}

func (e Egress) Given() bool { return e.URL != "" }

func (c Config) WasHanded() bool { return c.Handed != "" }

const (
	DefaultWorkspace   = "/workspace"
	defaultAuthorName  = "Spotlight"
	defaultAuthorEmail = "noreply@usespotlight.ai"
)

const usage = "usage: spotlight runner [harnesses <json>]"

const (
	envURL         = "SPOTLIGHT_URL"
	envToken       = "SPOTLIGHT_TOKEN"
	envHanded      = "SPOTLIGHT_HANDED"
	envWorkspace   = "SPOTLIGHT_WORKSPACE"
	envAgentUser   = "SPOTLIGHT_AGENT_USER"
	envAuthorName  = "SPOTLIGHT_GIT_AUTHOR_NAME"
	envAuthorEmail = "SPOTLIGHT_GIT_AUTHOR_EMAIL"
	envAnswerWait  = protocol.AnswerWaitVar
	envEgressURL   = protocol.EgressURLVar
	envCredential  = protocol.EgressCredentialVar
	envTraffic     = protocol.EgressTrafficVar
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
		URL:       get(envURL),
		Token:     get(envToken),
		Handed:    get(envHanded),
		Workspace: get(envWorkspace),
		AgentUser: get(envAgentUser),
		Author: prepare.Author{
			Name:  or(get(envAuthorName), defaultAuthorName),
			Email: or(get(envAuthorEmail), defaultAuthorEmail),
		},
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

	cfg.Workspace = or(cfg.Workspace, DefaultWorkspace)

	if cfg.Token != "" {
		cfg.Egress = Egress{URL: get(envEgressURL), Credential: get(envCredential)}
		switch {
		case (cfg.Egress.URL == "") != (cfg.Egress.Credential == ""):
			note(fmt.Errorf("%s and %s go together; give both or neither", envEgressURL, envCredential))
		case cfg.Egress.Given():
			direct, err := directFrom(get(envTraffic))
			note(err)
			cfg.Egress.Direct = direct
		}
	}

	if raw := get(envAnswerWait); raw != "" {
		wait, err := time.ParseDuration(raw)
		if err != nil || wait < 0 {
			note(fmt.Errorf("%s: %q is not a duration such as 5m, or 0 to park at once", envAnswerWait, raw))
		} else {
			cfg.AnswerWait = wait
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
