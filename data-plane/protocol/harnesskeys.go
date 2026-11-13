package protocol

import "slices"

type HarnessKeyBinding struct {
	Name   string
	Host   string
	Header string
	Prefix string
}

var harnessKeyBindings = []HarnessKeyBinding{
	{Name: "CLAUDE_CODE_OAUTH_TOKEN", Host: "api.anthropic.com", Header: "authorization", Prefix: "Bearer "},
	{Name: "ANTHROPIC_API_KEY", Host: "api.anthropic.com", Header: "x-api-key"},
	{Name: "OPENAI_API_KEY", Host: "api.openai.com", Header: "authorization", Prefix: "Bearer "},
	{Name: "CODEX_API_KEY", Host: "api.openai.com", Header: "authorization", Prefix: "Bearer "},
	{Name: "CURSOR_API_KEY", Host: "api2.cursor.sh", Header: "authorization", Prefix: "Bearer "},
	{Name: "OPENROUTER_API_KEY", Host: "openrouter.ai", Header: "authorization", Prefix: "Bearer "},
}

func HarnessKeyBindingOf(name string) (HarnessKeyBinding, bool) {
	at := slices.IndexFunc(harnessKeyBindings, func(each HarnessKeyBinding) bool { return each.Name == name })
	if at < 0 {
		return HarnessKeyBinding{}, false
	}
	return harnessKeyBindings[at], true
}

func WithoutShadowedHarnessKeys(env map[string]string, outer func(string) string) map[string]string {
	hostHeld := map[string]bool{}
	for _, each := range harnessKeyBindings {
		if outer(each.Name) == StandInPrefix+each.Name {
			hostHeld[each.Host] = true
		}
	}

	kept := make(map[string]string, len(env))
	for name, value := range env {
		binding, known := HarnessKeyBindingOf(name)
		if known && value == StandInPrefix+name && hostHeld[binding.Host] && outer(name) != value {
			continue
		}
		kept[name] = value
	}
	return kept
}
