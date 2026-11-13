package dashboard

import (
	"hash/fnv"
	"image/color"

	"charm.land/lipgloss/v2"

	"usespotlight.ai/data-plane/console"
)

type styles struct {
	lit, text, dim, faint, rule lipgloss.Style
	ok, bad, warn, accent       lipgloss.Style
	sources                     []lipgloss.Style
}

func terminalStyles() styles {
	ansi := func(c color.Color) lipgloss.Style {
		return lipgloss.NewStyle().Foreground(c)
	}
	return styles{
		lit:    lipgloss.NewStyle().Bold(true),
		text:   lipgloss.NewStyle(),
		dim:    lipgloss.NewStyle().Faint(true),
		faint:  ansi(lipgloss.BrightBlack),
		rule:   ansi(lipgloss.BrightBlack),
		accent: ansi(lipgloss.Blue),
		ok:     ansi(lipgloss.Green),
		warn:   ansi(lipgloss.Yellow),
		bad:    ansi(lipgloss.Red),
		sources: []lipgloss.Style{
			ansi(lipgloss.Magenta),
			ansi(lipgloss.Blue),
			ansi(lipgloss.Green),
			ansi(lipgloss.Yellow),
			ansi(lipgloss.BrightMagenta),
			ansi(lipgloss.BrightBlue),
		},
	}
}

func (s styles) source(name string) lipgloss.Style {
	if name == hostSource || name == "" {
		return s.faint
	}
	hash := fnv.New32a()
	hash.Write([]byte(name))
	return s.sources[hash.Sum32()%uint32(len(s.sources))]
}

func (s styles) mark(level string) string {
	switch level {
	case console.Passed:
		return s.ok.Render(console.Passed)
	case console.Warned:
		return s.warn.Render(console.Warned)
	default:
		return s.bad.Render(console.Failed)
	}
}
