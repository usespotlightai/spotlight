package dashboard

import (
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"usespotlight.ai/data-plane/console"

	"charm.land/bubbles/v2/spinner"
	"charm.land/bubbles/v2/textinput"
	"charm.land/bubbles/v2/viewport"
	tea "charm.land/bubbletea/v2"
)

const refreshEvery = 5 * time.Second

type screen int

const (
	overviewScreen screen = iota
	settingsScreen
	logScreen
)

type mode int

const (
	browsing mode = iota
	asking
	commanding
	helping
	editing
	filtering
	loggingIn
	settingUp
)

type outcome struct {
	command string
	output  string
	failed  bool
}

type question struct {
	text string
	do   func(model) (tea.Model, tea.Cmd)
	no   func(model) (tea.Model, tea.Cmd)
}

type (
	statusMsg struct {
		status Status
		check  int
	}
	tickMsg     struct{}
	ranMsg      outcome
	settingsMsg struct {
		rows []Setting
		err  error
	}
	loginsMsg struct {
		logins []Login
		err    error
		load   int
	}
	editorsMsg EditorSetup
)

type logView struct {
	stream  *logStream
	ended   bool
	retry   bool
	replace bool
	note    string
	entries []logEntry
	scroll  viewport.Model
	filter  textinput.Model
}

type settingsView struct {
	rows    []Setting
	note    string
	cursor  int
	editing string
	input   textinput.Model
	filter  textinput.Model
}

type loginsView struct {
	all    []Login
	note   string
	loaded bool
	load   int
}

type paletteView struct {
	input  textinput.Model
	cursor int
}

type model struct {
	host    Host
	account Account
	editors Editors
	setup   Setup
	version string
	style   styles

	width, height int
	screen        screen
	mode          mode

	status   *Status
	checks   int
	checking bool
	spinner  spinner.Model
	spinning bool

	running  string
	last     *outcome
	question *question

	logins loginsView
	choice int

	editorSetup *EditorSetup
	helpTop     int
	setUpFirst  *string

	logs      logView
	settings  settingsView
	palette   paletteView
	login     loginView
	setupView setupView
}

func newInput(placeholder string) textinput.Model {
	input := textinput.New()
	input.Prompt = ""
	input.Placeholder = placeholder
	return input
}

func newModel(host Host, account Account, editors Editors, setup Setup, version string) model {
	m := model{
		host:     host,
		account:  account,
		editors:  editors,
		setup:    setup,
		version:  version,
		style:    terminalStyles(),
		width:    100,
		height:   30,
		checks:   1,
		checking: true,
		spinner:  spinner.New(spinner.WithSpinner(spinner.MiniDot)),
		spinning: true,
		logs: logView{
			stream: follow(host.Logs),
			scroll: viewport.New(),
			filter: newInput("filter the log"),
		},
		settings:  settingsView{input: newInput(""), filter: newInput("filter the settings")},
		palette:   paletteView{input: newInput("type a command")},
		login:     newLoginView(),
		setupView: newSetupView(),
	}
	m.resize()
	return m
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.check(), m.loadSettings(), m.loadLogins(), m.loadEditors(), tick(), m.logs.stream.next(), m.spinner.Tick)
}

func tick() tea.Cmd {
	return tea.Tick(refreshEvery, func(time.Time) tea.Msg { return tickMsg{} })
}

func (m model) check() tea.Cmd {
	host, check := m.host, m.checks
	return func() tea.Msg { return statusMsg{status: host.Status(), check: check} }
}

func (m *model) checkAgain() tea.Cmd {
	m.checks++
	m.checking = true
	return m.check()
}

func (m model) loadSettings() tea.Cmd {
	host := m.host
	return func() tea.Msg {
		rows, err := host.Settings()
		return settingsMsg{rows: rows, err: err}
	}
}

func (m model) loadLogins() tea.Cmd {
	account, load := m.account, m.logins.load
	if account == nil {
		return nil
	}
	return func() tea.Msg {
		logins, err := account.Logins()
		return loginsMsg{logins: logins, err: err, load: load}
	}
}

func (m *model) reloadLogins() tea.Cmd {
	m.logins.load++
	return m.loadLogins()
}

func (m model) loadEditors() tea.Cmd {
	editors := m.editors
	if editors == nil {
		return nil
	}
	return func() tea.Msg { return editorsMsg(editors.Inspect()) }
}

func (m model) busy() bool {
	return m.running != "" || m.status == nil || m.waitingForLogin() || m.waitingForSetup()
}

func (m *model) spin() tea.Cmd {
	if m.spinning {
		return nil
	}
	m.spinning = true
	return m.spinner.Tick
}

func shownCommand(args []string) string {
	return strings.Join(append([]string{"spotlight"}, args...), " ")
}

func hosting(args ...string) []string {
	return append([]string{"host"}, args...)
}

func (m model) run(args ...string) (tea.Model, tea.Cmd) {
	return m.runShown(shownCommand(args), "", args...)
}

func (m model) runShown(shown, input string, args ...string) (tea.Model, tea.Cmd) {
	host := m.host
	return m.start(shown, func() (string, error) { return host.Run(args, input) })
}

func (m model) start(shown string, do func() (string, error)) (tea.Model, tea.Cmd) {
	if m.running != "" {
		return m, nil
	}
	m.running, m.question, m.mode = shown, nil, browsing
	return m, tea.Batch(m.spin(), func() tea.Msg {
		out, err := do()
		if err != nil && out == "" {
			out = err.Error()
		}
		return ranMsg{command: shown, output: out, failed: err != nil}
	})
}

func (m model) attach(args ...string) (tea.Model, tea.Cmd) {
	return m.hand(shownCommand(args), m.host.Attach(args))
}

func (m model) hand(shown string, cmd *exec.Cmd) (tea.Model, tea.Cmd) {
	if m.running != "" {
		return m, nil
	}
	m.running, m.question, m.mode = shown, nil, browsing
	return m, tea.Exec(paused{cmd: cmd, shown: shown}, func(err error) tea.Msg {
		out := ""
		var exit *exec.ExitError
		switch {
		case errors.As(err, &exit) && (exit.ExitCode() == console.StoppedExit || exit.ExitCode() == -1):
			out = "stopped"
		case errors.As(err, &exit):
			out = fmt.Sprintf("exited with code %d", exit.ExitCode())
		case err != nil:
			out = err.Error()
		}
		return ranMsg{command: shown, output: out, failed: err != nil}
	})
}

func (m model) ask(text string, yes, no func(model) (tea.Model, tea.Cmd)) (tea.Model, tea.Cmd) {
	if m.running != "" {
		return m, nil
	}
	m.question, m.mode = &question{text: text, do: yes, no: no}, asking
	return m, nil
}

func runs(args ...string) func(model) (tea.Model, tea.Cmd) {
	return func(m model) (tea.Model, tea.Cmd) { return m.run(args...) }
}

func (m model) askWhenBusy(action string, args ...string) (tea.Model, tea.Cmd) {
	switch busy := m.sandboxes(); busy {
	case 0:
		return m.run(args...)
	case 1:
		return m.ask(action+"? This stops its running sandbox.", runs(args...), nil)
	default:
		return m.ask(fmt.Sprintf("%s? This stops its %d running sandboxes.", action, busy), runs(args...), nil)
	}
}

func (m model) update() (tea.Model, tea.Cmd) {
	return m.ask("Replace this binary with the release of the control plane?", runs("update"), nil)
}

func (m model) sandboxes() int {
	if m.status == nil || m.status.Sandboxes.Running == nil {
		return 0
	}
	return *m.status.Sandboxes.Running
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		m.resize()
		return m, nil

	case spinner.TickMsg:
		if !m.busy() {
			m.spinning = false
			return m, nil
		}
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case tickMsg:
		if m.checking {
			return m, tick()
		}
		return m, tea.Batch(m.checkAgain(), tick())

	case statusMsg:
		if msg.check != m.checks {
			return m, nil
		}
		started := m.status != nil && !m.status.Service.Running && msg.status.Service.Running
		m.status, m.checking = &msg.status, false
		retry := m.logs.retry || started
		m.logs.retry = false
		if !retry {
			return m, nil
		}
		return m, m.followAgain()

	case settingsMsg:
		m.settings.rows, m.settings.note = msg.rows, ""
		if msg.err != nil {
			m.settings.note = msg.err.Error()
		}
		m.keepCursor()
		return m, nil

	case ranMsg:
		result := outcome(msg)
		m.running, m.last, m.logs.retry = "", &result, true
		return m, tea.Batch(m.checkAgain(), m.loadSettings(), m.reloadLogins(), m.loadEditors())

	case loginsMsg:
		if msg.load != m.logins.load {
			return m, nil
		}
		m.logins.all, m.logins.note, m.logins.loaded = msg.logins, "", true
		if msg.err != nil {
			m.logins.note = msg.err.Error()
		}
		if address := m.setUpFirst; address != nil {
			m.setUpFirst = nil
			return m.setUpHostAt(*address)
		}
		return m, nil

	case loginStartedMsg:
		return m.loginStarted(msg)

	case loginDoneMsg:
		return m.loginDone(msg)

	case loginPageMsg:
		return m.loginPageOpened(msg)

	case setupLoadedMsg:
		return m.setupLoaded(msg)

	case setupHeldMsg:
		return m.setupHeld(msg)

	case setupStepMsg:
		return m.setupStepDone(msg)

	case buildLineMsg:
		return m.buildLine(msg)

	case editorsMsg:
		setup := EditorSetup(msg)
		m.editorSetup = &setup
		return m, nil

	case logLineMsg:
		if msg.stream != m.logs.stream {
			return m, nil
		}
		if m.logs.replace {
			m.logs.entries, m.logs.note, m.logs.replace = nil, "", false
		}
		entry := parseLog(msg.line)
		entry.rendered = entry.render(m.style)
		m.logs.entries = append(m.logs.entries, entry)
		if over := len(m.logs.entries) - logKept; over > 0 {
			m.logs.entries = m.logs.entries[over:]
		}
		m.refreshLog()
		return m, m.logs.stream.next()

	case logEndedMsg:
		if msg.stream != m.logs.stream {
			return m, nil
		}
		m.logs.ended = true
		if msg.err != nil {
			m.logs.note = msg.err.Error()
		}
		return m, nil

	case tea.KeyPressMsg:
		return m.press(msg)
	}
	return m.typeInto(msg)
}

func (m *model) followAgain() tea.Cmd {
	if !m.logs.ended || m.status == nil || !m.status.Service.Installed {
		return nil
	}
	m.logs.stream, m.logs.ended, m.logs.replace = follow(m.host.Logs), false, true
	return m.logs.stream.next()
}

func (m *model) resize() {
	for _, input := range []*textinput.Model{&m.palette.input, &m.logs.filter, &m.settings.filter, &m.settings.input} {
		input.SetWidth(max(m.width-len(gutter)*2-2, 1))
	}
	m.login.input.SetWidth(max(m.width-len(gutter)*2-labelColumn-1, 1))
	m.setupView.input.SetWidth(max(m.width-len(gutter)*2-labelColumn-1, 1))
	m.helpTop = min(m.helpTop, m.lastHelpTop())
	m.logs.scroll.SetWidth(m.width)
	m.logs.scroll.SetHeight(max(m.bodyHeight()-1, 1))
	m.refreshLog()
}

func (m *model) refreshLog() {
	following := m.logs.scroll.AtBottom()
	filter := m.logs.filter.Value()
	var lines []string
	for _, entry := range m.logs.entries {
		if entry.matches(filter) {
			lines = append(lines, gutter+entry.rendered)
		}
	}
	m.logs.scroll.SetContentLines(lines)
	if following {
		m.logs.scroll.GotoBottom()
	}
}

func (m *model) filter() *textinput.Model {
	if m.screen == logScreen {
		return &m.logs.filter
	}
	return &m.settings.filter
}

func (m *model) filterChanged() {
	if m.screen == logScreen {
		m.refreshLog()
		return
	}
	m.settings.cursor = 0
}

func (m model) typeInto(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	switch m.mode {
	case commanding:
		before := m.palette.input.Value()
		m.palette.input, cmd = m.palette.input.Update(msg)
		if m.palette.input.Value() != before {
			m.palette.cursor = 0
		}
	case editing:
		m.settings.input, cmd = m.settings.input.Update(msg)
	case loggingIn:
		if m.login.step == addressStep {
			m.login.input, cmd = m.login.input.Update(msg)
		}
	case settingUp:
		if m.setupView.input.Focused() {
			m.setupView.input, cmd = m.setupView.input.Update(msg)
		}
	case filtering:
		filter := m.filter()
		before := filter.Value()
		*filter, cmd = filter.Update(msg)
		if filter.Value() != before {
			m.filterChanged()
		}
	}
	return m, cmd
}

func (m model) press(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	key := msg.String()
	if key == "ctrl+c" {
		return m, tea.Quit
	}
	for _, each := range m.keymap().all() {
		if each.bound(key) {
			return each.do(m)
		}
	}
	return m.typeInto(msg)
}

func (m model) answer(yes bool) (tea.Model, tea.Cmd) {
	switch {
	case m.question == nil:
	case yes:
		return m.question.do(m)
	case m.question.no != nil:
		return m.question.no(m)
	}
	m.question, m.mode = nil, browsing
	return m, nil
}

func (m model) dismiss() (tea.Model, tea.Cmd) {
	m.question, m.mode = nil, browsing
	return m, nil
}

func (m model) startFilter() (tea.Model, tea.Cmd) {
	m.mode = filtering
	return m, m.filter().Focus()
}

func (m model) endFilter(clear bool) (tea.Model, tea.Cmd) {
	filter := m.filter()
	if clear {
		filter.SetValue("")
		m.filterChanged()
	}
	filter.Blur()
	m.mode = browsing
	return m, nil
}

func (m model) goBack() (tea.Model, tea.Cmd) {
	if filter := m.filter(); m.screen != overviewScreen && filter.Value() != "" {
		filter.SetValue("")
		m.filterChanged()
		return m, nil
	}
	m.screen = overviewScreen
	return m, nil
}

func (m model) toggle(target screen) (tea.Model, tea.Cmd) {
	if m.screen == target {
		m.screen = overviewScreen
		return m, nil
	}
	m.screen = target
	switch target {
	case settingsScreen:
		return m, m.loadSettings()
	case logScreen:
		m.logs.scroll.GotoBottom()
	}
	return m, nil
}

func (m model) recheck() (tea.Model, tea.Cmd) {
	if m.checking {
		return m, nil
	}
	return m, m.checkAgain()
}

func (m model) openHelp() (tea.Model, tea.Cmd) {
	m.mode, m.helpTop = helping, 0
	return m, nil
}

func (m model) closeHelp() (tea.Model, tea.Cmd) {
	m.mode = browsing
	return m, nil
}

func scrollHelp(by int) func(model) (tea.Model, tea.Cmd) {
	return func(m model) (tea.Model, tea.Cmd) {
		m.helpTop = min(max(m.helpTop+by, 0), m.lastHelpTop())
		return m, nil
	}
}

func (m model) lastHelpTop() int {
	return max(len(m.helpBody())-m.bodyHeight(), 0)
}
