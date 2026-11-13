package dashboard

import (
	tea "charm.land/bubbletea/v2"
)

type choice struct {
	title, detail, command string
	do                     func(model) (tea.Model, tea.Cmd)
}

func choices() []choice {
	return []choice{
		{
			title: "Open tasks in VS Code or Cursor", detail: "Log in, then set up ssh.",
			command: editorsCommand(), do: model.setUpEditors,
		},
		{
			title: "Run agents on this computer", detail: "Connect it to Spotlight as a host.",
			command: shownCommand([]string{"init"}), do: func(m model) (tea.Model, tea.Cmd) { return m.attach("init") },
		},
		{
			title: "Manage Spotlight with Terraform or replays", detail: "Log in, so Terraform and replays act as you.",
			command: loginCommand(), do: model.logIn,
		},
	}
}

func (m model) firstRun() bool {
	return m.status != nil && !m.status.SetUp && !m.status.AsRoot &&
		m.account != nil && m.loginsLoaded && len(m.logins) == 0 && m.loginsNote == "" &&
		m.editors != nil && m.editorSetup != nil && !m.editorSetup.Configured
}

func chooserKeys() []action {
	move := func(by int) func(model) (tea.Model, tea.Cmd) {
		return func(m model) (tea.Model, tea.Cmd) {
			m.choice = min(max(m.choice+by, 0), len(choices())-1)
			return m, nil
		}
	}
	return []action{
		{keys: []string{"up", "k"}, keyLabel: "↑↓", label: "choose", do: move(-1)},
		{keys: []string{"down", "j"}, do: move(1)},
		{keys: []string{"enter"}, label: "start", do: func(m model) (tea.Model, tea.Cmd) { return choices()[m.choice].do(m) }},
	}
}

func (m model) chooserBody() []string {
	s := m.style
	lines := []string{
		"",
		gutter + s.lit.Render("Nothing is set up on this computer."),
		gutter + s.text.Render("What do you want to do here?"),
		"",
	}
	for i, each := range choices() {
		marker, title := "  ", s.text.Render(each.title)
		if i == m.choice {
			marker, title = s.accent.Render("▌ "), s.lit.Render(each.title)
		}
		lines = append(lines,
			gutter+marker+title,
			m.spread(gutter+"    "+s.dim.Render(each.detail), s.faint.Render(each.command)+gutter),
		)
	}
	return lines
}
