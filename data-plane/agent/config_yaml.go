package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"unicode"

	"usespotlight.ai/data-plane/protocol"
)

func configYAML(fingerprint string, config protocol.StationConfig) (string, error) {
	var out strings.Builder

	fmt.Fprintf(&out, "fingerprint: %s\n", quoted(fingerprint))
	fmt.Fprintf(&out, "harness: %s\n", quoted(config.Harness))
	fmt.Fprintf(&out, "model: %s\n", optional(config.Model))
	fmt.Fprintf(&out, "effort: %s\n", optional(config.Effort))
	fmt.Fprintf(&out, "image: %s\n", optional(config.Image))

	if config.Profile == nil {
		out.WriteString("profile: null\n")
	} else {
		settings, err := settingsOf(config.Profile.Settings)
		if err != nil {
			return "", fmt.Errorf("read the profile settings: %w", err)
		}
		out.WriteString("profile:\n")
		fmt.Fprintf(&out, "  key: %s\n", quoted(config.Profile.Key))
		out.WriteString("  settings:")
		yamlNode(&out, 4, settings)
	}

	if len(config.Repositories) == 0 {
		out.WriteString("repositories: []\n")
	} else {
		out.WriteString("repositories:\n")
		for _, repository := range config.Repositories {
			fmt.Fprintf(&out, "  - name: %s\n", quoted(repository.Name))
			fmt.Fprintf(&out, "    setup: %s\n", optional(repository.Setup))
		}
	}

	if len(config.Skills) == 0 {
		out.WriteString("skills: []\n")
	} else {
		out.WriteString("skills:\n")
		for _, skill := range config.Skills {
			fmt.Fprintf(&out, "  - key: %s\n", quoted(skill.Key))
			fmt.Fprintf(&out, "    digest: %s\n", quoted(skill.Digest))
		}
	}

	if len(config.Tools) == 0 {
		out.WriteString("tools: []\n")
	} else {
		out.WriteString("tools:\n")
		for _, tool := range config.Tools {
			fmt.Fprintf(&out, "  - %s\n", quoted(tool))
		}
	}

	fmt.Fprintf(&out, "decisions: %t\n", config.Decisions)
	fmt.Fprintf(&out, "memories: %t\n", config.Memories)

	out.WriteString("prompt:")
	if config.Prompt == nil {
		out.WriteString(" null\n")
	} else {
		out.WriteString(literal(*config.Prompt, 2))
	}

	return out.String(), nil
}

func settingsOf(raw json.RawMessage) (any, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, nil
	}

	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()

	var settings any
	if err := decoder.Decode(&settings); err != nil {
		return nil, err
	}

	return settings, nil
}

func yamlNode(out *strings.Builder, indent int, value any) {
	pad := strings.Repeat(" ", indent)

	switch typed := value.(type) {
	case map[string]any:
		if len(typed) == 0 {
			out.WriteString(" {}\n")
			return
		}
		out.WriteString("\n")
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		slices.Sort(keys)
		for _, key := range keys {
			out.WriteString(pad + quoted(key) + ":")
			yamlNode(out, indent+2, typed[key])
		}
	case []any:
		if len(typed) == 0 {
			out.WriteString(" []\n")
			return
		}
		out.WriteString("\n")
		for _, item := range typed {
			out.WriteString(pad + "-")
			yamlNode(out, indent+2, item)
		}
	default:
		out.WriteString(" " + yamlScalar(typed) + "\n")
	}
}

func yamlScalar(value any) string {
	switch typed := value.(type) {
	case nil:
		return "null"
	case bool:
		return strconv.FormatBool(typed)
	case json.Number:
		if exact, err := typed.Float64(); err == nil && strings.ContainsAny(typed.String(), "eE") {
			return strconv.FormatFloat(exact, 'f', -1, 64)
		}
		return typed.String()
	case string:
		return quoted(typed)
	default:
		return quoted(fmt.Sprint(typed))
	}
}

func quoted(text string) string {
	return strconv.Quote(text)
}

func optional(text *string) string {
	if text == nil {
		return "null"
	}

	return quoted(*text)
}

func literal(text string, indent int) string {
	if text == "" || !literalSafe(text) {
		return " " + quoted(text) + "\n"
	}

	body, trailing := strings.TrimRight(text, "\n"), len(text)-len(strings.TrimRight(text, "\n"))
	chomp := "+"
	switch trailing {
	case 0:
		chomp = "-"
	case 1:
		chomp = ""
	}

	pad := strings.Repeat(" ", indent)
	var out strings.Builder
	fmt.Fprintf(&out, " |%d%s\n", indent, chomp)
	for line := range strings.SplitSeq(body, "\n") {
		if line == "" {
			out.WriteString("\n")
			continue
		}
		out.WriteString(pad + line + "\n")
	}
	for range trailing - 1 {
		out.WriteString("\n")
	}

	return out.String()
}

func literalSafe(text string) bool {
	if strings.TrimRight(text, "\n") == "" {
		return false
	}

	for _, r := range text {
		if r == '\n' || r == '\t' {
			continue
		}
		if r == '\r' || r == '\uFEFF' || r == '\u2028' || r == '\u2029' || r == '\u0085' || !unicode.IsPrint(r) && r != ' ' {
			return false
		}
	}

	return true
}
