package help

import (
	"fmt"
	"strings"
)

const DocsBase = "https://docs.usespotlight.ai/docs/reference/cli/"

type Flag struct {
	Name  string
	Value string
	Usage string
}

type Example struct {
	Comment string
	Command string
}

type Exit struct {
	Code  int
	Means string
}

type Command struct {
	Path     string
	Group    bool
	Summary  string
	Usage    []string
	Flags    []Flag
	Env      []Flag
	Examples []Example
	Exits    []Exit
	Notes    []string
	Docs     string
}

func (c Command) Synopsis() string {
	lines := make([]string, 0, len(c.Usage)+1)
	for at, each := range c.Usage {
		prefix := "       "
		if at == 0 {
			prefix = "usage: "
		}
		lines = append(lines, prefix+each)
	}

	return strings.Join(append(lines, fmt.Sprintf("Run spotlight %s --help for flags and examples.", c.Path)), "\n")
}

type Section struct {
	Title string
	Paths []string
}

type Root struct {
	Summary  string
	Sections []Section
	Footer   []string
}

type Registry struct {
	commands []Command
}

func NewRegistry(groups ...[]Command) Registry {
	var all []Command
	for _, group := range groups {
		all = append(all, group...)
	}

	return Registry{commands: all}
}

func (r Registry) Command(path string) (Command, bool) {
	for _, each := range r.commands {
		if each.Path == path {
			return each, true
		}
	}

	return Command{}, false
}

func (r Registry) Resolve(args []string) (Command, []string, bool) {
	var found Command
	matched := 0
	for depth := 1; depth <= len(args); depth++ {
		if strings.HasPrefix(args[depth-1], "-") {
			break
		}
		command, ok := r.Command(strings.Join(args[:depth], " "))
		if !ok {
			break
		}
		found, matched = command, depth
	}

	return found, args[matched:], matched > 0
}

func (r Registry) Children(path string) []Command {
	var children []Command
	for _, each := range r.commands {
		parent, _, nested := cut(each.Path)
		if nested && parent == path {
			children = append(children, each)
		}
	}

	return children
}

func cut(path string) (string, string, bool) {
	at := strings.LastIndex(path, " ")
	if at < 0 {
		return "", path, false
	}

	return path[:at], path[at+1:], true
}

func (r Registry) Nearest(parent, word string) []string {
	var names []string
	if parent == "" {
		for _, each := range r.commands {
			if !strings.Contains(each.Path, " ") {
				names = append(names, each.Path)
			}
		}
	} else {
		for _, each := range r.Children(parent) {
			_, name, _ := cut(each.Path)
			names = append(names, name)
		}
	}

	var near []string
	for _, name := range names {
		if strings.HasPrefix(name, word) || distance(name, word) <= 1+len(word)/8 {
			near = append(near, strings.TrimSpace(parent+" "+name))
		}
	}

	return near
}

func distance(a, b string) int {
	rows := make([][]int, len(a)+1)
	for i := range rows {
		rows[i] = make([]int, len(b)+1)
		rows[i][0] = i
	}
	for j := range rows[0] {
		rows[0][j] = j
	}
	for i := 1; i <= len(a); i++ {
		for j := 1; j <= len(b); j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			rows[i][j] = min(rows[i-1][j]+1, rows[i][j-1]+1, rows[i-1][j-1]+cost)
			if i > 1 && j > 1 && a[i-1] == b[j-2] && a[i-2] == b[j-1] {
				rows[i][j] = min(rows[i][j], rows[i-2][j-2]+1)
			}
		}
	}

	return rows[len(a)][len(b)]
}

func Wanted(args []string) bool {
	for _, each := range args {
		switch each {
		case "--":
			return false
		case "-h", "-help", "--help":
			return true
		}
	}

	return false
}

func (r Registry) RenderRoot(root Root) string {
	var written strings.Builder
	written.WriteString(root.Summary + "\n\nUsage:\n  spotlight <command> [flags]\n")

	for _, section := range root.Sections {
		rows := make([][2]string, 0, len(section.Paths))
		for _, path := range section.Paths {
			if command, ok := r.Command(path); ok {
				rows = append(rows, [2]string{path, command.Summary})
			}
		}
		written.WriteString("\n" + section.Title + ":\n" + table(rows))
	}

	if len(root.Footer) > 0 {
		written.WriteString("\n" + strings.Join(root.Footer, "\n") + "\n")
	}

	return strings.TrimRight(written.String(), "\n")
}

func (r Registry) Render(command Command) string {
	sections := []string{command.Summary}

	sections = append(sections, "Usage:\n"+indented(command.Usage))

	children := r.Children(command.Path)
	if len(children) > 0 {
		rows := make([][2]string, 0, len(children))
		for _, each := range children {
			_, name, _ := cut(each.Path)
			rows = append(rows, [2]string{name, each.Summary})
		}
		sections = append(sections, "Commands:\n"+strings.TrimRight(table(rows), "\n"))
	}

	sections = append(sections, "Flags:\n"+flagTable(command.Flags))

	if len(command.Env) > 0 {
		rows := make([][2]string, 0, len(command.Env))
		for _, each := range command.Env {
			rows = append(rows, [2]string{each.Name, each.Usage})
		}
		sections = append(sections, "Environment:\n"+strings.TrimRight(table(rows), "\n"))
	}

	if len(command.Examples) > 0 {
		var examples []string
		for _, each := range command.Examples {
			if each.Comment != "" {
				examples = append(examples, "  # "+each.Comment)
			}
			examples = append(examples, "  "+each.Command)
		}
		sections = append(sections, "Examples:\n"+strings.Join(examples, "\n"))
	}

	if len(command.Exits) > 0 {
		var exits []string
		for _, each := range command.Exits {
			exits = append(exits, fmt.Sprintf("  %d  %s", each.Code, each.Means))
		}
		sections = append(sections, "Exit codes:\n"+strings.Join(exits, "\n"))
	}

	sections = append(sections, command.Notes...)

	var footer []string
	if len(children) > 0 {
		footer = append(footer, fmt.Sprintf("Run spotlight %s <command> --help for flags and examples.", command.Path))
	}
	if command.Docs != "" {
		footer = append(footer, "Docs: "+DocsBase+command.Docs)
	}
	if len(footer) > 0 {
		sections = append(sections, strings.Join(footer, "\n"))
	}

	return strings.Join(sections, "\n\n")
}

func indented(lines []string) string {
	out := make([]string, len(lines))
	for at, each := range lines {
		out[at] = "  " + each
	}

	return strings.Join(out, "\n")
}

func table(rows [][2]string) string {
	width := 0
	for _, row := range rows {
		width = max(width, len(row[0]))
	}

	var written strings.Builder
	for _, row := range rows {
		fmt.Fprintf(&written, "  %-*s  %s\n", width, row[0], row[1])
	}

	return written.String()
}

func flagTable(flags []Flag) string {
	rows := make([][2]string, 0, len(flags)+1)
	for _, each := range flags {
		name := "--" + each.Name
		if len(each.Name) == 1 {
			name = "-" + each.Name
		}
		if each.Value != "" {
			name += " " + each.Value
		}
		rows = append(rows, [2]string{name, each.Usage})
	}
	rows = append(rows, [2]string{"-h, --help", "Show this help."})

	return strings.TrimRight(table(rows), "\n")
}
