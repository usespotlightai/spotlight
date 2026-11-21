package session_test

import (
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

const appKey = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----"

func withAppKey(o *runOptions) {
	o.attempt = 2
	o.sandboxEnv = []protocol.SandboxVariable{{Variable: "GITHUB_APP_PRIVATE_KEY", Secret: "DEV_GITHUB_APP_KEY"}}
	o.fetched = protocol.SandboxEnv{Variables: []protocol.EnvVariable{{Name: "GITHUB_APP_PRIVATE_KEY", Value: appKey}}}
}

func everythingSent(t *testing.T, written *journal) string {
	t.Helper()

	written.mu.Lock()
	defer written.mu.Unlock()

	sent, err := json.Marshal(struct {
		Events      []protocol.Event
		Completions []protocol.Completion
		Asked       []protocol.PermissionRequest
	}{written.events, written.completions, written.asked})
	if err != nil {
		t.Fatal(err)
	}

	var decoded strings.Builder
	decoded.Write(sent)
	for _, event := range written.events {
		decoded.Write(event.Data)
	}
	return decoded.String()
}

func TestTheHarnessGetsTheSecretsOfItsSandboxEnvironment(t *testing.T) {
	written := run(t, harness(t, `output = String(process.env.GITHUB_APP_PRIVATE_KEY === `+jsString(appKey)+`);`, "end_turn"), withAppKey)

	if got := agentOutput(t, written); got != "true" {
		t.Errorf("the harness did not get the secret's value: %q", got)
	}
	if !slices.Equal(written.sandboxEnvAsked, []int{2}) {
		t.Errorf("fetched the sandbox environment for attempts %v, want [2]", written.sandboxEnvAsked)
	}
	if written.done == nil || written.done.Failed {
		t.Errorf("completion %+v", written.done)
	}
}

func TestARunWithNoSandboxEnvironmentFetchesNone(t *testing.T) {
	written := run(t, harness(t, `output = "worked";`, "end_turn"))

	if len(written.sandboxEnvAsked) != 0 {
		t.Errorf("fetched a sandbox environment no variable asked for: %v", written.sandboxEnvAsked)
	}
}

func TestAVariableTheHarnessCommandSetsIsRefusedBeforeAnyValueIsFetched(t *testing.T) {
	written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
		o.env = map[string]string{"GITHUB_APP_PRIVATE_KEY": "set by the harness"}
		o.wantErr = true
	})

	if written.done == nil || !written.done.SetupFailed ||
		!strings.Contains(written.done.Message, "Secret DEV_GITHUB_APP_KEY could not be put in the sandbox: sets GITHUB_APP_PRIVATE_KEY, which the harness command sets") {
		t.Errorf("completion %+v", written.done)
	}
	if len(written.sandboxEnvAsked) != 0 {
		t.Error("fetched values for a variable it refuses")
	}
}

func TestAVariableSetTwiceIsRefusedBeforeAnyValueIsFetched(t *testing.T) {
	written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
		o.sandboxEnv = append(o.sandboxEnv, protocol.SandboxVariable{Variable: "GITHUB_APP_PRIVATE_KEY", Secret: "OTHER_APP_KEY"})
		o.wantErr = true
	})

	if written.done == nil || !written.done.SetupFailed ||
		!strings.Contains(written.done.Message, "Secret OTHER_APP_KEY could not be put in the sandbox: sets GITHUB_APP_PRIVATE_KEY twice") {
		t.Errorf("completion %+v", written.done)
	}
	if len(written.sandboxEnvAsked) != 0 {
		t.Error("fetched values for a variable it refuses")
	}
}

func TestAValueWithTooFewCharactersBesideWhitespaceIsRefusedBeforeTheAgentStarts(t *testing.T) {
	written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
		o.fetched = protocol.SandboxEnv{Variables: []protocol.EnvVariable{{Name: "GITHUB_APP_PRIVATE_KEY", Value: "a\n       "}}}
		o.wantErr = true
	})

	if written.done == nil || !written.done.SetupFailed ||
		!strings.Contains(written.done.Message, "Secret DEV_GITHUB_APP_KEY could not be put in the sandbox: its value has fewer than 8 characters that are not whitespace") {
		t.Errorf("completion %+v", written.done)
	}
	if agentOutput(t, written) != "" {
		t.Error("the agent started")
	}
}

func TestWhatTheAgentSaysOfASecretReachesSpotlightOnlyAsItsStandIn(t *testing.T) {
	written := run(t, harness(t, `output = "the key is " + process.env.GITHUB_APP_PRIVATE_KEY + " " + JSON.stringify({ key: process.env.GITHUB_APP_PRIVATE_KEY });`, "end_turn"),
		withAppKey, func(o *runOptions) { o.frames = true })

	if got := agentOutput(t, written); !strings.HasPrefix(got, "the key is spotlight-egress:DEV_GITHUB_APP_KEY ") {
		t.Errorf("the agent's output reads %q", got)
	}
	sent := everythingSent(t, written)
	for _, spelled := range []string{appKey, jsString(appKey)[1 : len(jsString(appKey))-1], "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC"} {
		if strings.Contains(sent, spelled) {
			t.Fatalf("the value reached Spotlight as %q", spelled)
		}
	}
	if !strings.Contains(sent, "spotlight-egress:DEV_GITHUB_APP_KEY") {
		t.Error("the stand-in did not reach Spotlight")
	}
}

func TestARunFailsBeforeItsSetupWhenASecretIsDenied(t *testing.T) {
	written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
		o.fetched = protocol.SandboxEnv{Denied: []protocol.DeniedSecret{
			{Secret: "DEV_GITHUB_APP_KEY", Reason: "the secret does not allow sandboxes"},
			{Secret: "NPM_TOKEN", Reason: "the secret is not defined"},
		}}
		o.wantErr = true
	})

	if written.done == nil || !written.done.Failed || !written.done.SetupFailed {
		t.Fatalf("completion %+v", written.done)
	}
	for _, want := range []string{
		"Secret DEV_GITHUB_APP_KEY could not be put in the sandbox: the secret does not allow sandboxes",
		"Secret NPM_TOKEN could not be put in the sandbox: the secret is not defined",
	} {
		if !strings.Contains(written.done.Message, want) {
			t.Errorf("the failure does not say %q: %q", want, written.done.Message)
		}
	}
	if agentOutput(t, written) != "" || len(written.typed(protocol.EventWorkingCopyReady)) != 0 {
		t.Error("the run went on past the denial")
	}
}

func TestAVariableTheRunnerOwnsIsRefusedBeforeAnyValueIsFetched(t *testing.T) {
	for _, owned := range []string{"PATH", "HOME", "SPOTLIGHT_RUN_TOKEN", "https_proxy", "NO_PROXY", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS"} {
		written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
			o.sandboxEnv = []protocol.SandboxVariable{{Variable: owned, Secret: "SNEAKY"}}
			o.wantErr = true
		})

		if written.done == nil || !written.done.SetupFailed ||
			!strings.Contains(written.done.Message, "Secret SNEAKY could not be put in the sandbox: sets "+owned+", which the runner sets in every sandbox") {
			t.Errorf("%s: completion %+v", owned, written.done)
		}
		if len(written.sandboxEnvAsked) != 0 {
			t.Errorf("%s: fetched values for a variable it refuses", owned)
		}
	}
}

func TestANameNoEnvironmentVariableCanHaveIsRefusedBeforeAnyValueIsFetched(t *testing.T) {
	for _, name := range []string{"", "1KEY", "APP-KEY", "APP=KEY", "APP\x00KEY"} {
		written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
			o.sandboxEnv = []protocol.SandboxVariable{{Variable: name, Secret: "DEV_GITHUB_APP_KEY"}}
			o.wantErr = true
		})

		if written.done == nil || !written.done.SetupFailed ||
			!strings.Contains(written.done.Message, "Secret DEV_GITHUB_APP_KEY could not be put in the sandbox: sets "+strconv.Quote(name)+", but environment variable names must use letters, digits and underscores") {
			t.Errorf("%q: completion %+v", name, written.done)
		}
		if len(written.sandboxEnvAsked) != 0 {
			t.Errorf("%q: fetched values for a variable it refuses", name)
		}
	}
}

func TestAValueWithANulByteIsRefusedBeforeTheAgentStarts(t *testing.T) {
	written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
		o.fetched = protocol.SandboxEnv{Variables: []protocol.EnvVariable{{Name: "GITHUB_APP_PRIVATE_KEY", Value: "key\x00value"}}}
		o.wantErr = true
	})

	if written.done == nil || !written.done.SetupFailed ||
		!strings.Contains(written.done.Message, "Secret DEV_GITHUB_APP_KEY could not be put in the sandbox: its value holds a NUL byte, which no environment variable can hold") {
		t.Errorf("completion %+v", written.done)
	}
	if agentOutput(t, written) != "" {
		t.Error("the agent started")
	}
}

func TestAVariableSpotlightSendsNoValueForIsRefusedBeforeTheAgentStarts(t *testing.T) {
	written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
		o.fetched = protocol.SandboxEnv{}
		o.wantErr = true
	})

	if written.done == nil || !written.done.SetupFailed ||
		!strings.Contains(written.done.Message, "Secret DEV_GITHUB_APP_KEY could not be put in the sandbox: Spotlight sent no value for GITHUB_APP_PRIVATE_KEY") {
		t.Errorf("completion %+v", written.done)
	}
	if agentOutput(t, written) != "" {
		t.Error("the agent started")
	}
}

func TestAFetchedVariableTheRunDidNotAskForIsRefused(t *testing.T) {
	written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
		o.fetched = protocol.SandboxEnv{Variables: []protocol.EnvVariable{{Name: "HTTP_PROXY", Value: "http://elsewhere:8080"}}}
		o.wantErr = true
	})

	if written.done == nil || !written.done.SetupFailed || !strings.Contains(written.done.Message, "Spotlight sent a value for HTTP_PROXY, which the run did not ask for") {
		t.Errorf("completion %+v", written.done)
	}
	if agentOutput(t, written) != "" {
		t.Error("the agent started")
	}
}

type runLeasedElsewhere struct{}

func (runLeasedElsewhere) Error() string           { return "the run is leased by another runner" }
func (runLeasedElsewhere) RunNoLongerLeased() bool { return true }

func TestARunLeasedElsewhereStopsWithoutReportingAnOutcome(t *testing.T) {
	written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
		o.fetchErr = runLeasedElsewhere{}
		o.wantErr = true
	})

	if written.done != nil {
		t.Errorf("reported %+v for a run it no longer leases", written.done)
	}
	if agentOutput(t, written) != "" {
		t.Error("the agent started")
	}
}

func TestARunWhoseSandboxEnvironmentCannotBeFetchedFailsItsSetup(t *testing.T) {
	written := run(t, harness(t, `output = "started";`, "end_turn"), withAppKey, func(o *runOptions) {
		o.fetchErr = errors.New("connection refused")
		o.wantErr = true
	})

	if written.done == nil || !written.done.SetupFailed || !strings.Contains(written.done.Message, "connection refused") {
		t.Errorf("completion %+v", written.done)
	}
}

func TestTheSetupCommandsGetTheSecretsOfTheSandboxEnvironment(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	origin := filepath.Join(t.TempDir(), "origin")
	for _, args := range [][]string{
		{"init", "--quiet", "--initial-branch", "main", origin},
		{"-C", origin, "-c", "user.name=Someone", "-c", "user.email=someone@example.com", "commit", "--quiet", "--allow-empty", "--message", "start"},
	} {
		if output, err := exec.Command("git", args...).CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v: %s", args, err, output)
		}
	}

	root := t.TempDir()
	written := run(t, harness(t, `output = require("node:fs").readFileSync("web/saw", "utf8");`, "end_turn"), withAppKey, func(o *runOptions) {
		o.root = root
		o.controlPlane = "http://127.0.0.1:1"
		o.checkouts = []protocol.Checkout{{
			Remote: origin, Path: "web", Branch: "main",
			Setup: `case "$GITHUB_APP_PRIVATE_KEY" in *"-----END PRIVATE KEY-----") printf the-key > saw ;; esac`,
		}}
	})

	if got := agentOutput(t, written); got != "the-key" {
		t.Errorf("the setup did not see the secret: %q", got)
	}
	if _, err := os.Stat(filepath.Join(root, "web", "saw")); err != nil {
		t.Errorf("the setup did not run: %v", err)
	}
}

func jsString(text string) string {
	encoded, _ := json.Marshal(text)
	return string(encoded)
}
