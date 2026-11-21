package protocol

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
)

func TestTheSandboxEnvRulesMatchWhatTheControlPlaneRefuses(t *testing.T) {
	raw, err := os.ReadFile("testdata/sandbox-env.json")
	if err != nil {
		t.Fatal(err)
	}
	var shared struct {
		Variables   []string `json:"variables"`
		Prefix      string   `json:"prefix"`
		NamePattern string   `json:"namePattern"`
		MinLength   int      `json:"minLength"`
		Values      []struct {
			Value string `json:"value"`
			Fits  bool   `json:"fits"`
		} `json:"values"`
	}
	if err := json.Unmarshal(raw, &shared); err != nil {
		t.Fatal(err)
	}

	if !slices.Equal(shared.Variables, RunnerVariables) || shared.Prefix != RunnerVariablePrefix {
		t.Errorf("testdata/sandbox-env.json holds %v and %q, the runner sets %v and %q",
			shared.Variables, shared.Prefix, RunnerVariables, RunnerVariablePrefix)
	}
	if shared.NamePattern != EnvironmentVariableNamePattern {
		t.Errorf("testdata/sandbox-env.json names variables by %q, the runner by %q", shared.NamePattern, EnvironmentVariableNamePattern)
	}
	if shared.MinLength != SandboxValueMinLength {
		t.Errorf("testdata/sandbox-env.json asks for values of %d characters, the runner for %d", shared.MinLength, SandboxValueMinLength)
	}
	for _, sample := range shared.Values {
		if FitsSandbox(sample.Value) != sample.Fits {
			t.Errorf("testdata/sandbox-env.json says %q fits a sandbox: %t, the runner says %t", sample.Value, sample.Fits, !sample.Fits)
		}
	}
}

func TestAnEnvironmentVariableNameUsesLettersDigitsAndUnderscores(t *testing.T) {
	for _, name := range []string{"GITHUB_APP_PRIVATE_KEY", "_KEY", "key2"} {
		if !IsEnvironmentVariableName(name) {
			t.Errorf("%q is refused", name)
		}
	}
	for _, name := range []string{"", "1KEY", "APP-KEY", "APP=KEY", "APP\x00KEY"} {
		if IsEnvironmentVariableName(name) {
			t.Errorf("%q is taken", name)
		}
	}
}

func TestTheRunnerSetsAVariableInAnyCase(t *testing.T) {
	for _, variable := range []string{"PATH", "path", "https_proxy", "Home", "spotlight_run_token", "All_Proxy"} {
		if !IsRunnerVariable(variable) {
			t.Errorf("%s is not set by the runner", variable)
		}
	}
	for _, variable := range []string{"GITHUB_APP_PRIVATE_KEY", "PATHS", "MY_SPOTLIGHT_KEY"} {
		if IsRunnerVariable(variable) {
			t.Errorf("%s is set by the runner", variable)
		}
	}
}
