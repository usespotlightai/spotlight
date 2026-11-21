package protocol

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
)

func TestTheVariablesTheRunnerSetsMatchWhatTheControlPlaneRefuses(t *testing.T) {
	raw, err := os.ReadFile("testdata/runner-set-variables.json")
	if err != nil {
		t.Fatal(err)
	}
	var shared struct {
		Variables []string `json:"variables"`
		Prefix    string   `json:"prefix"`
	}
	if err := json.Unmarshal(raw, &shared); err != nil {
		t.Fatal(err)
	}

	if !slices.Equal(shared.Variables, RunnerSetVariables) || shared.Prefix != RunnerVariablePrefix {
		t.Errorf("testdata/runner-set-variables.json holds %v and %q, the runner sets %v and %q",
			shared.Variables, shared.Prefix, RunnerSetVariables, RunnerVariablePrefix)
	}
}

func TestTheRunnerSetsAVariableInAnyCase(t *testing.T) {
	for _, variable := range []string{"PATH", "path", "https_proxy", "Home", "spotlight_run_token", "All_Proxy"} {
		if !SetByTheRunner(variable) {
			t.Errorf("%s is not set by the runner", variable)
		}
	}
	for _, variable := range []string{"GITHUB_APP_PRIVATE_KEY", "PATHS", "MY_SPOTLIGHT_KEY"} {
		if SetByTheRunner(variable) {
			t.Errorf("%s is set by the runner", variable)
		}
	}
}
