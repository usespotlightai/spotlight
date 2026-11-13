package protocol

import (
	"maps"
	"testing"
)

func TestAWorkspaceStandInIsDroppedWhenTheHostHoldsAKeyForTheSameAPIHost(t *testing.T) {
	outer := map[string]string{"OPENAI_API_KEY": StandInPrefix + "OPENAI_API_KEY"}
	env := map[string]string{
		"CODEX_API_KEY":           StandInPrefix + "CODEX_API_KEY",
		"OPENAI_API_KEY":          StandInPrefix + "OPENAI_API_KEY",
		"CLAUDE_CODE_OAUTH_TOKEN": StandInPrefix + "CLAUDE_CODE_OAUTH_TOKEN",
		"CODEX_HOME":              "/state",
	}

	kept := WithoutShadowedHarnessKeys(env, func(name string) string { return outer[name] })

	want := map[string]string{
		"OPENAI_API_KEY":          StandInPrefix + "OPENAI_API_KEY",
		"CLAUDE_CODE_OAUTH_TOKEN": StandInPrefix + "CLAUDE_CODE_OAUTH_TOKEN",
		"CODEX_HOME":              "/state",
	}
	if !maps.Equal(kept, want) {
		t.Errorf("kept %v", kept)
	}
}
