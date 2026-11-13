package dashboard

import (
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

	logins    []Login
	loggedOut []string

	editors EditorSetup
}

func (f *fakeHost) Editors() EditorSetup { return f.editors }
func (f *fakeHost) Setup() *exec.Cmd     { return exec.Command("true") }

func (f *fakeHost) Logins() ([]Login, error) { return f.logins, nil }
func (f *fakeHost) Login() *exec.Cmd         { return exec.Command("true") }

func (f *fakeHost) Logout(address string) (string, error) {
	f.loggedOut = append(f.loggedOut, address)
	return "Logged out of " + address + ".", nil
}

func (f *fakeHost) Run(args []string, input string) (string, error) {
	f.ran = append(f.ran, args)
	f.inputs = append(f.inputs, input)
	return "  ✓ done", nil
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

func update(m model, msg tea.Msg) (model, tea.Cmd) {
	next, cmd := m.Update(msg)
	return next.(model), cmd
}

func deliver(m model, cmd tea.Cmd) model {
	if cmd == nil {
		return m
	}
	switch msg := cmd().(type) {
	case tea.BatchMsg:
		for _, each := range msg {
			m = deliver(m, each)
		}
		return m
	case tickMsg, nil:
		return m
	default:
		m, _ = update(m, msg)
		return m
	}
}

func started(host *fakeHost) model {
	m := newModel(host, host, host, "20261113-01")
	m = deliver(m, m.check())
	m = deliver(m, m.loadLogins())
	m = deliver(m, m.loadEditors())
	return deliver(m, m.loadSettings())
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
	m = deliver(m, cmd)

	if len(host.ran) != 1 || host.ranArgs(0) != "restart" {
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
	deliver(press(m, "y"))
	if len(host.ran) != 1 || host.ranArgs(0) != "stop" {
		t.Fatalf("ran %v", host.ran)
	}
}

func TestStartsAStoppedHostWithoutAsking(t *testing.T) {
	host := &fakeHost{status: serving(0)}
	host.status.Service.Running = false
	deliver(press(started(host), "s"))
	if len(host.ran) != 1 || host.ranArgs(0) != "start" {
		t.Fatalf("ran %v", host.ran)
	}
}

func TestServiceActionsNeedAnInstalledService(t *testing.T) {
	host := &fakeHost{status: notInstalled()}
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
	m := newModel(&fakeHost{}, &fakeHost{}, &fakeHost{}, "dev")
	if slices.Contains(footerKeys(m), "i") {
		t.Fatal("init shows before the host is checked")
	}
}

func TestLogsInWhenThereIsNoLogin(t *testing.T) {
	m := started(&fakeHost{status: notInstalled()})
	if !strings.Contains(screenText(m), "account     ○ not logged in") || !slices.Contains(footerKeys(m), "a") {
		t.Fatalf("view:\n%s", screenText(m))
	}
	m, cmd := press(m, "a")
	if m.running != "spotlight login" || cmd == nil {
		t.Fatalf("running = %q", m.running)
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
	deliver(m, cmd)
	if !slices.Equal(host.loggedOut, []string{"https://app.usespotlight.ai"}) {
		t.Fatalf("logged out of %v", host.loggedOut)
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
	m = deliver(m, cmd)
	if host.ranArgs(0) != "config set capacity --stdin" || host.inputs[0] != "8" {
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
	deliver(m, cmd)
	if host.ranArgs(1) != "config set token --stdin" || host.inputs[1] != "new-token" {
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
	m = deliver(press(m, "enter"))
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
	deliver(m, cmd)
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
	deliver(press(m, "enter"))
	if host.ranArgs(0) != "config set image --stdin" || host.inputs[0] != "runner:2" {
		t.Fatalf("ran %q", host.ranArgs(0))
	}
}

func TestUnsetsOnlyASetSetting(t *testing.T) {
	host := &fakeHost{status: serving(0), rows: []Setting{setting(t, "image", ""), setting(t, "capacity", "5")}}
	m, _ := press(started(host), "c")

	m = deliver(press(m, "x"))
	if len(host.ran) != 0 {
		t.Fatalf("unset a setting that is not set: %v", host.ran)
	}
	deliver(press(m, "j", "x"))
	if host.ranArgs(0) != "config unset capacity" {
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
	m = deliver(press(m, "enter"))
	if m.mode != browsing || len(host.ran) != 1 || host.ranArgs(0) != "reload" {
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
	m = deliver(m, stale)
	if !m.checking {
		t.Fatal("the stale check ended the new one")
	}
	host.status.Service.Running = false
	m = deliver(m, cmd)
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
		for _, state := range []mode{browsing, asking, commanding, helping, editing, filtering} {
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
	m = deliver(m, m.logs.stream.next())
	if !m.logs.ended {
		t.Fatal("the log did not end")
	}

	opened := 0
	host.logs = func() (io.ReadCloser, error) {
		opened++
		return io.NopCloser(strings.NewReader(`{"msg":"new"}` + "\n")), nil
	}
	m = deliver(m, m.checkAgain())
	if opened != 0 {
		t.Fatal("a status poll restarted the log")
	}

	m, cmd := update(m, ranMsg{command: "spotlight host start"})
	m = deliver(m, cmd)
	if opened != 1 || len(m.logs.entries) != 1 {
		t.Fatalf("opened %d, entries %+v", opened, m.logs.entries)
	}
	m = deliver(m, m.logs.stream.next())
	if len(m.logs.entries) != 1 || m.logs.entries[0].msg != "new" {
		t.Fatalf("entries = %+v", m.logs.entries)
	}
}

func TestAFailedRestartKeepsTheLogAndItsNote(t *testing.T) {
	host := &fakeHost{status: serving(0)}
	m := started(host)
	m, _ = update(m, logLineMsg{stream: m.logs.stream, line: `{"msg":"old"}`})
	m = deliver(m, m.logs.stream.next())

	m, cmd := update(m, ranMsg{command: "spotlight host restart"})
	m = deliver(m, cmd)
	m = deliver(m, m.logs.stream.next())
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
	m := sized(started(&fakeHost{status: Status{Name: "Leon-MBP.fritz.box", Checks: []Check{{Name: "settings", Level: console.Failed, Message: "There are no settings."}}}}), 80, 30)
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

	m, cmd := press(m, "e")
	if m.running != "spotlight ssh setup" || cmd == nil {
		t.Fatalf("running = %q", m.running)
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
