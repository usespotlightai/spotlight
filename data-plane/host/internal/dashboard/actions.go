package dashboard

import (
	"slices"
	"strings"

	"charm.land/bubbles/v2/key"
	"charm.land/bubbles/v2/viewport"
	tea "charm.land/bubbletea/v2"
)

const (
	sectionHost     = "host"
	sectionAccount  = "account"
	sectionEditors  = "editors"
	sectionViews    = "views"
	sectionSettings = "settings"
	sectionLog      = "log"
)

var helpColumns = [][]string{{sectionHost, sectionAccount, sectionEditors, sectionViews}, {sectionSettings, sectionLog}}

// action is the one place a key, its footer label, its help line and its palette entry come from.
type action struct {
	name     string
	keys     []string
	keyLabel string
	helpKeys string
	label    string
	help     string
	section  string
	command  string
	setting  bool
	disabled bool
	do       func(model) (tea.Model, tea.Cmd)
}

func (a action) footerKey() string {
	if a.keyLabel != "" {
		return a.keyLabel
	}
	if len(a.keys) == 0 {
		return ""
	}
	return a.keys[0]
}

func (a action) helpKey() string {
	if a.helpKeys != "" {
		return a.helpKeys
	}
	return strings.Join(a.keys, " ")
}

func (a action) bound(key string) bool {
	return !a.disabled && a.do != nil && slices.Contains(a.keys, key)
}

type hint struct {
	key, label string
}

// keymap holds the actions bound now: shown ones are in the footer, the others only answer their keys.
type keymap struct {
	shown, hidden []action
}

func (k keymap) all() []action {
	return slices.Concat(k.shown, k.hidden)
}

func (m model) keymap() keymap {
	switch m.mode {
	case asking:
		return keymap{shown: m.answerActions()}
	case loggingIn:
		return keymap{shown: m.loginKeys()}
	case commanding:
		return keymap{shown: paletteKeys()}
	case helping:
		return keymap{shown: m.helpKeys()}
	case editing:
		return keymap{shown: editKeys()}
	case filtering:
		return keymap{shown: filterKeys()}
	}

	switch m.screen {
	case settingsScreen:
		return keymap{shown: settingsActions(), hidden: slices.Concat(m.viewActions(), m.hostActions(), m.accountActions(), m.editorActions())}
	case logScreen:
		return keymap{shown: m.logActions(), hidden: m.viewActions()}
	default:
		if m.firstRun() {
			return keymap{shown: slices.Concat(chooserKeys(), m.viewActions()), hidden: slices.Concat(m.hostActions(), m.accountActions(), m.editorActions())}
		}
		return keymap{shown: slices.Concat(m.hostActions(), m.accountActions(), m.editorActions(), m.viewActions())}
	}
}

func (m model) helpKeys() []action {
	scroll := len(m.helpBody()) > m.bodyHeight()
	return []action{
		{keys: []string{"up", "k"}, keyLabel: "↑↓", label: "scroll", disabled: !scroll, do: scrollHelp(-1)},
		{keys: []string{"down", "j"}, disabled: !scroll, do: scrollHelp(1)},
		{keys: []string{"pgup", "b"}, disabled: !scroll, do: scrollHelp(-m.bodyHeight())},
		{keys: []string{"pgdown", "f", "space"}, disabled: !scroll, do: scrollHelp(m.bodyHeight())},
		{keys: []string{"esc", "?", "q"}, label: "close", do: model.closeHelp},
	}
}

func (m model) setUp() bool {
	return m.status != nil && m.status.SetUp
}

func (m model) editorActions() []action {
	editors := action{
		name: "set up editors", keys: []string{"e"}, section: sectionEditors, command: editorsCommand(),
		help: "set up ssh for VS Code and Cursor", disabled: m.editors == nil, do: model.setUpEditors,
	}
	if setup := m.editorSetup; setup != nil && (!setup.Configured || len(setup.waiting()) > 0) {
		editors.label = "editors"
	}
	return []action{editors}
}

func (m model) accountActions() []action {
	account := action{keys: []string{"a"}, section: sectionAccount, help: "log in, or log out", disabled: m.account == nil}
	switch len(m.logins.all) {
	case 0:
		account.name, account.label, account.command = "log in", "log in", loginCommand()
		account.do = model.logIn
	case 1:
		address := m.logins.all[0].Address
		account.name, account.label, account.command = "log out", "log out", shownCommand([]string{"logout", "--url", address})
		account.do = func(m model) (tea.Model, tea.Cmd) { return m.logOut(address) }
	default:
		account.label = "log out"
		account.do = func(m model) (tea.Model, tea.Cmd) { return m.openPaletteWith("log out of ") }
	}
	return []action{account}
}

func (m model) hostActions() []action {
	known := m.status != nil
	installed := known && m.status.Service.Installed
	serving := known && m.status.Service.Running

	toggle := action{
		name: "start", keys: []string{"s"}, label: "start", section: sectionHost, disabled: !installed,
		help: "start or stop the service", command: shownCommand(hosting("start")),
		do: func(m model) (tea.Model, tea.Cmd) { return m.run(hosting("start")...) },
	}
	if serving {
		toggle.name, toggle.label, toggle.command = "stop", "stop", shownCommand(hosting("stop"))
		toggle.do = func(m model) (tea.Model, tea.Cmd) { return m.askWhenBusy("Stop the host", hosting("stop")...) }
	}

	return []action{
		toggle,
		{
			name: "restart", keys: []string{"r"}, label: "restart", section: sectionHost, disabled: !installed,
			help: "restart after the running sandboxes finish", command: shownCommand(hosting("restart")),
			do: func(m model) (tea.Model, tea.Cmd) { return m.run(hosting("restart")...) },
		},
		{
			name: "restart now", keys: []string{"R"}, section: sectionHost, disabled: !installed,
			help: "restart at once", command: shownCommand(hosting("restart", "--now")),
			do: func(m model) (tea.Model, tea.Cmd) {
				return m.askWhenBusy("Restart at once", hosting("restart", "--now")...)
			},
		},
		{
			name: "reload env files", keys: []string{"o"}, section: sectionHost, disabled: !installed,
			help: "reload host.env, sandbox.env and egress.env", command: shownCommand(hosting("reload")),
			do: func(m model) (tea.Model, tea.Cmd) { return m.run(hosting("reload")...) },
		},
		{
			name: "update", keys: []string{"u"}, section: sectionHost, disabled: !m.setUp(),
			help: "update to the release of the control plane", command: shownCommand([]string{"update"}),
			do: model.update,
		},
		{
			name: "set up a host", keys: []string{"i"}, label: "set up a host", section: sectionHost, disabled: !known || installed || m.status.AsRoot,
			help: "connect this machine and install the service", command: shownCommand(hosting("init")),
			do: func(m model) (tea.Model, tea.Cmd) { return m.attach(hosting("init")...) },
		},
	}
}

func (m model) viewActions() []action {
	quit := "quit"
	if m.status != nil && m.status.Service.Running {
		quit = "quit; the host keeps serving"
	}
	whenSetUp := func(label string) string {
		if m.setUp() {
			return label
		}
		return ""
	}
	return []action{
		{
			name: "settings", keys: []string{"c"}, label: whenSetUp("settings"), section: sectionViews,
			help: "settings", command: "spotlight host config",
			do: func(m model) (tea.Model, tea.Cmd) { return m.toggle(settingsScreen) },
		},
		{
			name: "log", keys: []string{"l"}, label: whenSetUp("log"), section: sectionViews,
			help: "full log", command: "spotlight host logs -f",
			do: func(m model) (tea.Model, tea.Cmd) { return m.toggle(logScreen) },
		},
		{
			name: "check again", keys: []string{"ctrl+r"}, section: sectionViews,
			help: "check the host again", command: "spotlight host status",
			do: model.recheck,
		},
		{
			keys: []string{":", "ctrl+k"}, label: "commands", section: sectionViews,
			help: "run any command by name", do: model.openPalette,
		},
		{
			name: "keys", keys: []string{"?"}, label: "keys", section: sectionViews,
			help: "show every key", do: model.openHelp,
		},
		{
			name: "quit", keys: []string{"q"}, label: "quit", section: sectionViews,
			help: quit,
			do:   func(m model) (tea.Model, tea.Cmd) { return m, tea.Quit },
		},
	}
}

func backAction(section string) action {
	return action{
		keys: []string{"esc"}, label: "back", section: section, help: "clear the filter, then go back",
		do: model.goBack,
	}
}

func filterAction(section, help string) action {
	return action{keys: []string{"/"}, label: "filter", section: section, help: help, do: model.startFilter}
}

func settingsActions() []action {
	move := func(by func(cursor, last int) int) func(model) (tea.Model, tea.Cmd) {
		return func(m model) (tea.Model, tea.Cmd) {
			m.settings.cursor = by(m.settings.cursor, max(len(m.visibleSettings())-1, 0))
			return m, nil
		}
	}
	return []action{
		{
			keys: []string{"up", "k"}, keyLabel: "↑↓", helpKeys: "↑↓ k j", label: "move", section: sectionSettings,
			help: "choose a setting", do: move(func(cursor, _ int) int { return max(cursor-1, 0) }),
		},
		{keys: []string{"down", "j"}, do: move(func(cursor, last int) int { return min(cursor+1, last) })},
		{keys: []string{"g", "home"}, section: sectionSettings, help: "go to the first setting", do: move(func(int, int) int { return 0 })},
		{keys: []string{"G", "end"}, section: sectionSettings, help: "go to the last setting", do: move(func(_, last int) int { return last })},
		{keys: []string{"enter"}, label: "change", section: sectionSettings, help: "change the setting", do: model.startEditing},
		{keys: []string{"x", "delete"}, label: "unset", section: sectionSettings, help: "unset, so that the default applies", do: model.unsetSelected},
		filterAction(sectionSettings, "filter the settings"),
		backAction(sectionSettings),
	}
}

func (m model) logActions() []action {
	keys := m.logs.scroll.KeyMap
	scroll := func(binding key.Binding, help string, move func(*viewport.Model)) action {
		return action{
			keys: binding.Keys(), section: sectionLog, help: help,
			do: func(m model) (tea.Model, tea.Cmd) {
				move(&m.logs.scroll)
				return m, nil
			},
		}
	}
	up := scroll(keys.Up, "scroll the log", func(v *viewport.Model) { v.ScrollUp(1) })
	up.keyLabel, up.helpKeys, up.label = "↑↓", "↑↓ k j", "scroll"
	down := scroll(keys.Down, "", func(v *viewport.Model) { v.ScrollDown(1) })

	return []action{
		up,
		down,
		scroll(keys.PageUp, "page up", (*viewport.Model).PageUp),
		scroll(keys.PageDown, "page down", (*viewport.Model).PageDown),
		scroll(keys.HalfPageUp, "half a page up", (*viewport.Model).HalfPageUp),
		scroll(keys.HalfPageDown, "half a page down", (*viewport.Model).HalfPageDown),
		scroll(key.NewBinding(key.WithKeys("g", "home")), "go to the first line", func(v *viewport.Model) { v.GotoTop() }),
		scroll(key.NewBinding(key.WithKeys("G", "end")), "go to the last line", func(v *viewport.Model) { v.GotoBottom() }),
		filterAction(sectionLog, "filter the log"),
		backAction(sectionLog),
	}
}

func (m model) answerActions() []action {
	yes := action{keys: []string{"y", "enter"}, label: "yes", do: func(m model) (tea.Model, tea.Cmd) { return m.answer(true) }}
	no := action{keys: []string{"n", "esc"}, label: "no", do: func(m model) (tea.Model, tea.Cmd) { return m.answer(false) }}
	if m.question == nil || m.question.no == nil {
		return []action{yes, no}
	}
	no.keys = []string{"n"}
	return []action{yes, no, {keys: []string{"esc"}, label: "cancel", do: model.dismiss}}
}

func paletteKeys() []action {
	move := func(by int) func(model) (tea.Model, tea.Cmd) {
		return func(m model) (tea.Model, tea.Cmd) {
			last := max(len(search(m.paletteActions(), m.palette.input.Value()))-1, 0)
			m.palette.cursor = min(max(m.palette.cursor+by, 0), last)
			return m, nil
		}
	}
	return []action{
		{keys: []string{"up", "ctrl+p"}, keyLabel: "↑↓", label: "choose", do: move(-1)},
		{keys: []string{"down", "ctrl+n", "tab"}, do: move(1)},
		{keys: []string{"enter"}, label: "run", do: model.runChosen},
		{keys: []string{"esc"}, label: "close", do: model.closePalette},
	}
}

func editKeys() []action {
	return []action{
		{keys: []string{"enter"}, label: "save", do: model.saveSetting},
		{keys: []string{"esc"}, label: "cancel", do: model.cancelEditing},
	}
}

func filterKeys() []action {
	return []action{
		{keys: []string{"enter"}, label: "keep", do: func(m model) (tea.Model, tea.Cmd) { return m.endFilter(false) }},
		{keys: []string{"esc"}, label: "clear", do: func(m model) (tea.Model, tea.Cmd) { return m.endFilter(true) }},
	}
}

func (m model) footer() []hint {
	var hints []hint
	for _, each := range m.keymap().shown {
		if each.label != "" && !each.disabled {
			hints = append(hints, hint{key: each.footerKey(), label: each.label})
		}
	}
	return hints
}

func (m model) helpLines() map[string][]hint {
	sections := map[string][]hint{}
	for _, each := range slices.Concat(m.hostActions(), m.accountActions(), m.editorActions(), m.viewActions(), settingsActions(), m.logActions()) {
		line := hint{key: each.helpKey(), label: each.help}
		if each.help == "" || slices.Contains(sections[each.section], line) {
			continue
		}
		sections[each.section] = append(sections[each.section], line)
	}
	return sections
}

func (m model) paletteActions() []action {
	var all []action
	for _, each := range slices.Concat(m.hostActions(), m.accountActions(), m.editorActions(), m.viewActions()) {
		if each.name != "" && !each.disabled {
			all = append(all, each)
		}
	}
	if len(m.logins.all) > 0 {
		all = append(all, action{name: "log in", command: loginCommand(), do: model.logIn})
	}
	if len(m.logins.all) > 1 {
		for _, login := range m.logins.all {
			all = append(all, action{
				name: "log out of " + shownAddress(login.Address), command: shownCommand([]string{"logout", "--url", login.Address}),
				do: func(m model) (tea.Model, tea.Cmd) { return m.logOut(login.Address) },
			})
		}
		for _, login := range m.logins.all {
			if m.editors == nil {
				break
			}
			all = append(all, action{
				name: "set up editors for " + shownAddress(login.Address), command: editorsCommand() + " --url " + login.Address,
				do: func(m model) (tea.Model, tea.Cmd) { return m.setUpEditorsFor(login.Address) },
			})
		}
	}
	for _, row := range m.settings.rows {
		all = append(all, action{
			name: "set " + row.Key, setting: true, command: "spotlight host config set " + row.Key + "=…",
			do: func(m model) (tea.Model, tea.Cmd) { return m.editSetting(row.Key) },
		})
	}
	return all
}
