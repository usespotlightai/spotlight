package ssh

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

type member struct {
	key        string
	keyStart   int
	start, end int
	value      string
}

type object struct {
	text    string
	open    int
	close   int
	members []member
}

var errNotAnObject = errors.New("the file is not a JSON object")

func parseObject(text string) (object, error) {
	s := scanner{text: text, at: len(text) - len(strings.TrimPrefix(text, "\ufeff"))}
	o := object{text: text}

	if err := s.trivia(); err != nil {
		return o, err
	}
	if s.done() {
		o.open = -1
		return o, nil
	}
	if s.peek() != '{' {
		return o, errNotAnObject
	}
	o.open = s.at
	s.at++

	for {
		if err := s.trivia(); err != nil {
			return o, err
		}
		if s.done() {
			return o, s.unexpected()
		}
		if s.peek() == '}' {
			o.close = s.at
			break
		}

		keyStart := s.at
		if err := s.string(); err != nil {
			return o, err
		}
		var key string
		if err := json.Unmarshal([]byte(text[keyStart:s.at]), &key); err != nil {
			return o, s.unexpected()
		}

		if err := s.trivia(); err != nil {
			return o, err
		}
		if s.done() || s.peek() != ':' {
			return o, s.unexpected()
		}
		s.at++
		if err := s.trivia(); err != nil {
			return o, err
		}

		start := s.at
		if err := s.value(); err != nil {
			return o, err
		}
		o.members = append(o.members, member{key: key, keyStart: keyStart, start: start, end: s.at, value: text[start:s.at]})

		if err := s.trivia(); err != nil {
			return o, err
		}
		if s.done() {
			return o, s.unexpected()
		}
		switch s.peek() {
		case ',':
			s.at++
		case '}':
		default:
			return o, s.unexpected()
		}
	}

	s.at++
	if err := s.trivia(); err != nil {
		return o, err
	}
	if !s.done() {
		return o, s.unexpected()
	}

	return o, nil
}

func (o object) find(key string) (member, bool) {
	var found member
	ok := false
	for _, each := range o.members {
		if each.key == key {
			found, ok = each, true
		}
	}

	return found, ok
}

func (o object) set(key, value string) string {
	if o.open < 0 {
		return "{\n\t" + quoted(key) + ": " + value + "\n}\n"
	}

	if _, found := o.find(key); found {
		text := o.text
		for i := len(o.members) - 1; i >= 0; i-- {
			if each := o.members[i]; each.key == key {
				text = text[:each.start] + value + text[each.end:]
			}
		}
		return text
	}

	entry := quoted(key) + ": " + value
	indent := o.indent()
	text := o.text

	lineStart := strings.LastIndexByte(text[:o.close], '\n') + 1
	before := text[:o.close]
	if lineStart > o.open && strings.TrimSpace(text[lineStart:o.close]) == "" {
		before = text[:lineStart]
		entry = indent + entry + "\n"
	} else {
		entry = "\n" + indent + entry + "\n"
	}

	if len(o.members) > 0 {
		last := o.members[len(o.members)-1]
		if !followedByComma(text, last.end) {
			return text[:last.end] + "," + before[last.end:] + entry + text[len(before):]
		}
	}

	return before + entry + text[len(before):]
}

func (o object) indent() string {
	if len(o.members) == 0 {
		return "\t"
	}

	keyStart := o.members[0].keyStart
	lineStart := strings.LastIndexByte(o.text[:keyStart], '\n') + 1
	if lineStart <= o.open {
		return "\t"
	}
	if lead := o.text[lineStart:keyStart]; strings.TrimLeft(lead, " \t") == "" && lead != "" {
		return lead
	}

	return "\t"
}

func followedByComma(text string, at int) bool {
	s := scanner{text: text, at: at}
	return s.trivia() == nil && !s.done() && s.peek() == ','
}

func quoted(key string) string {
	encoded, _ := json.Marshal(key)
	return string(encoded)
}

type scanner struct {
	text string
	at   int
}

func (s *scanner) done() bool { return s.at >= len(s.text) }

func (s *scanner) peek() byte { return s.text[s.at] }

func (s *scanner) unexpected() error {
	line := strings.Count(s.text[:min(s.at, len(s.text))], "\n") + 1
	if s.done() {
		return fmt.Errorf("the file ends early (line %d)", line)
	}
	return fmt.Errorf("unexpected %q on line %d", s.text[s.at], line)
}

func (s *scanner) trivia() error {
	for !s.done() {
		switch {
		case strings.ContainsRune(" \t\r\n", rune(s.peek())):
			s.at++
		case strings.HasPrefix(s.text[s.at:], "//"):
			end := strings.IndexByte(s.text[s.at:], '\n')
			if end < 0 {
				s.at = len(s.text)
			} else {
				s.at += end + 1
			}
		case strings.HasPrefix(s.text[s.at:], "/*"):
			end := strings.Index(s.text[s.at+2:], "*/")
			if end < 0 {
				s.at = len(s.text)
				return s.unexpected()
			}
			s.at += end + 4
		default:
			return nil
		}
	}

	return nil
}

func (s *scanner) string() error {
	if s.done() || s.peek() != '"' {
		return s.unexpected()
	}
	for s.at++; !s.done(); s.at++ {
		switch s.peek() {
		case '\\':
			s.at++
		case '"':
			s.at++
			return nil
		case '\n':
			return s.unexpected()
		}
	}

	return s.unexpected()
}

func (s *scanner) value() error {
	if s.done() {
		return s.unexpected()
	}

	switch s.peek() {
	case '"':
		return s.string()
	case '{', '[':
		return s.nested()
	}

	start := s.at
	for !s.done() && !strings.ContainsRune(" \t\r\n,}]/", rune(s.peek())) {
		s.at++
	}
	if s.at == start {
		return s.unexpected()
	}

	return nil
}

func (s *scanner) nested() error {
	var closing []byte
	for !s.done() {
		if err := s.trivia(); err != nil {
			return err
		}
		if s.done() {
			break
		}

		switch c := s.peek(); c {
		case '"':
			if err := s.string(); err != nil {
				return err
			}
			continue
		case '{':
			closing = append(closing, '}')
		case '[':
			closing = append(closing, ']')
		case '}', ']':
			if len(closing) == 0 || closing[len(closing)-1] != c {
				return s.unexpected()
			}
			closing = closing[:len(closing)-1]
			if len(closing) == 0 {
				s.at++
				return nil
			}
		}
		s.at++
	}

	return s.unexpected()
}
