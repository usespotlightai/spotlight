package console

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"

	"golang.org/x/term"
)

const (
	Passed = "✓"
	Warned = "!"
	Failed = "✗"
	Green  = "\033[32m"
	Yellow = "\033[33m"
	Red    = "\033[31m"
	Bold   = "\033[1m"
	Reset  = "\033[0m"
)

func Colored(out io.Writer) bool {
	file, ok := out.(*os.File)
	if !ok || os.Getenv("NO_COLOR") != "" {
		return false
	}
	info, err := file.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
}

func Paint(out io.Writer, color, text string) string {
	if !Colored(out) {
		return text
	}
	return color + text + Reset
}

func Mark(out io.Writer, level string) string {
	switch level {
	case Passed:
		return Paint(out, Green, Passed)
	case Warned:
		return Paint(out, Yellow, Warned)
	default:
		return Paint(out, Red, Failed)
	}
}

func Step(out io.Writer, text string) {
	fmt.Fprintf(out, "  %s %s\n", Mark(out, Passed), text)
}

// Terminal asks questions on the controlling terminal, so they work after `curl | sh` too.
type Terminal struct {
	out    io.Writer
	reader *bufio.Reader
	file   *os.File
}

func Open() *Terminal {
	tty, err := os.OpenFile("/dev/tty", os.O_RDWR, 0)
	if err != nil {
		return nil
	}
	if !term.IsTerminal(int(tty.Fd())) {
		tty.Close()
		return nil
	}
	return &Terminal{out: tty, reader: bufio.NewReader(tty), file: tty}
}

func New(in io.Reader, out io.Writer) *Terminal {
	return &Terminal{out: out, reader: bufio.NewReader(in)}
}

func (t *Terminal) Close() {
	if t.file != nil {
		t.file.Close()
	}
}

func (t *Terminal) prompt(question, shown string) {
	if shown != "" {
		fmt.Fprintf(t.out, "%s [%s]: ", question, shown)
	} else {
		fmt.Fprintf(t.out, "%s: ", question)
	}
}

func (t *Terminal) Ask(question, shown string) (string, error) {
	t.prompt(question, shown)
	line, err := t.reader.ReadString('\n')
	if err != nil && line == "" {
		return "", err
	}
	return strings.TrimSpace(line), nil
}

func (t *Terminal) Secret(question, shown string) (string, error) {
	if t.file == nil {
		return t.Ask(question, shown)
	}
	t.prompt(question, shown)
	raw, err := term.ReadPassword(int(t.file.Fd()))
	fmt.Fprintln(t.out)
	return strings.TrimSpace(string(raw)), err
}

func (t *Terminal) Confirm(question string) bool {
	answer, err := t.Ask(question+" (y/N)", "")
	answer = strings.ToLower(answer)
	return err == nil && (answer == "y" || answer == "yes")
}
