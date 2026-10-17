package serve

import (
	"slices"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestLeavesEveryHarnessKeyItKnowsWithEgressWhateverTheControlPlaneSays(t *testing.T) {
	env, harnessKeys := standInsFor([]string{
		"ANTHROPIC_API_KEY=sk-ant-api",
		"CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat",
		"CODEX_API_KEY=",
		"OPENAI_API_KEY=sk-openai",
		"CURSOR_API_KEY=cursor",
		"GIT_AUTHOR=spotlight",
	})

	if !slices.Equal(env, []string{
		"ANTHROPIC_API_KEY=spotlight-egress:ANTHROPIC_API_KEY",
		"CLAUDE_CODE_OAUTH_TOKEN=spotlight-egress:CLAUDE_CODE_OAUTH_TOKEN",
		"CODEX_API_KEY=",
		"OPENAI_API_KEY=spotlight-egress:OPENAI_API_KEY",
		"CURSOR_API_KEY=cursor",
		"GIT_AUTHOR=spotlight",
	}) {
		t.Errorf("the sandbox gets %v", env)
	}

	if !slices.Equal(harnessKeys, []protocol.HarnessKey{
		{Name: "ANTHROPIC_API_KEY", Host: "api.anthropic.com", Header: "x-api-key", Value: "sk-ant-api"},
		{Name: "CLAUDE_CODE_OAUTH_TOKEN", Host: "api.anthropic.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-ant-oat"},
		{Name: "OPENAI_API_KEY", Host: "api.openai.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-openai"},
	}) {
		t.Errorf("egress has %+v", harnessKeys)
	}
}
