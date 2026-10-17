package serve

import (
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

type harnessKey struct {
	host   string
	header string
	prefix string
}

var knownHarnessKeys = map[string]harnessKey{
	"ANTHROPIC_API_KEY":       {host: "api.anthropic.com", header: "x-api-key"},
	"CLAUDE_CODE_OAUTH_TOKEN": {host: "api.anthropic.com", header: "authorization", prefix: "Bearer "},
	"OPENAI_API_KEY":          {host: "api.openai.com", header: "authorization", prefix: "Bearer "},
	"CODEX_API_KEY":           {host: "api.openai.com", header: "authorization", prefix: "Bearer "},
}

func standInsFor(sandboxEnv []string) ([]string, []protocol.HarnessKey) {
	env := make([]string, 0, len(sandboxEnv))
	var keys []protocol.HarnessKey

	for _, entry := range sandboxEnv {
		name, value, _ := strings.Cut(entry, "=")
		key, known := knownHarnessKeys[name]
		if !known || value == "" {
			env = append(env, entry)
			continue
		}

		env = append(env, name+"="+protocol.StandInPrefix+name)
		keys = append(keys, protocol.HarnessKey{
			Name: name, Host: key.host, Header: key.header, Prefix: key.prefix, Value: value,
		})
	}

	return env, keys
}
