package dashboard

import (
	"fmt"
	"os"
	"slices"
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/ansi"

	"usespotlight.ai/data-plane/console"
	"usespotlight.ai/data-plane/host/internal/config"
)

const (
	gutter      = " "
	labelColumn = 12
	keyColumn   = 8
	meterSlots  = 20
)

func (m model) bodyHeight() int {
	return max(m.height-len(m.header())-len(m.footerLines()), 0)
}

func (m model) View() tea.View {
	height := m.bodyHeight()
	var body []string
	switch {
	case m.mode == commanding:
		body = m.paletteBody(height)
	case m.mode == helping:
		body = m.helpBody()
	case m.screen == settingsScreen:
		body = m.settingsBody(height)
	case m.screen == logScreen:
		body = m.logBody()
	default:
		body = m.overviewBody(height)
	}
	body = body[:min(len(body), height)]
	for len(body) < height {
		body = append(body, "")
	}

	lines := slices.Concat(m.header(), body, m.footerLines())
	view := tea.NewView(m.fit(lines[:min(len(lines), max(m.height, 0))]))
	view.AltScreen = true
	view.WindowTitle = "spotlight host"
	return view
}

func (m model) footerLines() []string {
	return []string{m.rule(""), m.statusLine(), m.keyLine(m.footer())}
}

func (m model) header() []string {
	s := m.style
	left := gutter + s.dim.Render("spotlight host")
	if m.status != nil && m.status.Name != "" {
		left += "  " + s.lit.Render(m.status.Name)
	}
	switch m.screen {
	case settingsScreen:
		left += s.faint.Render("  /  ") + s.text.Render("settings")
	case logScreen:
		left += s.faint.Render("  /  ") + s.text.Render("log")
	}

	right := s.faint.Render("release ") + s.dim.Render(m.version) + gutter
	if m.screen == settingsScreen {
		right = s.faint.Render(shortPath(m.host.ConfigPath(), m.width/2)) + gutter
	}
	return []string{m.spread(left, right), m.rule("")}
}

func shortPath(path string, room int) string {
	if home, err := os.UserHomeDir(); err == nil && strings.HasPrefix(path, home+"/") {
		path = "~" + path[len(home):]
	}
	if width := ansi.StringWidth(path); width > room {
		path = "…" + ansi.TruncateLeft(path, width-room+1, "")
	}
	return path
}

func (m model) overviewBody(height int) []string {
	s := m.style
	if m.status == nil {
		return []string{"", gutter + m.spinner.View() + " " + s.dim.Render("Checking the host")}
	}
	status := m.status

	lines := []string{"", m.spread(gutter+m.serviceLine(), m.meter()+gutter), ""}

	var summary []string
	for _, each := range status.Checks {
		summary = append(summary, s.mark(each.Level)+" "+s.dim.Render(each.Name))
	}
	lines = append(lines, gutter+m.label("checks")+strings.Join(summary, "   "))
	indent := gutter + strings.Repeat(" ", labelColumn)
	for _, each := range status.Checks {
		if each.Level == console.Passed {
			continue
		}
		lines = append(lines, indent+s.mark(each.Level)+" "+s.text.Render(each.Message))
		if each.Fix != "" {
			lines = append(lines, indent+"  "+s.dim.Render(each.Fix))
		}
	}

	note := "live"
	if m.logs.note != "" {
		note = m.logs.note
	}
	lines = append(lines, "", m.rule("log", s.faint.Render(note)))

	if len(m.logs.entries) == 0 && m.logs.note == "" {
		return append(lines, gutter+s.faint.Render("No log lines yet."))
	}
	room := max(height-len(lines), 0)
	for _, entry := range m.logs.entries[max(len(m.logs.entries)-room, 0):] {
		lines = append(lines, gutter+entry.rendered)
	}
	return lines
}

func (m model) serviceLine() string {
	s := m.style
	service := m.status.Service
	unit := "systemd"
	if strings.HasSuffix(service.Unit, ".plist") {
		unit = "launchd"
	}
	switch {
	case service.Running && service.Installed:
		return s.ok.Render("●") + s.lit.Render(" serving") + "   " + s.dim.Render(fmt.Sprintf("pid %d · %s", service.Process, unit))
	case service.Running:
		return s.ok.Render("●") + s.lit.Render(" serving") + "   " + s.dim.Render(fmt.Sprintf("pid %d · not a service", service.Process))
	case service.Installed:
		return s.warn.Render("○") + s.text.Render(" stopped") + "   " + s.dim.Render(unit)
	default:
		return s.bad.Render("○") + s.dim.Render(" not installed")
	}
}

func (m model) meter() string {
	s := m.style
	sandboxes := m.status.Sandboxes
	if sandboxes.Running == nil {
		return s.faint.Render("sandboxes unknown")
	}
	running, capacity := *sandboxes.Running, sandboxes.Capacity
	slots, full := capacity, running
	if capacity > meterSlots {
		slots, full = meterSlots, (running*meterSlots+capacity-1)/capacity
	}
	full = min(full, slots)
	bar := s.accent.Render(strings.Repeat("■", full)) + s.faint.Render(strings.Repeat("■", slots-full))
	return s.dim.Render("sandboxes  ") + bar + "  " + s.lit.Render(fmt.Sprint(running)) + s.dim.Render(fmt.Sprintf(" of %d", capacity))
}

func (m model) settingsBody(height int) []string {
	s := m.style
	var lines []string
	if m.mode == filtering || m.settings.filter.Value() != "" {
		lines = append(lines, gutter+s.dim.Render("/ ")+m.settings.filter.View())
	}
	if m.settings.note != "" {
		lines = append(lines, gutter+s.bad.Render(m.settings.note))
	}

	rows := m.visibleSettings()
	keyWidth := 0
	for _, row := range rows {
		keyWidth = max(keyWidth, len(row.Key))
	}

	var list []string
	at, group := 0, ""
	for i, row := range rows {
		if row.Group != group {
			group = row.Group
			list = append(list, "", gutter+s.lit.Render(group))
		}
		if i == m.settings.cursor {
			at = len(list)
		}
		list = append(list, m.settingLine(row, i == m.settings.cursor, keyWidth))
	}
	if len(rows) == 0 {
		list = append(list, "", gutter+s.dim.Render("No setting matches."))
	}

	const detailLines = 2
	room := max(height-len(lines)-detailLines, 1)
	first := min(max(at-room/2, 0), max(len(list)-room, 0))
	window := list[first:min(first+room, len(list))]
	lines = append(lines, window...)
	for range room - len(window) {
		lines = append(lines, "")
	}

	if row, ok := m.selected(); ok {
		lines = append(lines, m.rule(""), gutter+m.describe(row))
	}
	return lines
}

func (m model) settingLine(row Setting, selected bool, keyWidth int) string {
	s := m.style
	marker, key := "  ", s.dim.Render(fmt.Sprintf("%-*s", keyWidth, row.Key))
	if selected {
		marker, key = s.accent.Render("▌ "), s.lit.Render(fmt.Sprintf("%-*s", keyWidth, row.Key))
	}

	var value string
	switch {
	case m.mode == editing && row.Key == m.settings.editing:
		value = m.settings.input.View()
	case !row.Set:
		value = s.faint.Render("default")
	case row.hidden():
		value = s.text.Render(config.Mask(row.Value))
	default:
		value = s.text.Render(row.Value)
	}

	right := ""
	if !row.Live {
		right = s.faint.Render("↻") + gutter
	}
	return m.spread(gutter+marker+key+"   "+value, right)
}

func (m model) describe(row Setting) string {
	s := m.style
	applies := "applies at once"
	if !row.Live {
		applies = "↻ applies at a restart, after the running sandboxes finish"
	}
	dot := s.faint.Render("  ·  ")
	return s.text.Render(row.Key) + dot + s.dim.Render(row.Env) + dot + s.dim.Render(applies)
}

func (m model) logBody() []string {
	s := m.style
	top := gutter + s.faint.Render(fmt.Sprintf("%d lines", len(m.logs.entries)))
	switch {
	case m.mode == filtering || m.logs.filter.Value() != "":
		top = gutter + s.dim.Render("/ ") + m.logs.filter.View()
	case m.logs.note != "":
		top = gutter + s.faint.Render(m.logs.note)
	}
	return append([]string{top}, strings.Split(m.logs.scroll.View(), "\n")...)
}

func (m model) paletteBody(height int) []string {
	s := m.style
	lines := []string{"", gutter + s.accent.Render(": ") + m.palette.input.View(), ""}

	found := search(m.paletteActions(), m.palette.input.Value())
	if len(found) == 0 {
		return append(lines, gutter+s.dim.Render("  No command matches."))
	}

	nameWidth := 0
	for _, each := range found {
		nameWidth = max(nameWidth, len(each.name))
	}
	room := max(height-len(lines), 1)
	first := max(m.palette.cursor-room+1, 0)
	for i := first; i < min(first+room, len(found)); i++ {
		each := found[i]
		marker, name := "  ", s.text.Render(fmt.Sprintf("%-*s", nameWidth, each.name))
		if i == m.palette.cursor {
			marker, name = s.accent.Render("▌ "), s.lit.Render(fmt.Sprintf("%-*s", nameWidth, each.name))
		}
		key := s.dim.Render(fmt.Sprintf("%-*s", keyColumn, each.footerKey()))
		lines = append(lines, m.spread(gutter+marker+key+name, s.faint.Render(each.command)+gutter))
	}
	return lines
}

func (m model) helpBody() []string {
	s := m.style
	sections := m.helpLines()
	columns := make([][]string, len(helpColumns))
	for i, column := range helpColumns {
		for _, section := range column {
			keyWidth := keyColumn
			for _, each := range sections[section] {
				keyWidth = max(keyWidth, ansi.StringWidth(each.key)+2)
			}
			columns[i] = append(columns[i], "", gutter+s.lit.Render(section))
			for _, each := range sections[section] {
				key := each.key + strings.Repeat(" ", keyWidth-ansi.StringWidth(each.key))
				columns[i] = append(columns[i], gutter+"  "+s.lit.Render(key)+s.text.Render(each.label))
			}
		}
	}

	left, right := columns[0], columns[1]
	width := widest(left) + len(gutter)*2
	var lines []string
	if width+widest(right) > m.width {
		lines = slices.Concat(left, right)
	} else {
		for i := range max(len(left), len(right)) {
			line := ""
			if i < len(left) {
				line = left[i]
			}
			if i < len(right) {
				line += strings.Repeat(" ", width-ansi.StringWidth(line)) + right[i]
			}
			lines = append(lines, line)
		}
	}
	return append(lines, "", gutter+s.dim.Render("Each action runs a spotlight host command and shows it below."))
}

func widest(lines []string) int {
	width := 0
	for _, line := range lines {
		width = max(width, ansi.StringWidth(line))
	}
	return width
}

func (m model) statusLine() string {
	s := m.style
	switch {
	case m.mode == asking && m.question != nil:
		return gutter + s.lit.Render(m.question.text)
	case m.running != "":
		return gutter + m.spinner.View() + " " + s.text.Render(m.running)
	case m.last == nil:
		return ""
	}

	mark, said := s.ok.Render(console.Passed), s.dim
	if m.last.failed {
		mark, said = s.bad.Render(console.Failed), s.bad
	}
	return gutter + mark + " " + s.text.Render(m.last.command) + "   " + said.Render(lastLine(m.last.output))
}

func lastLine(output string) string {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	line := strings.TrimSpace(lines[len(lines)-1])
	for _, prefix := range []string{console.Passed + " ", console.Warned + " ", console.Failed + " ", "spotlight host: "} {
		line = strings.TrimPrefix(line, prefix)
	}
	return line
}

func (m model) keyLine(hints []hint) string {
	s := m.style
	parts := make([]string, 0, len(hints))
	for _, each := range hints {
		parts = append(parts, s.lit.Render(each.key)+" "+s.dim.Render(each.label))
	}
	return gutter + strings.Join(parts, "   ")
}

func (m model) label(text string) string {
	return m.style.dim.Render(text) + strings.Repeat(" ", max(labelColumn-len(text), 1))
}

func (m model) rule(title string, right ...string) string {
	s := m.style
	if title == "" {
		return s.rule.Render(strings.Repeat("─", max(m.width, 0)))
	}
	left := s.rule.Render("──") + " " + s.dim.Render(title) + " "
	end := ""
	if len(right) > 0 {
		end = " " + right[0] + " " + s.rule.Render("──")
	}
	fill := max(m.width-lipgloss.Width(left)-lipgloss.Width(end), 0)
	return left + s.rule.Render(strings.Repeat("─", fill)) + end
}

func (m model) spread(left, right string) string {
	space := m.width - lipgloss.Width(left) - lipgloss.Width(right)
	if space < 2 {
		return left
	}
	return left + strings.Repeat(" ", space) + right
}

func (m model) fit(lines []string) string {
	for i, line := range lines {
		lines[i] = ansi.Truncate(line, m.width, "…")
	}
	return strings.Join(lines, "\n")
}
