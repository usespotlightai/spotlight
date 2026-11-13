package harnesses

import (
	"context"
	"embed"
	"slices"
	"strings"
	"unicode"

	"usespotlight.ai/data-plane/host/internal/sandbox"
	"usespotlight.ai/data-plane/protocol"
)

//go:embed dockerfiles/*.Dockerfile
var dockerfiles embed.FS

type Key struct {
	Name   string
	Label  string
	Host   string
	Header string
	Prefix string
}

type Harness struct {
	ID   string
	Name string
	Keys []string
}

var labels = map[string]string{
	"CLAUDE_CODE_OAUTH_TOKEN": "Claude subscription token, from claude setup-token",
	"ANTHROPIC_API_KEY":       "Anthropic API key",
	"OPENAI_API_KEY":          "OpenAI API key",
	"CODEX_API_KEY":           "OpenAI API key for Codex",
	"CURSOR_API_KEY":          "Cursor API key",
	"OPENROUTER_API_KEY":      "OpenRouter API key",
}

var all = []Harness{
	{ID: "claude-code", Name: "Claude Code", Keys: []string{"CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"}},
	{ID: "codex", Name: "Codex", Keys: []string{"OPENAI_API_KEY", "CODEX_API_KEY"}},
	{ID: "cursor", Name: "Cursor CLI", Keys: []string{"CURSOR_API_KEY"}},
	{ID: "opencode", Name: "OpenCode", Keys: []string{"ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"}},
}

func All() []Harness {
	return slices.Clone(all)
}

func KeyNamed(name string) (Key, bool) {
	binding, known := protocol.HarnessKeyBindingOf(name)
	label, labelled := labels[name]
	if !known || !labelled {
		return Key{}, false
	}
	return Key{Name: name, Label: label, Host: binding.Host, Header: binding.Header, Prefix: binding.Prefix}, true
}

func (h Harness) Dockerfile() ([]byte, error) {
	return dockerfiles.ReadFile("dockerfiles/" + h.ID + ".Dockerfile")
}

type Builder interface {
	Build(ctx context.Context, build sandbox.Build, progress func(string)) error
}

func Tag(version string, picked []Harness) string {
	ids := make([]string, 0, len(picked))
	for _, each := range picked {
		ids = append(ids, each.ID)
	}
	release := strings.Map(func(r rune) rune {
		if r == '.' || r == '-' || r == '_' || unicode.IsLetter(r) || unicode.IsDigit(r) {
			return r
		}
		return '-'
	}, strings.TrimPrefix(version, "v"))
	return "spotlight-harnesses:" + release + "-" + strings.Join(ids, "-")
}

func BuildImage(ctx context.Context, builder Builder, base, tag string, picked []Harness, progress func(string)) error {
	dockerfile, err := dockerfileFor(picked)
	if err != nil {
		return err
	}
	return builder.Build(ctx, sandbox.Build{Tag: tag, Dockerfile: dockerfile, Args: map[string]string{"BASE": base}}, progress)
}

func dockerfileFor(picked []Harness) ([]byte, error) {
	lines := []string{"ARG BASE", "FROM ${BASE}"}
	for _, each := range picked {
		dockerfile, err := each.Dockerfile()
		if err != nil {
			return nil, err
		}
		for _, line := range strings.Split(strings.TrimSpace(string(dockerfile)), "\n") {
			if strings.HasPrefix(line, "ARG BASE") || strings.HasPrefix(line, "FROM ") {
				continue
			}
			lines = append(lines, line)
		}
	}
	return []byte(strings.Join(lines, "\n") + "\n"), nil
}
