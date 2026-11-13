package dashboard

import (
	"strings"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"

	"usespotlight.ai/data-plane/host/internal/config"
)

func (m model) visibleSettings() []Setting {
	filter := strings.ToLower(m.settings.filter.Value())
	var rows []Setting
	for _, group := range config.Groups {
		for _, row := range m.settings.rows {
			if row.Group == group && strings.Contains(strings.ToLower(row.Key+" "+row.Env), filter) {
				rows = append(rows, row)
			}
		}
	}
	return rows
}

func (m model) selected() (Setting, bool) {
	rows := m.visibleSettings()
	if m.settings.cursor < 0 || m.settings.cursor >= len(rows) {
		return Setting{}, false
	}
	return rows[m.settings.cursor], true
}

func (m model) setting(key string) (Setting, bool) {
	for _, row := range m.settings.rows {
		if row.Key == key {
			return row, true
		}
	}
	return Setting{}, false
}

func (m *model) keepCursor() {
	rows := m.visibleSettings()
	if m.mode == editing {
		for i, row := range rows {
			if row.Key == m.settings.editing {
				m.settings.cursor = i
			}
		}
	}
	m.settings.cursor = min(m.settings.cursor, max(len(rows)-1, 0))
}

func (m model) editSetting(key string) (tea.Model, tea.Cmd) {
	m.screen = settingsScreen
	m.settings.filter.SetValue("")
	for i, row := range m.visibleSettings() {
		if row.Key == key {
			m.settings.cursor = i
		}
	}
	return m.startEditing()
}

func (m model) startEditing() (tea.Model, tea.Cmd) {
	row, ok := m.selected()
	if !ok || m.running != "" {
		return m, nil
	}
	m.mode, m.settings.editing = editing, row.Key
	input := &m.settings.input
	input.SetValue("")
	input.EchoMode, input.Placeholder = textinput.EchoNormal, ""
	if row.Secret {
		input.EchoMode = textinput.EchoPassword
		if row.Set {
			input.Placeholder = "type a new value, or press enter to keep it"
		}
	} else {
		input.SetValue(row.Value)
	}
	input.CursorEnd()
	return m, input.Focus()
}

func (m model) cancelEditing() (tea.Model, tea.Cmd) {
	m.mode, m.settings.editing = browsing, ""
	m.settings.input.Blur()
	return m, nil
}

func (m model) saveSetting() (tea.Model, tea.Cmd) {
	row, ok := m.setting(m.settings.editing)
	value := m.settings.input.Value()
	next, _ := m.cancelEditing()
	m = next.(model)
	switch {
	case !ok:
		return m, nil
	case row.Secret && value != "":
		return m.runWith(value, "config", "set", row.Key, "--stdin")
	case row.Secret:
		return m, nil
	case value != "":
		return m.run("config", "set", row.Key+"="+value)
	case row.Set:
		return m.run("config", "unset", row.Key)
	}
	return m, nil
}

func (m model) unsetSelected() (tea.Model, tea.Cmd) {
	row, ok := m.selected()
	if !ok || !row.Set {
		return m, nil
	}
	return m.run("config", "unset", row.Key)
}
