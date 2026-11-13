package dashboard

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"
)

type fakeSetup struct {
	workspaces []Workspace
	held       []string
	saved      []string
	pools      []string
	built      [][]string
	poolErr    error
	tokens     []string
	attempts   []string
}

func (f *fakeSetup) Workspaces(context.Context, string) ([]Workspace, error) {
	return f.workspaces, nil
}

func (f *fakeSetup) HeldKeys(_ context.Context, _, workspace string) ([]string, error) {
	return f.held, nil
}

func (f *fakeSetup) SaveKey(_ context.Context, _, workspace, name, value string) error {
	f.saved = append(f.saved, workspace+":"+name+"="+value)
	return nil
}

func (f *fakeSetup) MakePool(_ context.Context, _, workspace, name, token, idempotencyKey string) error {
	f.pools = append(f.pools, workspace+":"+name)
	f.tokens = append(f.tokens, token)
	f.attempts = append(f.attempts, idempotencyKey)
	return f.poolErr
}

func (f *fakeSetup) Build(_ context.Context, harnesses []string, progress func(string)) (string, error) {
	f.built = append(f.built, harnesses)
	progress("Step 2/2 : RUN npm install -g")
	return "spotlight-harnesses:test-" + strings.Join(harnesses, "-"), nil
}

func (f *fakeSetup) SuggestedName() string { return "leon-mac" }

func setUpStarted(t *testing.T, host *fakeHost, setup *fakeSetup) model {
	t.Helper()
	host.address, host.logins, host.status = "https://app.staging.usespotlight.ai", []Login{{Address: "https://app.staging.usespotlight.ai", User: "leon@example.com"}}, notInstalled()
	m := sized(startedWith(host, setup), 120, 40)
	next, cmd := m.setUpHost()
	m = settle(next.(model), cmd)
	if m.mode != settingUp {
		t.Fatalf("the set-up did not open: mode %v", m.mode)
	}
	return m
}

func typed(m model, text string) model {
	for _, each := range text {
		m, _ = press(m, string(each))
	}
	return m
}

func TestTheSetUpKeepsTheKeyMakesThePoolBuildsTheImageAndInstallsTheHost(t *testing.T) {
	host, setup := &fakeHost{}, &fakeSetup{workspaces: []Workspace{{ID: "ws_1", Name: "Acme", Slug: "acme"}}}
	m := setUpStarted(t, host, setup)

	if m.setupView.step != harnessStep || !strings.Contains(screenText(m), "Claude Code") {
		t.Fatalf("one workspace should go straight to the harnesses:\n%s", screenText(m))
	}
	m, _ = press(m, "space", "enter")
	if m.setupView.step != keyKindStep || !strings.Contains(screenText(m), "Claude subscription token") {
		t.Fatalf("Claude Code should ask which key:\n%s", screenText(m))
	}
	m, _ = press(m, "enter")
	m = typed(m, "sk-ant-oat")
	if strings.Contains(screenText(m), "sk-ant-oat") {
		t.Errorf("the key shows on the screen:\n%s", screenText(m))
	}
	m, _ = press(m, "enter")
	if m.setupView.step != nameStep || m.setupView.input.Value() != "leon-mac" {
		t.Fatalf("the pool name should follow with the computer's name: step %v, %q", m.setupView.step, m.setupView.input.Value())
	}
	m, _ = press(m, "enter", "enter")
	if m.setupView.step != confirmStep {
		t.Fatalf("step %v, not the confirmation:\n%s", m.setupView.step, screenText(m))
	}

	m, cmd := press(m, "enter")
	m = settle(m, cmd)

	if !slices.Equal(setup.saved, []string{"ws_1:CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat"}) || !slices.Equal(setup.pools, []string{"ws_1:leon-mac"}) {
		t.Errorf("saved %v and made %v", setup.saved, setup.pools)
	}
	if len(setup.built) != 1 || !slices.Equal(setup.built[0], []string{"claude-code"}) {
		t.Errorf("built %v", setup.built)
	}
	init := host.ranWith("host", "init")
	want := "host init --url https://app.staging.usespotlight.ai --token-stdin --image spotlight-harnesses:test-claude-code --capacity 5 --name leon-mac --yes"
	if len(setup.tokens) != 1 || len(setup.tokens[0]) < 32 {
		t.Fatalf("made the pool with %v", setup.tokens)
	}
	if !slices.Equal(init, []string{want}) || host.inputs[len(host.inputs)-1] != setup.tokens[0] {
		t.Errorf("ran %v with %q", init, host.inputs)
	}
	if m.mode != browsing || m.last == nil || strings.Contains(m.last.command, "pool-token") {
		t.Errorf("mode %v, last %+v", m.mode, m.last)
	}
	if strings.Contains(m.last.command, setup.tokens[0]) {
		t.Errorf("the shown command has the token: %s", m.last.command)
	}
}

func TestAKeyTheWorkspaceHoldsIsNotAskedForAndOpenCodeSharesIt(t *testing.T) {
	host, setup := &fakeHost{}, &fakeSetup{workspaces: []Workspace{{ID: "ws_1", Name: "Acme"}}, held: []string{"ANTHROPIC_API_KEY"}}
	m := setUpStarted(t, host, setup)

	m, _ = press(m, "space", "down", "down", "down", "space", "enter")

	if m.setupView.step != nameStep || len(m.setupView.asked()) != 0 {
		t.Fatalf("step %v asks for %v", m.setupView.step, m.setupView.asked())
	}
	if !strings.Contains(screenText(m), "ANTHROPIC_API_KEY  the workspace has it") {
		t.Errorf("the held key is not named:\n%s", screenText(m))
	}
}

func TestSeveralWorkspacesAskWhichOneAndEscGoesBack(t *testing.T) {
	host, setup := &fakeHost{}, &fakeSetup{workspaces: []Workspace{{ID: "ws_1", Name: "Acme"}, {ID: "ws_2", Name: "Beta"}}}
	m := setUpStarted(t, host, setup)

	if m.setupView.step != workspaceStep {
		t.Fatalf("step %v", m.setupView.step)
	}
	m, cmd := press(m, "down", "enter")
	m = settle(m, cmd)
	if m.setupView.step != harnessStep || m.setupView.workspaces[m.setupView.workspace].ID != "ws_2" {
		t.Fatalf("step %v at %d", m.setupView.step, m.setupView.workspace)
	}

	m, _ = press(m, "esc")
	if m.setupView.step != workspaceStep {
		t.Errorf("esc went to step %v", m.setupView.step)
	}
	m, _ = press(m, "esc")
	if m.mode != browsing {
		t.Errorf("esc on the first step left mode %v", m.mode)
	}
}

func TestAFailedStepSaysWhyAndRetryDoesNotRepeatTheDoneSteps(t *testing.T) {
	host, setup := &fakeHost{}, &fakeSetup{workspaces: []Workspace{{ID: "ws_1", Name: "Acme"}}, poolErr: errors.New("only a workspace admin can keep keys and make pools")}
	m := setUpStarted(t, host, setup)

	m, _ = press(m, "down", "space", "enter", "enter")
	m = typed(m, "sk-openai")
	m, _ = press(m, "enter", "enter", "enter")
	m, cmd := press(m, "enter")
	m = settle(m, cmd)

	if !m.setupFailed() || !strings.Contains(screenText(m), "only a workspace admin") {
		t.Fatalf("no failure shown:\n%s", screenText(m))
	}
	setup.poolErr = nil
	m, cmd = press(m, "r")
	m = settle(m, cmd)

	if m.mode != browsing || len(setup.saved) != 1 || len(setup.pools) != 2 || len(setup.built) != 1 || len(host.ranWith("host", "init")) != 1 {
		t.Errorf("saved %v, pools %v, built %v, ran %v", setup.saved, setup.pools, setup.built, host.ran)
	}
	if setup.tokens[0] != setup.tokens[1] || setup.attempts[0] != setup.attempts[1] {
		t.Errorf("the retry made the pool with another token or key: %v %v", setup.tokens, setup.attempts)
	}
}

func TestThePoolNameMustBeASlug(t *testing.T) {
	host, setup := &fakeHost{}, &fakeSetup{workspaces: []Workspace{{ID: "ws_1", Name: "Acme"}}, held: []string{"CURSOR_API_KEY"}}
	m := setUpStarted(t, host, setup)

	m, _ = press(m, "down", "down", "space", "enter")
	m.setupView.input.SetValue("Leon's Mac")
	m, _ = press(m, "enter")

	if m.setupView.step != nameStep || !strings.Contains(screenText(m), "lowercase words joined by dashes") {
		t.Errorf("step %v:\n%s", m.setupView.step, screenText(m))
	}
}

func TestATakenPoolNameAsksForAnotherWithANewToken(t *testing.T) {
	host, setup := &fakeHost{}, &fakeSetup{workspaces: []Workspace{{ID: "ws_1", Name: "Acme"}}, held: []string{"CURSOR_API_KEY"}, poolErr: ErrPoolNameTaken}
	m := setUpStarted(t, host, setup)

	m, _ = press(m, "down", "down", "space", "enter", "enter", "enter")
	m, cmd := press(m, "enter")
	m = settle(m, cmd)

	if m.setupView.step != nameStep || !strings.Contains(screenText(m), "A pool named leon-mac is in the workspace") {
		t.Fatalf("step %v:\n%s", m.setupView.step, screenText(m))
	}
	setup.poolErr = nil
	m.setupView.input.SetValue("leon-mac-2")
	m, _ = press(m, "enter", "enter")
	m, cmd = press(m, "enter")
	settle(m, cmd)

	if !slices.Equal(setup.pools, []string{"ws_1:leon-mac", "ws_1:leon-mac-2"}) || setup.tokens[0] == setup.tokens[1] || setup.attempts[0] == setup.attempts[1] {
		t.Errorf("pools %v with tokens %v and keys %v", setup.pools, setup.tokens, setup.attempts)
	}
}

func TestTheKeyPickedForOneHarnessDecidesWhatTheNextOneNeeds(t *testing.T) {
	host, setup := &fakeHost{}, &fakeSetup{workspaces: []Workspace{{ID: "ws_1", Name: "Acme"}}}
	m := setUpStarted(t, host, setup)

	m, _ = press(m, "space", "down", "down", "down", "space", "enter", "down", "enter")
	m = typed(m, "sk-ant-api")
	m, _ = press(m, "enter")
	if m.setupView.step != nameStep {
		t.Fatalf("an Anthropic API key for Claude Code should cover OpenCode: step %v", m.setupView.step)
	}

	m, _ = press(m, "esc")
	if m.setupView.step != keyValueStep || m.setupView.needs[m.setupView.at].harness.ID != "claude-code" {
		t.Fatalf("esc went to step %v at %d", m.setupView.step, m.setupView.at)
	}
	m, _ = press(m, "esc", "up", "enter")
	m = typed(m, "sk-ant-oat")
	m, _ = press(m, "enter")
	if m.setupView.step != keyKindStep || m.setupView.needs[m.setupView.at].harness.ID != "opencode" {
		t.Fatalf("a subscription token does not cover OpenCode, so it should ask: step %v at %d", m.setupView.step, m.setupView.at)
	}
}

func TestTheSetUpOpensAtTheAddressInitWasGiven(t *testing.T) {
	staging := "https://app.staging.usespotlight.ai"
	for _, each := range []struct {
		logins []Login
		mode   mode
	}{
		{logins: []Login{{Address: staging, User: "leon@example.com"}, {Address: "http://localhost:3000"}}, mode: settingUp},
		{logins: []Login{{Address: "http://localhost:3000"}}, mode: loggingIn},
	} {
		host := &fakeHost{status: notInstalled(), logins: each.logins}
		m := newModel(host, host, host, &fakeSetup{workspaces: []Workspace{{ID: "ws_1"}}}, "20261113-01")
		m.setUpFirst = &staging
		m = settle(m, m.check())
		m = settle(m, m.loadLogins())

		if m.mode != each.mode {
			t.Errorf("logins %v: mode %v, want %v", each.logins, m.mode, each.mode)
		}
		if m.mode == loggingIn && m.login.input.Value() != "app.staging.usespotlight.ai" {
			t.Errorf("the login asks for %q", m.login.input.Value())
		}
		if m.mode == settingUp && m.setupView.address != staging {
			t.Errorf("set up for %q", m.setupView.address)
		}
	}
}
