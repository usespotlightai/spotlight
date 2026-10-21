package config

import (
	"fmt"
	"regexp"
	"slices"
	"strings"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/telemetry"
)

type Setting struct {
	Key    string
	Env    string
	Live   bool
	Secret bool
}

var Settings = []Setting{
	{Key: "url", Env: envURL},
	{Key: "token", Env: envPoolToken, Secret: true},
	{Key: "trust", Env: envTrust},
	{Key: "oidc-token-file", Env: envTokenFile},
	{Key: "name", Env: envName, Live: true},
	{Key: "capacity", Env: envCapacity, Live: true},
	{Key: "image", Env: envImage, Live: true},
	{Key: "registry-config", Env: envRegistry},
	{Key: "run-timeout", Env: envRunTimeout, Live: true},
	{Key: "answer-wait", Env: protocol.AnswerWaitVar, Live: true},
	{Key: "sandbox-url", Env: envSandboxURL, Live: true},
	{Key: "sandbox-env", Env: envSandboxEnv, Live: true},
	{Key: "sandbox-pass", Env: envPass, Live: true},
	{Key: "sandbox-network", Env: envNetwork, Live: true},
	{Key: "sandbox-hosts", Env: envHosts, Live: true},
	{Key: "egress-image", Env: envEgressImg, Live: true},
	{Key: "egress-allow", Env: envEgressOK, Live: true},
	{Key: "egress-secret-allow", Env: envSecretAllow, Live: true},
	{Key: "egress-env", Env: envEgressEnv, Live: true},
	{Key: "egress-pass", Env: envEgressPass, Live: true},
	{Key: "egress-ca-bundle", Env: envCABundle, Live: true},
	{Key: "auto-update", Env: envAutoUpdate, Live: true},
	{Key: "log-level", Env: "LOG_LEVEL"},
	{Key: "state", Env: envState},
	{Key: "docker-host", Env: envDocker},
	{Key: "releases-url", Env: envReleases},
	{Key: "health-addr", Env: telemetry.HealthVar},
	{Key: "sentry-dsn", Env: "SENTRY_DSN"},
	{Key: "sentry-environment", Env: "SENTRY_ENVIRONMENT"},
	{Key: "traces-sampler", Env: telemetry.SamplerVar},
	{Key: "traces-sampler-arg", Env: telemetry.SamplerArgVar},
}

var variable = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)

// Lookup takes a friendly key or a variable name. A variable the table does not name only applies at a restart.
func Lookup(key string) (Setting, error) {
	for _, setting := range Settings {
		if key == setting.Key || key == setting.Env {
			return setting, nil
		}
	}
	if variable.MatchString(key) {
		return Setting{Key: key, Env: key}, nil
	}

	return Setting{}, fmt.Errorf("%q is not a host setting; `spotlight host config keys` lists them", key)
}

func KeyOf(env string) string {
	for _, setting := range Settings {
		if setting.Env == env {
			return setting.Key
		}
	}
	return env
}

func Mask(value string) string {
	if len(value) <= 8 {
		return "••••"
	}
	return "••••" + value[len(value)-4:]
}

// Friendly names the friendly key in place of each variable in an error from Parse.
func Friendly(err error) error {
	if err == nil {
		return nil
	}
	longestFirst := slices.SortedFunc(slices.Values(Settings), func(a, b Setting) int { return len(b.Env) - len(a.Env) })
	pairs := make([]string, 0, 2*len(Settings))
	for _, setting := range longestFirst {
		pairs = append(pairs, setting.Env, setting.Key)
	}
	return fmt.Errorf("%s", strings.NewReplacer(pairs...).Replace(err.Error()))
}
