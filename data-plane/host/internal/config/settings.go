package config

import (
	"fmt"
	"regexp"
	"slices"
	"strings"

	"usespotlight.ai/data-plane/telemetry"
)

type Setting struct {
	Key    string
	Env    string
	Group  string
	Live   bool
	Secret bool
}

const (
	GroupConnection = "connection"
	GroupSandboxes  = "sandboxes"
	GroupEgress     = "egress"
	GroupHost       = "host"
	GroupTelemetry  = "telemetry"
	GroupOther      = "other"
)

var Groups = []string{GroupConnection, GroupSandboxes, GroupEgress, GroupHost, GroupTelemetry, GroupOther}

var Settings = []Setting{
	{Key: "url", Env: envURL, Group: GroupConnection},
	{Key: "token", Env: envPoolToken, Group: GroupConnection, Secret: true},
	{Key: "trust", Env: envTrust, Group: GroupConnection},
	{Key: "oidc-token-file", Env: envTokenFile, Group: GroupConnection},
	{Key: "name", Env: envName, Group: GroupConnection, Live: true},
	{Key: "capacity", Env: envCapacity, Group: GroupSandboxes, Live: true},
	{Key: "image", Env: envImage, Group: GroupSandboxes, Live: true},
	{Key: "registry-config", Env: envRegistry, Group: GroupSandboxes},
	{Key: "run-timeout", Env: envRunTimeout, Group: GroupSandboxes, Live: true},
	{Key: "sandbox-url", Env: envSandboxURL, Group: GroupSandboxes, Live: true},
	{Key: "sandbox-env", Env: envSandboxEnv, Group: GroupSandboxes, Live: true},
	{Key: "sandbox-pass", Env: envPass, Group: GroupSandboxes, Live: true},
	{Key: "sandbox-network", Env: envNetwork, Group: GroupSandboxes, Live: true},
	{Key: "sandbox-hosts", Env: envHosts, Group: GroupSandboxes, Live: true},
	{Key: "egress-image", Env: envEgressImg, Group: GroupEgress, Live: true},
	{Key: "egress-allow", Env: envEgressOK, Group: GroupEgress, Live: true},
	{Key: "egress-secret-allow", Env: envSecretAllow, Group: GroupEgress, Live: true},
	{Key: "egress-env", Env: envEgressEnv, Group: GroupEgress, Live: true},
	{Key: "egress-pass", Env: envEgressPass, Group: GroupEgress, Live: true},
	{Key: "egress-ca-bundle", Env: envCABundle, Group: GroupEgress, Live: true},
	{Key: "auto-update", Env: envAutoUpdate, Group: GroupHost, Live: true},
	{Key: "log-level", Env: "LOG_LEVEL", Group: GroupHost},
	{Key: "state", Env: envState, Group: GroupHost},
	{Key: "docker-host", Env: envDocker, Group: GroupHost},
	{Key: "releases-url", Env: envReleases, Group: GroupHost},
	{Key: "health-addr", Env: telemetry.HealthVar, Group: GroupHost},
	{Key: "sentry-dsn", Env: "SENTRY_DSN", Group: GroupTelemetry},
	{Key: "sentry-environment", Env: "SENTRY_ENVIRONMENT", Group: GroupTelemetry},
	{Key: "traces-sampler", Env: telemetry.SamplerVar, Group: GroupTelemetry},
	{Key: "traces-sampler-arg", Env: telemetry.SamplerArgVar, Group: GroupTelemetry},
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
		return Setting{Key: key, Env: key, Group: GroupOther}, nil
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

// Others names the variables in values that the table does not name, in order.
func Others(values map[string]string) []string {
	var others []string
	for env := range values {
		if KeyOf(env) == env {
			others = append(others, env)
		}
	}
	slices.Sort(others)
	return others
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
