package dashboard

import (
	"slices"
	"strings"
	"unicode"

	tea "charm.land/bubbletea/v2"
)

const settingPenalty = 2000

func (m model) openPalette() (tea.Model, tea.Cmd) {
	return m.openPaletteWith("")
}

func (m model) openPaletteWith(query string) (tea.Model, tea.Cmd) {
	m.mode, m.palette.cursor = commanding, 0
	m.palette.input.SetValue(query)
	m.palette.input.CursorEnd()
	return m, m.palette.input.Focus()
}

func (m model) closePalette() (tea.Model, tea.Cmd) {
	m.mode = browsing
	m.palette.input.Blur()
	return m, nil
}

func (m model) runChosen() (tea.Model, tea.Cmd) {
	found := search(m.paletteActions(), m.palette.input.Value())
	if len(found) == 0 {
		return m, nil
	}
	next, _ := m.closePalette()
	return found[min(m.palette.cursor, len(found)-1)].do(next.(model))
}

func search(actions []action, query string) []action {
	query = strings.ToLower(strings.TrimSpace(query))
	if query == "" {
		return slices.DeleteFunc(slices.Clone(actions), func(each action) bool { return each.setting })
	}

	type ranked struct {
		action
		score int
	}
	var hits []ranked
	for _, each := range actions {
		if score, ok := fuzzy(strings.ToLower(each.name), query); ok {
			if each.setting {
				score -= settingPenalty
			}
			hits = append(hits, ranked{action: each, score: score})
		}
	}
	slices.SortStableFunc(hits, func(a, b ranked) int { return b.score - a.score })

	found := make([]action, 0, len(hits))
	for _, hit := range hits {
		found = append(found, hit.action)
	}
	return found
}

func fuzzy(name, query string) (int, bool) {
	if strings.HasPrefix(name, query) {
		return 1000 - len(name), true
	}
	if at := strings.Index(name, query); at >= 0 {
		bonus := 0
		if at > 0 && !unicode.IsLetter(rune(name[at-1])) {
			bonus = 300
		}
		return 500 + bonus - len(name), true
	}

	score, at := 0, 0
	for _, want := range query {
		found := strings.IndexRune(name[at:], want)
		if found < 0 {
			return 0, false
		}
		if found == 0 {
			score += 5
		}
		at += found + 1
	}
	return score - len(name), true
}
