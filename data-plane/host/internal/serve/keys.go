package serve

import (
	"slices"
	"strings"

	"usespotlight.ai/data-plane/host/internal/harnesses"

	"usespotlight.ai/data-plane/protocol"
)

func standInsFor(sandboxEnv []string) ([]string, []protocol.HarnessKey) {
	env := make([]string, 0, len(sandboxEnv))
	var keys []protocol.HarnessKey

	for _, entry := range sandboxEnv {
		name, value, _ := strings.Cut(entry, "=")
		key, known := harnesses.KeyNamed(name)
		if !known || value == "" {
			env = append(env, entry)
			continue
		}

		env = append(env, name+"="+protocol.StandInPrefix+name)
		keys = append(keys, protocol.HarnessKey{
			Name: name, Host: key.Host, Header: key.Header, Prefix: key.Prefix, Value: value,
		})
	}

	return env, keys
}

func withWorkspaceKeys(env, held []string) []string {
	given := map[string]string{}
	for _, entry := range env {
		name, value, _ := strings.Cut(entry, "=")
		given[name] = value
	}
	wanted := map[string]string{}
	for _, name := range held {
		if given[name] == "" {
			wanted[name] = protocol.StandInPrefix + name
		}
	}
	wanted = protocol.WithoutShadowedHarnessKeys(wanted, func(name string) string { return given[name] })

	for _, name := range held {
		if standIn, ok := wanted[name]; ok {
			env = append(slices.DeleteFunc(env, func(entry string) bool { return strings.HasPrefix(entry, name+"=") }), name+"="+standIn)
			delete(wanted, name)
		}
	}
	return env
}
