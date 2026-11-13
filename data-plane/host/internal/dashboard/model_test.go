package dashboard

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os/exec"
	"slices"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/host/internal/config"
)

type fakeHost struct {
	ran    [][]string
	inputs []string
	status Status
	rows   []Setting
	logs   func() (io.ReadCloser, error)

	logins   []Login
	address  string
	loginErr error
	waitErr  error
	loginsAt []string

	editors EditorSetup
}

func (f *fakeHost) Inspect() EditorSetup     { return f.editors }
func (f *fakeHost) Logins() ([]Login, error) { return f.logins, nil }
func (f *fakeHost) SuggestedAddress() string { return f.address }

func (f *fakeHost) Login(_ context.Context, address string) (Approval, error) {
	f.loginsAt = append(f.loginsAt, address)
	if f.loginErr != nil {
		return Approval{}, f.loginErr
	}
	if !strings.Contains(address, "://") {
		address = "https://" + address
	}
	return Approval{
		Address: address,
		Page:    address + "/device?user_code=ABCDEFGH",
		Code:    "ABCD-EFGH",
		Open:    func() error { return nil },
		Wait: func(context.Context) (string, error) {
			if f.waitErr != nil {
				return "", f.waitErr
			}
			f.logins = append(f.logins, Login{Address: address, User: "leon@example.com"})
			return "leon@example.com", nil
		},
	}, nil
}

func (f *fakeHost) Run(args []string, input string) (string, error) {
	f.ran = append(f.ran, args)
	f.inputs = append(f.inputs, input)
	if slices.Equal(args[:min(len(args), 2)], []string{"ssh", "setup"}) {
		return "  Open a task in VS Code or Cursor from Spotlight.", nil
	}
	return "  ✓ done", nil
}

func (f *fakeHost) ranWith(prefix ...string) []string {
	var found []string
	for _, each := range f.ran {
		if slices.Equal(each[:min(len(each), len(prefix))], prefix) {
			found = append(found, strings.Join(each, " "))
		}
	}
	return found
}

func (f *fakeHost) Attach([]string) *exec.Cmd    { return exec.Command("true") }
func (f *fakeHost) Status() Status               { return f.status }
func (f *fakeHost) Settings() ([]Setting, error) { return f.rows, nil }
func (f *fakeHost) ConfigPath() string           { return "/etc/spotlight/host.env" }
func (f *fakeHost) ranArgs(i int) string         { return strings.Join(f.ran[i], " ") }

func (f *fakeHost) Logs() (io.ReadCloser, error) {
	if f.logs != nil {
		return f.logs()
	}
	return nil, errors.New("no service")
}

func serving(sandboxes int) Status {
	return Status{
		SetUp:     true,
		Name:      "leon-mac",
		Service:   Service{Installed: true, Running: true, Process: 42, Unit: "spotlight-host.service"},
		Sandboxes: Sandboxes{Running: &sandboxes, Capacity: 5},
		Checks: []Check{
			{Name: "settings", Level: console.Passed, Message: "The settings are valid."},
			{Name: "image", Level: console.Warned, Message: "The default image holds no harness.", Fix: "spotlight host config set image=IMAGE"},
		},
	}
}

func notInstalled() Status {
	return Status{Sandboxes: Sandboxes{Capacity: 5}}
}

func setting(t *testing.T, key, value string) Setting {
	t.Helper()
	known, err := config.Lookup(key)
	if err != nil {
		t.Fatal(err)
	}
	return Setting{Setting: known, Value: value, Set: value != ""}
}

func keyPress(name string) tea.KeyPressMsg {
	switch name {
	case "enter":
		return tea.KeyPressMsg{Code: tea.KeyEnter}
	case "esc":
		return tea.KeyPressMsg{Code: tea.KeyEscape}
	case "pgup":
		return tea.KeyPressMsg{Code: tea.KeyPgUp}
	case "down":
		return tea.KeyPressMsg{Code: tea.KeyDown}
	}
	code := []rune(name)[0]
	return tea.KeyPressMsg{Code: code, Text: name}
}

func press(m model, names ...string) (model, tea.Cmd) {
	var cmd tea.Cmd
	for _, name := range names {
		var next tea.Model
		next, cmd = m.Update(keyPress(name))
		m = next.(model)
	}
	return m, cmd
}

func settle(m model, cmd tea.Cmd) model {
	if cmd == nil {
		return m
	}
	switch msg := cmd().(type) {
	case tea.BatchMsg:
		for _, each := range msg {
			m = settle(m, each)
		}
		return m
	case logLineMsg, logEndedMsg:
		m, _ = update(m, msg)
		return m
	case statusMsg, settingsMsg, loginsMsg, editorsMsg, ranMsg, loginStartedMsg, loginDoneMsg, loginPageMsg,
		setupLoadedMsg, setupHeldMsg, setupStepMsg, buildLineMsg:
		m, next := update(m, msg)
		return settle(m, next)
	default:
		return m
	}
}

func loginStarted(t *testing.T, m model, cmd tea.Cmd) (model, tea.Cmd) {
	t.Helper()
	msgs := []tea.Msg{cmd()}
	if batch, ok := msgs[0].(tea.BatchMsg); ok {
		msgs = nil
		for _, each := range batch {
			msgs = append(msgs, each())
		}
	}
	for _, msg := range msgs {
		if started, ok := msg.(loginStartedMsg); ok {
			return update(m, started)
		}
	}
	t.Fatalf("no login started in %v", msgs)
	return m, nil
}

func update(m model, msg tea.Msg) (model, tea.Cmd) {
	next, cmd := m.Update(msg)
	return next.(model), cmd
}

func started(host *fakeHost) model {
	return startedWith(host, nil)
}

func startedWith(host *fakeHost, setup Setup) model {
	m := newModel(host, host, host, setup, "20261113-01")
	m = settle(m, m.check())
	m = settle(m, m.loadLogins())
	m = settle(m, m.loadEditors())
	return settle(m, m.loadSettings())
}

func sized(m model, width, height int) model {
	m, _ = update(m, tea.WindowSizeMsg{Width: width, Height: height})
	return m
}

func screenText(m model) string {
	return ansi.Strip(m.View().Content)
}

func footerKeys(m model) []string {
	var keys []string
	for _, each := range m.footer() {
		keys = append(keys, each.key)
	}
	return keys
}

func TestRunsTheCommandAndShowsIt(t *testing.T) {
	host := &fakeHost{status: serving(0)}
	m, cmd := press(started(host), "r")
	if m.running != "spotlight host restart" {
		t.Fatalf("running = %q", m.running)
	}
	m = settle(m, cmd)

	if len(host.ran) != 1 || host.ranArgs(0) != "host restart" {
		t.Fatalf("ran %v", host.ran)
	}
	view := screenText(m)
	for _, want := range []string{"✓ spotlight host restart   done", "● serving   pid 42 · systemd", "0 of 5", "! The default image holds no harness."} {
		if !strings.Contains(view, want) {
			t.Errorf("view lacks %q:\n%s", want, view)
		}
	}
}

func TestAsksBeforeItStopsRunningSandboxes(t *testing.T) {
	host := &fakeHost{status: serving(2)}
	m, _ := press(started(host), "R")
	if m.mode != asking || !strings.Contains(m.question.text, "its 2 running sandboxes") {
		t.Fatalf("mode %v question %+v", m.mode, m.question)
	}
	if keys := footerKeys(m); !slices.Equal(keys, []string{"y", "n"}) {
		t.Errorf("the footer offers %v while it asks", keys)
	}

	m, _ = press(m, "s", "n")
	if m.mode != browsing || len(host.ran) != 0 {
		t.Fatalf("mode %v ran %v", m.mode, host.ran)
	}

	m, _ = press(m, "s")
	settle(press(m, "y"))
	if len(host.ran) != 1 || host.ranArgs(0) != "host stop" {
		t.Fatalf("ran %v", host.ran)
	}
}

func TestStartsAStoppedHostWithoutAsking(t *testing.T) {
	host := &fakeHost{status: serving(0)}
	host.status.Service.Running = false
	settle(press(started(host), "s"))
	if len(host.ran) != 1 || host.ranArgs(0) != "host start" {
		t.Fatalf("ran %v", host.ran)
	}
}

func TestServiceActionsNeedAnInstalledService(t *testing.T) {
	host := &fakeHost{status: notInstalled(), editors: EditorSetup{Configured: true}}
	m := started(host)
	if keys := footerKeys(m); !slices.Contains(keys, "i") || slices.Contains(keys, "s") || slices.Contains(keys, "r") {
		t.Fatalf("footer keys %v", keys)
	}

	m, _ = press(m, "s", "r", "R")
	if len(host.ran) != 0 || m.mode != browsing {
		t.Fatalf("ran %v in mode %v", host.ran, m.mode)
	}
	for _, each := range search(m.paletteActions(), "") {
		if slices.Contains([]string{"start", "stop", "restart", "restart now"}, each.name) {
			t.Errorf("the palette offers %q", each.name)
		}
	}
}

func TestInitWaitsForTheFirstCheck(t *testing.T) {
	m := newModel(&fakeHost{}, &fakeHost{}, &fakeHost{}, nil, "dev")
	if slices.Contains(footerKeys(m), "i") {
		t.Fatal("init shows before the host is checked")
	}
}

func TestLogsInWhenThereIsNoLogin(t *testing.T) {
	m := started(&fakeHost{status: notInstalled(), editors: EditorSetup{Configured: true}})
	if !strings.Contains(screenText(m), "account     ○ not logged in") || !slices.Contains(footerKeys(m), "a") {
		t.Fatalf("view:\n%s", screenText(m))
	}
	m, _ = press(m, "a")
	if m.mode != loggingIn || !strings.Contains(screenText(m), "address     app.usespotlight.ai") {
		t.Fatalf("mode %v view:\n%s", m.mode, screenText(m))
	}
}

func TestLogsInInsideTheDashboard(t *testing.T) {
	host := &fakeHost{status: notInstalled(), editors: EditorSetup{Configured: true}, address: "https://staging.usespotlight.ai"}
	m, _ := press(sized(started(host), 100, 30), "a")
	if m.login.input.Value() != "staging.usespotlight.ai" {
		t.Fatalf("address %q", m.login.input.Value())
	}

	m, cmd := press(m, "enter")
	if m.login.step != startingStep || !strings.Contains(screenText(m), "Asking Spotlight for a login code") {
		t.Fatalf("view:\n%s", screenText(m))
	}
	m, wait := loginStarted(t, m, cmd)
	view := screenText(m)
	for _, want := range []string{"page        https://staging.usespotlight.ai/device?user_code=ABCDEFGH", "code        ABCD-EFGH", "The page is open in your browser.", "o open the page", "esc stop"} {
		if !strings.Contains(view, want) {
			t.Errorf("view lacks %q:\n%s", want, view)
		}
	}

	m, _ = press(m, "o")
	m = settle(m, wait)
	if m.mode != browsing || !m.loggedIn("https://staging.usespotlight.ai") {
		t.Fatalf("mode %v logins %v", m.mode, m.logins.all)
	}
	if view := screenText(m); !strings.Contains(view, "✓ spotlight login   Logged in to staging.usespotlight.ai as leon@example.com.") || !strings.Contains(view, "● leon@example.com") {
		t.Errorf("view:\n%s", view)
	}
}

func TestAFailedLoginKeepsTheAddressToCorrect(t *testing.T) {
	host := &fakeHost{status: notInstalled(), editors: EditorSetup{Configured: true}, loginErr: errors.New("Spotlight at https://app.usespotlight.ai did not give a device code. It answered 404, so it may not be a Spotlight address.")}
	m, cmd := press(sized(started(host), 80, 30), "a", "enter")
	m = settle(m, cmd)
	view := screenText(m)
	if m.login.step != addressStep || !strings.Contains(view, "✗ Spotlight at https://app.usespotlight.ai did not give a device") || !strings.Contains(view, "may not be a Spotlight address.") {
		t.Fatalf("view:\n%s", view)
	}

	host.loginErr = nil
	m, _ = press(m, "esc", "a")
	for range len("app.usespotlight.ai") {
		m, _ = press(m, "backspace")
	}
	m, cmd = press(m, "s", "t", "a", "g", "i", "n", "g", "enter")
	m = settle(m, cmd)
	if got := host.loginsAt[len(host.loginsAt)-1]; got != "staging" || m.mode != browsing {
		t.Fatalf("logged in at %q, mode %v", got, m.mode)
	}
}

func TestEscStopsTheLoginAndALateApprovalIsIgnored(t *testing.T) {
	host := &fakeHost{status: notInstalled(), editors: EditorSetup{Configured: true}}
	m, cmd := press(started(host), "a", "enter")
	m, wait := loginStarted(t, m, cmd)
	m, _ = press(m, "esc")
	if m.mode != browsing || m.login.ctx.Err() == nil {
		t.Fatalf("mode %v", m.mode)
	}
	m = settle(m, wait)
	if m.last != nil || len(m.logins.all) != 0 {
		t.Fatalf("a stopped login was kept: %+v %v", m.last, m.logins.all)
	}
}

func TestAsksBeforeItLogsOut(t *testing.T) {
	host := &fakeHost{status: serving(0), logins: []Login{{Address: "https://app.usespotlight.ai", User: "leon@example.com"}}}
	m := started(host)
	if view := screenText(m); !strings.Contains(view, "● leon@example.com · app.usespotlight.ai") {
		t.Fatalf("view:\n%s", view)
	}

	m, _ = press(m, "a")
	if m.mode != asking || m.question.text != "Log out of app.usespotlight.ai?" {
		t.Fatalf("mode %v question %+v", m.mode, m.question)
	}
	m, cmd := press(m, "y")
	if m.running != "spotlight logout --url https://app.usespotlight.ai" {
		t.Fatalf("running = %q", m.running)
	}
	settle(m, cmd)
	if got := host.ranWith("logout"); !slices.Equal(got, []string{"logout --url https://app.usespotlight.ai"}) {
		t.Fatalf("ran %v", got)
	}
}

func TestChoosesWhichLoginToEnd(t *testing.T) {
	host := &fakeHost{status: serving(0), logins: []Login{{Address: "https://app.usespotlight.ai"}, {Address: "http://localhost:3000", User: "dev"}}}
	m, _ := press(started(host), "a")
	if m.mode != commanding || m.palette.input.Value() != "log out of " {
		t.Fatalf("mode %v query %q", m.mode, m.palette.input.Value())
	}
	var names []string
	for _, each := range search(m.paletteActions(), m.palette.input.Value()) {
		names = append(names, each.name)
	}
	slices.Sort(names)
	if !slices.Equal(names, []string{"log out of app.usespotlight.ai", "log out of localhost:3000"}) {
		t.Fatalf("found %v", names)
	}
	m, _ = press(m, "enter", "y")
	if !strings.HasPrefix(m.running, "spotlight logout --url http") {
		t.Fatalf("running = %q", m.running)
	}
}

func TestChangesASetting(t *testing.T) {
	host := &fakeHost{status: serving(0), rows: []Setting{setting(t, "capacity", "5"), setting(t, "token", "secret-token")}}
	m, _ := press(started(host), "c")
	if rows := m.visibleSettings(); len(rows) != 2 || rows[0].Key != "token" {
		t.Fatalf("rows = %v", rows)
	}

	m, _ = press(m, "j", "enter")
	if m.mode != editing || m.settings.input.Value() != "5" {
		t.Fatalf("mode %v with %q", m.mode, m.settings.input.Value())
	}
	m.settings.input.SetValue("8")
	m, cmd := press(m, "enter")
	if m.running != "spotlight host config set capacity=8" {
		t.Fatalf("running = %q", m.running)
	}
	m = settle(m, cmd)
	if host.ranArgs(0) != "host config set capacity --stdin" || host.inputs[0] != "8" {
		t.Fatalf("ran %q with %q", host.ranArgs(0), host.inputs[0])
	}

	m, _ = press(m, "k", "enter")
	if m.settings.input.Value() != "" {
		t.Fatalf("a secret starts with %q", m.settings.input.Value())
	}
	m.settings.input.SetValue("new-token")
	m, cmd = press(m, "enter")
	if m.running != "spotlight host config set token=•••" {
		t.Fatalf("running = %q", m.running)
	}
	settle(m, cmd)
	if host.ranArgs(1) != "host config set token --stdin" || host.inputs[1] != "new-token" {
		t.Fatalf("ran %q with %q", host.ranArgs(1), host.inputs[1])
	}
	if strings.Contains(m.View().Content, "secret-token") {
		t.Fatal("the view shows the secret")
	}
}

func TestEnterOnASecretWithoutAValueKeepsIt(t *testing.T) {
	host := &fakeHost{status: serving(0), rows: []Setting{setting(t, "token", "secret-token")}}
	m, _ := press(started(host), "c", "enter")
	if !strings.Contains(m.settings.input.Placeholder, "keep") {
		t.Errorf("placeholder = %q", m.settings.input.Placeholder)
	}
	m = settle(press(m, "enter"))
	if len(host.ran) != 0 || m.mode != browsing {
		t.Fatalf("ran %v in mode %v", host.ran, m.mode)
	}
}

func TestAnUnknownVariableIsTreatedAsASecret(t *testing.T) {
	host := &fakeHost{status: serving(0), rows: []Setting{setting(t, "REGISTRY_PASSWORD", "hunter2")}}
	m, _ := press(started(host), "c")
	if strings.Contains(m.View().Content, "hunter2") {
		t.Fatal("the view shows the value")
	}
	m, _ = press(m, "enter")
	if m.settings.input.Value() != "" {
		t.Fatalf("the field starts with %q", m.settings.input.Value())
	}
	m.settings.input.SetValue("new")
	m, cmd := press(m, "enter")
	settle(m, cmd)
	if m.running != "spotlight host config set REGISTRY_PASSWORD=•••" || host.inputs[0] != "new" {
		t.Fatalf("running %q with %v", m.running, host.inputs)
	}
}

func TestAnEditSavesTheSettingItOpened(t *testing.T) {
	host := &fakeHost{status: serving(0), rows: []Setting{setting(t, "capacity", "5"), setting(t, "image", "")}}
	m, _ := press(started(host), "c", "j", "enter")
	if m.settings.editing != "image" {
		t.Fatalf("editing %q", m.settings.editing)
	}

	m, _ = update(m, settingsMsg{rows: []Setting{setting(t, "image", ""), setting(t, "run-timeout", "1h"), setting(t, "capacity", "5")}})
	if row, _ := m.selected(); row.Key != "image" {
		t.Errorf("the cursor moved to %q", row.Key)
	}
	m.settings.input.SetValue("runner:2")
	settle(press(m, "enter"))
	if host.ranArgs(0) != "host config set image --stdin" || host.inputs[0] != "runner:2" {
		t.Fatalf("ran %q", host.ranArgs(0))
	}
}

func TestUnsetsOnlyASetSetting(t *testing.T) {
	host := &fakeHost{status: serving(0), rows: []Setting{setting(t, "image", ""), setting(t, "capacity", "5")}}
	m, _ := press(started(host), "c")

	m = settle(press(m, "x"))
	if len(host.ran) != 0 {
		t.Fatalf("unset a setting that is not set: %v", host.ran)
	}
	settle(press(m, "j", "x"))
	if host.ranArgs(0) != "host config unset capacity" {
		t.Fatalf("ran %q", host.ranArgs(0))
	}
}

func TestEnterWithNoSettingsDoesNothing(t *testing.T) {
	m, _ := press(started(&fakeHost{status: serving(0)}), "c", "enter", "x")
	if m.mode != browsing {
		t.Fatalf("mode = %v", m.mode)
	}
}

func TestFilterNarrowsTheSettings(t *testing.T) {
	host := &fakeHost{status: serving(0), rows: []Setting{setting(t, "capacity", "5"), setting(t, "egress-image", "")}}
	m, _ := press(started(host), "c", "/", "e", "g", "r")
	if m.mode != filtering || len(m.visibleSettings()) != 1 {
		t.Fatalf("mode %v rows %v", m.mode, m.visibleSettings())
	}
	m, _ = press(m, "esc")
	if m.mode != browsing || len(m.visibleSettings()) != 2 {
		t.Fatalf("esc kept the filter: %v", m.visibleSettings())
	}
}

func TestPaletteRunsACommandByName(t *testing.T) {
	host := &fakeHost{status: serving(0)}
	m, _ := press(started(host), ":")
	if m.mode != commanding {
		t.Fatal("the palette did not open")
	}
	m, _ = press(m, "r", "e", "l")
	m = settle(press(m, "enter"))
	if m.mode != browsing || len(host.ran) != 1 || host.ranArgs(0) != "host reload" {
		t.Fatalf("mode %v ran %v", m.mode, host.ran)
	}
}

func TestPaletteOpensASettingToEdit(t *testing.T) {
	host := &fakeHost{status: serving(0), rows: []Setting{setting(t, "capacity", "5")}}
	m, _ := press(started(host), ":", "c", "a", "p", "a", "enter")
	if m.screen != settingsScreen || m.mode != editing || m.settings.input.Value() != "5" {
		t.Fatalf("screen %v mode %v value %q", m.screen, m.mode, m.settings.input.Value())
	}
}

func TestSearchRanksActionsBeforeSettings(t *testing.T) {
	actions := []action{{name: "set releases-url", setting: true}, {name: "reload env files"}, {name: "restart"}}
	found := search(actions, "re")
	if found[0].name != "restart" || found[len(found)-1].name != "set releases-url" {
		t.Fatalf("found %v", found)
	}
	if got := search(actions, "rstrt"); len(got) != 1 || got[0].name != "restart" {
		t.Fatalf("fuzzy found %v", got)
	}
	if got := search(actions, ""); len(got) != 2 {
		t.Fatalf("an empty query lists settings: %v", got)
	}
}

func TestAStaleCheckDoesNotWin(t *testing.T) {
	host := &fakeHost{status: serving(0)}
	m := started(host)
	stale := m.check()

	host.status.Service.Running = false
	m, cmd := update(m, ranMsg{command: "spotlight host stop"})
	host.status.Service.Running = true
	m = settle(m, stale)
	if !m.checking {
		t.Fatal("the stale check ended the new one")
	}
	host.status.Service.Running = false
	m = settle(m, cmd)
	if m.checking || m.status.Service.Running {
		t.Fatalf("checking %v running %v", m.checking, m.status.Service.Running)
	}
}

func TestLogScrollKeysComeFromTheTable(t *testing.T) {
	m := sized(started(&fakeHost{status: serving(0)}), 80, 12)
	for range 50 {
		m, _ = update(m, logLineMsg{stream: m.logs.stream, line: `{"msg":"a line"}`})
	}
	m, _ = press(m, "l")
	bottom := m.logs.scroll.YOffset()
	m, _ = press(m, "pgup")
	if m.logs.scroll.YOffset() >= bottom {
		t.Fatalf("pgup left the offset at %d", m.logs.scroll.YOffset())
	}
	m, _ = press(m, "l")
	if m.screen != overviewScreen {
		t.Fatal("l does not close the log")
	}
}

func TestEachKeyIsBoundOnceInEachState(t *testing.T) {
	m := started(&fakeHost{status: serving(0)})
	for _, each := range []screen{overviewScreen, settingsScreen, logScreen} {
		for _, state := range []mode{browsing, asking, commanding, helping, editing, filtering, loggingIn} {
			m.screen, m.mode = each, state
			seen := map[string]bool{}
			for _, bound := range m.keymap().all() {
				for _, key := range bound.keys {
					if seen[key] {
						t.Errorf("screen %v mode %v binds %q twice", each, state, key)
					}
					seen[key] = true
				}
			}
		}
	}
}

func TestEachKeyIsBoundOnceInTheChooserAndTheLogin(t *testing.T) {
	m := started(&fakeHost{status: notInstalled()})
	if !m.firstRun() {
		t.Fatal("no chooser")
	}
	states := []func(model) model{
		func(m model) model { return m },
		func(m model) model { m.mode, m.login.step = loggingIn, addressStep; return m },
		func(m model) model { m.mode, m.login.step = loggingIn, startingStep; return m },
		func(m model) model { m.mode, m.login.step = loggingIn, approvingStep; return m },
	}
	for i, state := range states {
		seen := map[string]bool{}
		for _, bound := range state(m).keymap().all() {
			for _, key := range bound.keys {
				if seen[key] {
					t.Errorf("state %d binds %q twice", i, key)
				}
				seen[key] = true
			}
		}
	}
}

func TestHelpListsEveryKey(t *testing.T) {
	m := started(&fakeHost{status: serving(0)})
	sections := m.helpLines()
	listed := func(section, key string) bool {
		for _, each := range sections[section] {
			if slices.Contains(strings.Fields(each.key), key) {
				return true
			}
		}
		return false
	}
	for _, want := range [][2]string{{sectionLog, "esc"}, {sectionSettings, "esc"}, {sectionSettings, "j"}, {sectionViews, "ctrl+k"}, {sectionLog, "pgdown"}} {
		if !listed(want[0], want[1]) {
			t.Errorf("help lacks %q in %s", want[1], want[0])
		}
	}
	for _, each := range []screen{overviewScreen, settingsScreen, logScreen} {
		m.screen = each
		for _, shown := range m.footer() {
			found := false
			for _, section := range sections {
				for _, line := range section {
					found = found || strings.HasPrefix(line.key, shown.key)
				}
			}
			if !found {
				t.Errorf("help lacks footer key %q", shown.key)
			}
		}
	}
}

func TestEverySettingHasAGroup(t *testing.T) {
	for _, each := range config.Settings {
		if !slices.Contains(config.Groups, each.Group) {
			t.Errorf("%s has group %q", each.Key, each.Group)
		}
	}
	if other, _ := config.Lookup("MY_VARIABLE"); other.Group != config.GroupOther {
		t.Errorf("an unknown variable has group %q", other.Group)
	}
}

func TestEveryScreenFitsTheTerminal(t *testing.T) {
	host := &fakeHost{status: serving(3), rows: []Setting{setting(t, "capacity", "5"), setting(t, "url", "http://localhost:3000")}}
	lines := []string{
		`{"time":"2026-11-13T10:00:00Z","level":"INFO","msg":"sandbox","sandbox":"sbx_1","line":"a long line from a sandbox that runs past the width"}`,
		`{"level":"ERROR","msg":"failed","error":"line one\nline two\nline three"}`,
		"plain text with \x1b[2J an escape",
	}
	for _, size := range [][2]int{{20, 3}, {40, 8}, {80, 24}, {140, 50}} {
		m := sized(started(host), size[0], size[1])
		for i := range 300 {
			m, _ = update(m, logLineMsg{stream: m.logs.stream, line: lines[i%len(lines)]})
		}

		views := map[string]model{"overview": m}
		views["settings"], _ = press(m, "c")
		views["editing"], _ = press(m, "c", "enter")
		views["log"], _ = press(m, "l")
		views["palette"], _ = press(m, ":")
		views["help"], _ = press(m, "?")
		views["asking"], _ = press(m, "R")
		for name, each := range views {
			content := each.View().Content
			if strings.Contains(content, "\x1b[2J") {
				t.Errorf("%s passes a log escape to the terminal", name)
			}
			rows := strings.Split(content, "\n")
			if len(rows) != size[1] {
				t.Errorf("%s at %dx%d has %d lines", name, size[0], size[1], len(rows))
			}
			for i, row := range rows {
				if width := ansi.StringWidth(row); width > size[0] {
					t.Errorf("%s at %dx%d: line %d is %d wide", name, size[0], size[1], i, width)
				}
			}
		}
	}
}

func TestParseLogTurnsASandboxLineIntoItsOutput(t *testing.T) {
	entry := parseLog(`Nov 13 10:00:00 box spotlight[1]: {"time":"2026-11-13T10:00:00Z","level":"INFO","msg":"sandbox","host":"h","sandbox":"sbx_1","line":"npm test","run":"r1"}`)
	if entry.source != "sbx_1" || entry.msg != "npm test" || len(entry.attrs) != 1 || entry.attrs[0].key != "run" {
		t.Fatalf("entry = %+v", entry)
	}
	if !entry.matches("SBX") || entry.matches("nothing") {
		t.Fatal("the filter does not match the source")
	}

	host := parseLog(`{"time":"x","level":"WARN","msg":"could not report","error":"timeout"}`)
	if host.source != hostSource || host.level != "WARN" || host.attrs[0].value != "timeout" {
		t.Fatalf("entry = %+v", host)
	}
	if raw := parseLog("plain text"); raw.raw != "plain text" {
		t.Fatalf("entry = %+v", raw)
	}
	if got := parseLog(`{"msg":"a\nb\tc\u001b[2J"}`).msg; got != "a⏎b c�[2J" {
		t.Fatalf("msg = %q", got)
	}
}

type closer struct {
	io.Reader
	closed int
}

func (c *closer) Close() error {
	c.closed++
	return nil
}

func TestATooLongLogLineEndsTheStreamWithANote(t *testing.T) {
	reader := &closer{Reader: strings.NewReader("first\n" + strings.Repeat("x", longestLine+1) + "\n")}
	stream := follow(func() (io.ReadCloser, error) { return reader, nil })
	if msg := stream.next()().(logLineMsg); msg.line != "first" {
		t.Fatalf("line = %q", msg.line)
	}
	ended, ok := stream.next()().(logEndedMsg)
	if !ok || ended.err == nil || !strings.Contains(ended.err.Error(), "1 MB") {
		t.Fatalf("msg = %+v", ended)
	}
	if reader.closed != 1 {
		t.Fatalf("closed %d times", reader.closed)
	}
}

func TestFollowingAgainStartsAFreshLog(t *testing.T) {
	host := &fakeHost{status: serving(0)}
	m := started(host)
	m, _ = update(m, logLineMsg{stream: m.logs.stream, line: `{"msg":"old"}`})
	m = settle(m, m.logs.stream.next())
	if !m.logs.ended {
		t.Fatal("the log did not end")
	}

	opened := 0
	host.logs = func() (io.ReadCloser, error) {
		opened++
		return io.NopCloser(strings.NewReader(`{"msg":"new"}` + "\n")), nil
	}
	m = settle(m, m.checkAgain())
	if opened != 0 {
		t.Fatal("a status poll restarted the log")
	}

	m, cmd := update(m, ranMsg{command: "spotlight host start"})
	m = settle(m, cmd)
	if opened != 1 || len(m.logs.entries) != 1 {
		t.Fatalf("opened %d, entries %+v", opened, m.logs.entries)
	}
	m = settle(m, m.logs.stream.next())
	if len(m.logs.entries) != 1 || m.logs.entries[0].msg != "new" {
		t.Fatalf("entries = %+v", m.logs.entries)
	}
}

func TestAFailedRestartKeepsTheLogAndItsNote(t *testing.T) {
	host := &fakeHost{status: serving(0)}
	m := started(host)
	m, _ = update(m, logLineMsg{stream: m.logs.stream, line: `{"msg":"old"}`})
	m = settle(m, m.logs.stream.next())

	m, cmd := update(m, ranMsg{command: "spotlight host restart"})
	m = settle(m, cmd)
	m = settle(m, m.logs.stream.next())
	if m.logs.note != "no service" || len(m.logs.entries) != 1 || m.logs.entries[0].msg != "old" {
		t.Fatalf("note %q entries %+v", m.logs.note, m.logs.entries)
	}
}

func TestLastLineDropsTheMarkAndPrefix(t *testing.T) {
	for output, want := range map[string]string{
		"  ✓ Saved capacity\n  ✓ The host restarts": "The host restarts",
		"spotlight host: nothing changed":           "nothing changed",
		"":                                          "",
	} {
		if got := lastLine(output); got != want {
			t.Errorf("lastLine(%q) = %q", output, got)
		}
	}
}

func TestAMachineWithoutAHostShowsOneCalmLine(t *testing.T) {
	host := &fakeHost{status: Status{Name: "Leon-MBP.fritz.box", Checks: []Check{{Name: "settings", Level: console.Failed, Message: "There are no settings."}}}}
	host.logins = []Login{{Address: "https://app.usespotlight.ai", User: "leon@example.com"}}
	m := sized(started(host), 80, 30)
	view := screenText(m)
	for _, want := range []string{"host        ○ not set up on this computer", "editors     ○ not set up for VS Code or Cursor"} {
		if !strings.Contains(view, want) {
			t.Errorf("view lacks %q:\n%s", want, view)
		}
	}
	for _, unwanted := range []string{"Leon-MBP", "✗", "checks", "── log", "There are no settings"} {
		if strings.Contains(view, unwanted) {
			t.Errorf("view shows %q:\n%s", unwanted, view)
		}
	}
	if keys := footerKeys(m); !slices.Contains(keys, "i") || !slices.Contains(keys, "e") || slices.Contains(keys, "c") || slices.Contains(keys, "l") {
		t.Errorf("footer keys %v", keys)
	}
	if !strings.Contains(view, "i set up a host") {
		t.Errorf("view:\n%s", view)
	}
}

func TestEditorsShowWhatSshSetupSetUp(t *testing.T) {
	host := &fakeHost{status: serving(0), editors: EditorSetup{Configured: true, Editors: []Editor{
		{Name: "VS Code", Ready: true},
		{Name: "Cursor", Message: "Cursor waits 20 seconds for a connection."},
	}}}
	m := sized(started(host), 100, 30)
	view := screenText(m)
	for _, want := range []string{"editors     ✓ ssh   ✓ VS Code   ! Cursor", "! Cursor waits 20 seconds for a connection.", "spotlight ssh setup", "e editors"} {
		if !strings.Contains(view, want) {
			t.Errorf("view lacks %q:\n%s", want, view)
		}
	}

	m, _ = press(m, "e")
	if m.mode != loggingIn {
		t.Fatalf("e does not log in first: mode %v", m.mode)
	}
}

func TestEditorsSetUpAsksForTheTimeoutOfSlowEditors(t *testing.T) {
	host := &fakeHost{
		status:  serving(0),
		address: "https://app.usespotlight.ai",
		logins:  []Login{{Address: "https://app.usespotlight.ai", User: "leon@example.com"}},
		editors: EditorSetup{Configured: true, Editors: []Editor{{Name: "VS Code", Ready: true}, {Name: "Cursor"}}},
	}
	m, _ := press(started(host), "e")
	if m.mode != asking || !strings.HasPrefix(m.question.text, "Let Cursor wait up to 10 minutes to connect?") {
		t.Fatalf("mode %v question %+v", m.mode, m.question)
	}
	if keys := footerKeys(m); !slices.Equal(keys, []string{"y", "n", "esc"}) {
		t.Errorf("footer keys %v", keys)
	}

	m, cmd := press(sized(m, 160, 30), "n")
	if m.running != "spotlight ssh setup --url https://app.usespotlight.ai --no-editor-timeout" {
		t.Fatalf("running %q", m.running)
	}
	m = settle(m, cmd)
	if !slices.Equal(host.ranWith("ssh", "setup"), []string{"ssh setup --url https://app.usespotlight.ai --no-editor-timeout"}) {
		t.Fatalf("ran %v", host.ran)
	}
	if view := screenText(m); !strings.Contains(view, "✓ spotlight ssh setup --url https://app.usespotlight.ai --no-editor-timeout   Open a task in VS Code or Cursor from Spotlight.") {
		t.Errorf("view:\n%s", view)
	}

	m, _ = press(m, "e", "esc")
	if m.mode != browsing || len(host.ranWith("ssh", "setup")) != 1 {
		t.Fatalf("esc did not cancel: mode %v ran %v", m.mode, host.ran)
	}
}

func TestTheEditorsChoiceLogsInThenSetsUpSsh(t *testing.T) {
	host := &fakeHost{status: notInstalled()}
	m, _ := press(sized(started(host), 100, 30), "enter")
	if m.mode != loggingIn {
		t.Fatalf("mode %v", m.mode)
	}
	m, cmd := press(m, "enter")
	m = settle(m, cmd)
	if !slices.Equal(host.ranWith("ssh", "setup"), []string{"ssh setup --url https://app.usespotlight.ai --no-editor-timeout"}) {
		t.Fatalf("ran %v", host.ran)
	}
	if m.mode != browsing || m.firstRun() {
		t.Fatalf("mode %v first run %v", m.mode, m.firstRun())
	}
}

func TestReadyEditorsKeepTheFooterShort(t *testing.T) {
	host := &fakeHost{status: serving(0), editors: EditorSetup{Configured: true, Editors: []Editor{{Name: "VS Code", Ready: true}}}}
	if keys := footerKeys(started(host)); slices.Contains(keys, "e") {
		t.Errorf("footer keys %v", keys)
	}
}

func TestThePalettePlaceholderShowsInFull(t *testing.T) {
	m := sized(started(&fakeHost{status: serving(0)}), 80, 30)
	m, _ = press(m, ":")
	if view := screenText(m); !strings.Contains(view, ": type a command") {
		t.Errorf("view:\n%s", view)
	}
}

func TestHelpScrollsWhenItDoesNotFit(t *testing.T) {
	m := sized(started(&fakeHost{status: serving(0)}), 80, 30)
	m, _ = press(m, "?")
	if !slices.Contains(footerKeys(m), "↑↓") {
		t.Fatalf("footer keys %v", footerKeys(m))
	}
	before := screenText(m)
	m, _ = press(m, "down")
	if m.helpTop != 1 || screenText(m) == before {
		t.Fatalf("help top %d", m.helpTop)
	}
	for range 100 {
		m, _ = press(m, "down")
	}
	if view := screenText(m); !strings.Contains(view, "Each action runs a spotlight command") {
		t.Errorf("the end of the help does not show:\n%s", view)
	}
}

func TestQuitSaysTheHostKeepsServingOnlyWhenItServes(t *testing.T) {
	for _, each := range []struct {
		status Status
		want   bool
	}{{serving(0), true}, {notInstalled(), false}} {
		m := started(&fakeHost{status: each.status})
		lines := m.helpLines()[sectionViews]
		if got := slices.Contains(lines, hint{key: "q", label: "quit; the host keeps serving"}); got != each.want {
			t.Errorf("serving %v: help %v", each.status.Service.Running, lines)
		}
	}
}

func TestTheFooterKeepsKeysAndQuitWhenItIsNarrow(t *testing.T) {
	m := sized(started(&fakeHost{status: serving(0)}), 60, 30)
	footer := strings.Split(screenText(m), "\n")[29]
	if !strings.Contains(footer, "? keys   q quit") || !strings.Contains(footer, "s stop") || strings.Contains(footer, "…") {
		t.Errorf("footer %q", footer)
	}
}

func TestAComputerWithNothingSetUpAsksWhatItIsFor(t *testing.T) {
	m := sized(started(&fakeHost{status: notInstalled()}), 80, 30)
	view := screenText(m)
	for _, want := range []string{"What do you want to do here?", "▌ Open tasks in VS Code or Cursor", "spotlight ssh setup", "Run agents on this computer", "spotlight host init", "spotlight login"} {
		if !strings.Contains(view, want) {
			t.Errorf("view lacks %q:\n%s", want, view)
		}
	}
	if keys := footerKeys(m); !slices.Equal(keys, []string{"↑↓", "enter", ":", "?", "q"}) {
		t.Errorf("footer keys %v", keys)
	}

	m, cmd := press(m, "down", "enter")
	if m.running != "spotlight host init" || cmd == nil {
		t.Fatalf("running = %q", m.running)
	}
}

func TestTheChooserStillLogsInWithA(t *testing.T) {
	m, _ := press(started(&fakeHost{status: notInstalled()}), "a")
	if m.mode != loggingIn {
		t.Fatalf("mode %v", m.mode)
	}
}

func TestTheChooserWaitsForTheLogins(t *testing.T) {
	host := &fakeHost{status: notInstalled()}
	m := newModel(host, host, host, nil, "dev")
	m = settle(m, m.check())
	m = settle(m, m.loadEditors())
	if m.firstRun() {
		t.Fatal("the chooser shows before the logins are read")
	}
}

func TestAHostOfRootSaysToUseSudo(t *testing.T) {
	status := notInstalled()
	status.AsRoot = true
	m := sized(started(&fakeHost{status: status}), 80, 30)
	view := screenText(m)
	if !strings.Contains(view, "host        ○ belongs to root · to manage it, run: sudo spotlight") || strings.Contains(view, "What do you want") {
		t.Errorf("view:\n%s", view)
	}
	if slices.Contains(footerKeys(m), "i") {
		t.Errorf("footer keys %v", footerKeys(m))
	}
}

func TestUnderSudoThePersonsLinesAreHidden(t *testing.T) {
	host := &fakeHost{status: serving(0)}
	m := newModel(host, nil, nil, nil, "dev")
	m = settle(m, m.check())
	m = settle(m, m.loadLogins())
	m = sized(settle(m, m.loadEditors()), 100, 30)
	view := screenText(m)
	if strings.Contains(view, "account") || strings.Contains(view, "editors") || !strings.Contains(view, "● serving") {
		t.Errorf("view:\n%s", view)
	}
	if keys := footerKeys(m); slices.Contains(keys, "a") || slices.Contains(keys, "e") {
		t.Errorf("footer keys %v", keys)
	}
}

func TestUpdateRunsSpotlightUpdateAfterAsking(t *testing.T) {
	host := &fakeHost{status: serving(0)}
	m, _ := press(started(host), "u")
	if m.mode != asking {
		t.Fatalf("mode %v", m.mode)
	}
	m, cmd := press(m, "y")
	if m.running != "spotlight update" {
		t.Fatalf("running %q", m.running)
	}
	settle(m, cmd)
	if len(host.ran) != 1 || host.ranArgs(0) != "update" {
		t.Fatalf("ran %v", host.ran)
	}

	if m, _ := press(started(&fakeHost{status: notInstalled(), editors: EditorSetup{Configured: true}}), "u"); m.mode == asking {
		t.Error("u asks to update a computer without a host")
	}
}

func TestAnAttachedCommandWaitsForEnterAfterItEnds(t *testing.T) {
	var out bytes.Buffer
	run := paused{cmd: exec.Command("echo", "Connected."), shown: "spotlight host init"}
	run.SetStdin(strings.NewReader("\n"))
	run.SetStdout(&out)
	run.SetStderr(&out)
	if err := run.Run(); err != nil {
		t.Fatal(err)
	}
	if got := out.String(); got != clearScreen+"$ spotlight host init\n\nConnected.\n\nPress Enter to go back to spotlight." {
		t.Errorf("printed %q", got)
	}
}

func TestOneLoginCanLogInToAnotherAddress(t *testing.T) {
	host := &fakeHost{status: serving(0), logins: []Login{{Address: "https://app.usespotlight.ai", User: "leon@example.com"}}}
	m, _ := press(started(host), ":")
	var names []string
	for _, each := range search(m.paletteActions(), "log in") {
		names = append(names, each.name)
	}
	if !slices.Contains(names, "log in") {
		t.Fatalf("found %v", names)
	}
}

func TestReloadNeedsAHost(t *testing.T) {
	host := &fakeHost{status: notInstalled()}
	m, _ := press(started(host), "o")
	if m.running != "" || len(host.ran) != 0 {
		t.Fatalf("running %q ran %v", m.running, host.ran)
	}
	for _, each := range m.paletteActions() {
		if each.name == "reload env files" {
			t.Fatal("the palette offers reload without a host")
		}
	}
}

func TestAStaleLoginsReloadDoesNotDropANewLogin(t *testing.T) {
	host := &fakeHost{status: notInstalled(), editors: EditorSetup{Configured: true}}
	m := started(host)
	stale := m.loadLogins()()

	m, cmd := press(m, "a", "enter")
	m, wait := loginStarted(t, m, cmd)
	m = settle(m, wait)
	m, _ = update(m, stale)
	if !m.loggedIn("https://app.usespotlight.ai") {
		t.Fatalf("logins %v", m.logins.all)
	}
}

func TestSeveralLoginsChooseTheAddressForTheEditors(t *testing.T) {
	host := &fakeHost{status: serving(0), logins: []Login{{Address: "https://app.usespotlight.ai"}, {Address: "http://localhost:3000"}}}
	m, _ := press(started(host), "e")
	if m.mode != commanding || m.palette.input.Value() != "set up editors for " {
		t.Fatalf("mode %v query %q", m.mode, m.palette.input.Value())
	}
	m, cmd := press(m, "enter")
	settle(m, cmd)
	if got := host.ranWith("ssh", "setup"); len(got) != 1 || !strings.Contains(got[0], "--url http") {
		t.Fatalf("ran %v", got)
	}
}

func TestALoginNoteKeepsTheChooserHidden(t *testing.T) {
	m := started(&fakeHost{status: notInstalled()})
	m, _ = update(m, loginsMsg{err: errors.New("the logins cannot be read")})
	if m.firstRun() {
		t.Fatal("the chooser hides a login error")
	}
}
