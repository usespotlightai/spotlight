package agent

import (
	"encoding/json"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestConfigYAMLWritesEveryField(t *testing.T) {
	written, err := configYAML("f00d", protocol.StationConfig{
		Prompt:  text("Do it.\n"),
		Harness: "codex", Model: nil, Effort: text("high"), Image: text("ghcr.io/acme/dev:1"),
		Profile:      &protocol.ConfigProfile{Key: "quiet", Settings: json.RawMessage(`{"z":"x: y","n":1.5,"e":-1e5,"list":[],"map":{}}`)},
		Repositories: []protocol.ConfigRepository{{Name: "api", Setup: nil}},
		Skills:       []protocol.ConfigSkill{{Key: "tdd", Digest: "abc"}},
		Tools:        nil,
		Decisions:    false,
		Memories:     true,
		Judge:        &protocol.ConfigJudge{RubricDigest: "beef", Sample: 0.2, Trust: 1},
	})
	if err != nil {
		t.Fatalf("yaml: %v", err)
	}

	want := `fingerprint: "f00d"
harness: "codex"
model: null
effort: "high"
image: "ghcr.io/acme/dev:1"
profile:
  key: "quiet"
  settings:
    "e": -100000
    "list": []
    "map": {}
    "n": 1.5
    "z": "x: y"
repositories:
  - name: "api"
    setup: null
skills:
  - key: "tdd"
    digest: "abc"
tools: []
decisions: false
memories: true
judge:
  rubricDigest: "beef"
  sample: 0.2
  trust: 1
prompt: |2
  Do it.
`
	if written != want {
		t.Errorf("got\n%s\nwant\n%s", written, want)
	}
}

func TestConfigYAMLWritesNoJudgeAsNull(t *testing.T) {
	written, err := configYAML("f00d", protocol.StationConfig{Harness: "codex"})
	if err != nil {
		t.Fatalf("yaml: %v", err)
	}

	if !strings.Contains(written, "\njudge: null\n") {
		t.Errorf("no judge: null in\n%s", written)
	}
}

func TestPromptLiteralKeepsEveryCharacter(t *testing.T) {
	for _, tc := range []struct {
		name   string
		prompt string
		header string
	}{
		{"awkward text", "  indented: first line\n# not a comment\nsay \"hi\": 'now'\n\n\n  - not a list\ttab\n   \nend", " |2-"},
		{"one trailing newline", "a: b\n", " |2"},
		{"many trailing newlines", "a\n\n\n", " |2+"},
		{"leading blank lines", "\n\n  deep\n", " |2"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			block := literal(tc.prompt, 2)
			header, body, _ := strings.Cut(block, "\n")
			if header != tc.header {
				t.Fatalf("header %q, want %q", header, tc.header)
			}
			if got := readLiteral(header, body); got != tc.prompt {
				t.Errorf("read back %q, want %q", got, tc.prompt)
			}
		})
	}
}

func TestPromptThatCannotBeALiteralIsQuoted(t *testing.T) {
	for _, prompt := range []string{"", "\n\n", "carriage\r\nreturn", "bell\a"} {
		block := literal(prompt, 2)
		if !strings.HasPrefix(block, ` "`) {
			t.Errorf("%q written as %q", prompt, block)
		}
	}
}

func readLiteral(header, body string) string {
	lines := strings.Split(strings.TrimSuffix(body, "\n"), "\n")
	for i, line := range lines {
		lines[i] = strings.TrimPrefix(line, "  ")
	}
	content := strings.Join(lines, "\n")

	switch {
	case strings.HasSuffix(header, "-"):
		return strings.TrimRight(content, "\n")
	case strings.HasSuffix(header, "+"):
		return content + "\n"
	default:
		return strings.TrimRight(content, "\n") + "\n"
	}
}
