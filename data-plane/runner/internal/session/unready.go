package session

import (
	"fmt"
	"strings"
)

const unreadyOutputLines = 20

type setupFailure struct {
	path    string
	command string
	err     error
	output  string
}

func unreadyNote(failures []setupFailure) string {
	if len(failures) == 0 {
		return ""
	}

	var note strings.Builder
	note.WriteString("Setup failed before your turn, so these repositories may not be ready to build or test:\n")
	for _, failure := range failures {
		fmt.Fprintf(&note, "\n- %s: `%s` failed: %v\n", failure.path, failure.command, failure.err)
		if last := lastLines(failure.output, unreadyOutputLines); last != "" {
			fmt.Fprintf(&note, "  Last output:\n  ```\n%s\n  ```\n", indented(last, "  "))
		}
	}
	note.WriteString("\nDo the task as far as you can. In your handover, say that setup failed, for which repositories, and the cause the output shows, so that a person can repair the setup.\n\n")
	return note.String()
}

func lastLines(output string, count int) string {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	if len(lines) > count {
		lines = lines[len(lines)-count:]
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func indented(text, by string) string {
	return by + strings.ReplaceAll(text, "\n", "\n"+by)
}
