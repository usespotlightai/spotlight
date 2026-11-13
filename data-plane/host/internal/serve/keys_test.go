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
		"XAI_API_KEY=xai",
		"GIT_AUTHOR=spotlight",
	})

	if !slices.Equal(env, []string{
		"ANTHROPIC_API_KEY=spotlight-egress:ANTHROPIC_API_KEY",
		"CLAUDE_CODE_OAUTH_TOKEN=spotlight-egress:CLAUDE_CODE_OAUTH_TOKEN",
		"CODEX_API_KEY=",
		"OPENAI_API_KEY=spotlight-egress:OPENAI_API_KEY",
		"CURSOR_API_KEY=spotlight-egress:CURSOR_API_KEY",
		"XAI_API_KEY=xai",
		"GIT_AUTHOR=spotlight",
	}) {
		t.Errorf("the sandbox gets %v", env)
	}

	if !slices.Equal(harnessKeys, []protocol.HarnessKey{
		{Name: "ANTHROPIC_API_KEY", Host: "api.anthropic.com", Header: "x-api-key", Value: "sk-ant-api"},
		{Name: "CLAUDE_CODE_OAUTH_TOKEN", Host: "api.anthropic.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-ant-oat"},
		{Name: "OPENAI_API_KEY", Host: "api.openai.com", Header: "authorization", Prefix: "Bearer ", Value: "sk-openai"},
		{Name: "CURSOR_API_KEY", Host: "api2.cursor.sh", Header: "authorization", Prefix: "Bearer ", Value: "cursor"},
	}) {
		t.Errorf("egress has %+v", harnessKeys)
	}
}

func TestTheWorkspaceKeysGetStandInsUnlessTheHostGivesTheName(t *testing.T) {
	env := withWorkspaceKeys([]string{"ANTHROPIC_API_KEY=spotlight-egress:ANTHROPIC_API_KEY"}, []string{"ANTHROPIC_API_KEY", "CURSOR_API_KEY"})

	if !slices.Equal(env, []string{"ANTHROPIC_API_KEY=spotlight-egress:ANTHROPIC_API_KEY", "CURSOR_API_KEY=spotlight-egress:CURSOR_API_KEY"}) {
		t.Errorf("the probe gets %v", env)
	}
}

func TestAnEmptyHostKeyGetsTheWorkspaceStandIn(t *testing.T) {
	env := withWorkspaceKeys([]string{"ANTHROPIC_API_KEY=", "GIT_AUTHOR=spotlight"}, []string{"ANTHROPIC_API_KEY"})

	if !slices.Equal(env, []string{"GIT_AUTHOR=spotlight", "ANTHROPIC_API_KEY=spotlight-egress:ANTHROPIC_API_KEY"}) {
		t.Errorf("the probe gets %v", env)
	}
}

func TestAWorkspaceKeyForAnAPIHostTheHostHoldsAKeyForGetsNoStandIn(t *testing.T) {
	env := withWorkspaceKeys([]string{"OPENAI_API_KEY=spotlight-egress:OPENAI_API_KEY"}, []string{"CODEX_API_KEY", "CURSOR_API_KEY"})

	if !slices.Equal(env, []string{"OPENAI_API_KEY=spotlight-egress:OPENAI_API_KEY", "CURSOR_API_KEY=spotlight-egress:CURSOR_API_KEY"}) {
		t.Errorf("the probe gets %v", env)
	}
}
