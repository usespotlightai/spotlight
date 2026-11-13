package dashboard

import (
	"bufio"
	"bytes"
	"cmp"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"
	"unicode"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"usespotlight.ai/data-plane/console"
)

const (
	hostSource  = "host"
	sourceWidth = 9
	logKept     = 1000
	longestLine = 1024 * 1024
)

var hiddenAttrs = map[string]bool{"time": true, "level": true, "msg": true, "host": true}

type logStream struct {
	reader io.Closer
	lines  chan string
	err    error
}

type (
	logLineMsg struct {
		stream *logStream
		line   string
	}
	logEndedMsg struct {
		stream *logStream
		err    error
	}
)

func follow(open func() (io.ReadCloser, error)) *logStream {
	stream := &logStream{lines: make(chan string, 256)}
	reader, err := open()
	if err != nil {
		stream.err = err
		close(stream.lines)
		return stream
	}
	stream.reader = reader

	go func() {
		scanner := bufio.NewScanner(reader)
		scanner.Buffer(make([]byte, 64*1024), longestLine)
		for scanner.Scan() {
			stream.lines <- scanner.Text()
		}
		failed := scanner.Err()
		if errors.Is(failed, bufio.ErrTooLong) {
			failed = errors.New("the log stopped at a line longer than 1 MB")
		}
		stream.err = cmp.Or(failed, reader.Close())
		close(stream.lines)
	}()
	return stream
}

func (s *logStream) next() tea.Cmd {
	return func() tea.Msg {
		if line, ok := <-s.lines; ok {
			return logLineMsg{stream: s, line: line}
		}
		return logEndedMsg{stream: s, err: s.err}
	}
}

func (s *logStream) stop() {
	if s != nil && s.reader != nil {
		_ = s.reader.Close()
	}
}

type logEntry struct {
	source   string
	time     string
	level    string
	msg      string
	attrs    []logAttr
	raw      string
	rendered string
}

type logAttr struct {
	key, value string
}

func parseLog(line string) logEntry {
	start := strings.IndexByte(line, '{')
	if start < 0 {
		return logEntry{raw: printable(line)}
	}

	decoder := json.NewDecoder(strings.NewReader(line[start:]))
	if open, err := decoder.Token(); err != nil || open != json.Delim('{') {
		return logEntry{raw: printable(line)}
	}

	entry := logEntry{}
	for decoder.More() {
		token, err := decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok {
			return logEntry{raw: printable(line)}
		}
		var raw json.RawMessage
		if err := decoder.Decode(&raw); err != nil {
			return logEntry{raw: printable(line)}
		}
		value := plain(raw)

		switch key {
		case "time":
			if at, err := time.Parse(time.RFC3339Nano, value); err == nil {
				value = at.Local().Format("15:04:05")
			}
			entry.time = value
		case "level":
			entry.level = value
		case "msg":
			entry.msg = value
		}
		if !hiddenAttrs[key] {
			entry.attrs = append(entry.attrs, logAttr{key: key, value: value})
		}
	}
	if entry.msg == "" {
		return logEntry{raw: printable(line)}
	}
	return entry.fromSandbox()
}

func (e logEntry) fromSandbox() logEntry {
	e.source = hostSource
	if e.msg != "sandbox" {
		return e
	}
	var rest []logAttr
	for _, attr := range e.attrs {
		switch attr.key {
		case "sandbox":
			e.source = attr.value
		case "line":
			e.msg = attr.value
		default:
			rest = append(rest, attr)
		}
	}
	e.attrs = rest
	return e
}

func plain(raw json.RawMessage) string {
	var text string
	if bytes.HasPrefix(raw, []byte(`"`)) && json.Unmarshal(raw, &text) == nil {
		return printable(text)
	}
	return printable(string(raw))
}

func printable(text string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r == '\n':
			return '⏎'
		case r == '\t':
			return ' '
		case unicode.IsControl(r):
			return '�'
		}
		return r
	}, text)
}

func (e logEntry) render(s styles) string {
	if e.raw != "" {
		return s.dim.Render(e.raw)
	}

	msg := s.text
	if e.source != hostSource || e.level == "DEBUG" {
		msg = s.dim
	}
	mark := "  "
	switch e.level {
	case "ERROR":
		mark = s.mark(console.Failed) + " "
	case "WARN":
		mark = s.mark(console.Warned) + " "
	}

	source := ansi.Truncate(e.source, sourceWidth, "…")
	source += strings.Repeat(" ", sourceWidth-ansi.StringWidth(source))
	parts := []string{s.faint.Render(e.time), s.source(e.source).Render(source), mark + msg.Render(e.msg)}
	for _, attr := range e.attrs {
		value := attr.value
		if strings.ContainsAny(value, " \t") {
			value = `"` + value + `"`
		}
		shown := s.dim
		if attr.key == "sandbox" {
			shown = s.source(attr.value)
		}
		parts = append(parts, s.faint.Render(attr.key+"=")+shown.Render(value))
	}
	return strings.Join(parts, "  ")
}

func (e logEntry) matches(filter string) bool {
	if filter == "" {
		return true
	}
	filter = strings.ToLower(filter)
	if strings.Contains(strings.ToLower(e.raw+" "+e.source+" "+e.msg+" "+e.level), filter) {
		return true
	}
	for _, attr := range e.attrs {
		if strings.Contains(strings.ToLower(attr.key+"="+attr.value), filter) {
			return true
		}
	}
	return false
}
