package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"slices"
	"sort"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

const typedAtMostDeep = 6

var identifier = regexp.MustCompile(`^[A-Za-z_$][A-Za-z0-9_$]*$`)

type schema = map[string]any

type property struct {
	name        string
	shape       schema
	description string
	optional    bool
}

func parsed(raw json.RawMessage) schema {
	var shape schema
	if json.Unmarshal(raw, &shape) != nil {
		return schema{}
	}

	return shape
}

func listed(shape schema, key string) []any {
	values, _ := shape[key].([]any)
	return values
}

func jsonLiteral(value any) string {
	var written bytes.Buffer
	encoder := json.NewEncoder(&written)
	encoder.SetEscapeHTML(false)
	if encoder.Encode(value) != nil {
		return "unknown"
	}

	return strings.TrimSuffix(written.String(), "\n")
}

func union(parts []string) (string, bool) {
	var kept []string
	for _, part := range parts {
		if part != "" && !slices.Contains(kept, part) {
			kept = append(kept, part)
		}
	}
	if len(kept) == 0 {
		return "unknown", false
	}

	return strings.Join(kept, " | "), len(kept) > 1
}

func bracketed(text string, compound bool) string {
	if compound {
		return "(" + text + ")"
	}

	return text
}

func keyOf(name string) string {
	if identifier.MatchString(name) {
		return name
	}

	return jsonLiteral(name)
}

func comment(description string) string {
	return strings.ReplaceAll(oneLine(description), "*/", "*\\/")
}

func objectType(properties []property, extra string, indent string, depth int) string {
	if len(properties) == 0 && extra == "" {
		return "{}"
	}

	inner := indent + "  "
	var written strings.Builder
	written.WriteString("{\n")
	for _, each := range properties {
		if each.description != "" {
			fmt.Fprintf(&written, "%s/** %s */\n", inner, comment(each.description))
		}
		optional := ""
		if each.optional {
			optional = "?"
		}
		text, _ := typed(each.shape, inner, depth+1)
		fmt.Fprintf(&written, "%s%s%s: %s;\n", inner, keyOf(each.name), optional, text)
	}
	if extra != "" {
		fmt.Fprintf(&written, "%s[key: string]: %s;\n", inner, extra)
	}
	written.WriteString(indent + "}")

	return written.String()
}

func propertiesOf(shape schema) []property {
	fields, _ := shape["properties"].(map[string]any)
	required := map[string]bool{}
	for _, name := range listed(shape, "required") {
		if named, ok := name.(string); ok {
			required[named] = true
		}
	}

	names := make([]string, 0, len(fields))
	for name := range fields {
		names = append(names, name)
	}
	sort.Strings(names)

	properties := make([]property, 0, len(names))
	for _, name := range names {
		field, _ := fields[name].(map[string]any)
		description, _ := field["description"].(string)
		properties = append(properties, property{name, field, description, !required[name]})
	}

	return properties
}

func objectOf(shape schema, indent string, depth int) string {
	properties := propertiesOf(shape)
	extra := ""
	switch more := shape["additionalProperties"].(type) {
	case map[string]any:
		extra, _ = typed(more, indent+"  ", depth+1)
	case bool:
		if more && len(properties) == 0 {
			return "Record<string, unknown>"
		}
	default:
		if len(properties) == 0 {
			return "Record<string, unknown>"
		}
	}

	return objectType(properties, extra, indent, depth)
}

func arrayOf(shape schema, indent string, depth int) string {
	items, ok := shape["items"].(map[string]any)
	if !ok {
		return "unknown[]"
	}

	return bracketed(typed(items, indent, depth+1)) + "[]"
}

func ofType(kind string, shape schema, indent string, depth int) string {
	switch kind {
	case "string":
		return "string"
	case "number", "integer":
		return "number"
	case "boolean":
		return "boolean"
	case "null":
		return "null"
	case "array":
		return arrayOf(shape, indent, depth)
	case "object":
		return objectOf(shape, indent, depth)
	}

	return "unknown"
}

func typed(shape schema, indent string, depth int) (string, bool) {
	if depth > typedAtMostDeep {
		return "unknown", false
	}

	if constant, ok := shape["const"]; ok {
		return jsonLiteral(constant), false
	}
	if values := listed(shape, "enum"); len(values) > 0 {
		parts := make([]string, 0, len(values))
		for _, value := range values {
			parts = append(parts, jsonLiteral(value))
		}
		return union(parts)
	}
	for _, key := range []string{"anyOf", "oneOf"} {
		if choices := listed(shape, key); len(choices) > 0 {
			parts := make([]string, 0, len(choices))
			for _, choice := range choices {
				each, _ := choice.(map[string]any)
				text, _ := typed(each, indent, depth+1)
				parts = append(parts, text)
			}
			return union(parts)
		}
	}
	if all := listed(shape, "allOf"); len(all) > 0 {
		parts := make([]string, 0, len(all))
		for _, each := range all {
			part, _ := each.(map[string]any)
			parts = append(parts, bracketed(typed(part, indent, depth+1)))
		}
		return strings.Join(parts, " & "), len(parts) > 1
	}

	switch kind := shape["type"].(type) {
	case string:
		return ofType(kind, shape, indent, depth), false
	case []any:
		parts := make([]string, 0, len(kind))
		for _, each := range kind {
			named, _ := each.(string)
			parts = append(parts, ofType(named, shape, indent, depth))
		}
		return union(parts)
	}

	if _, ok := shape["properties"]; ok {
		return objectOf(shape, indent, depth), false
	}
	if _, ok := shape["items"]; ok {
		return arrayOf(shape, indent, depth), false
	}

	return "unknown", false
}

func typescript(raw json.RawMessage) string {
	text, _ := typed(parsed(raw), "", 0)
	return text
}

func inputType(tool protocol.ToolManifest) string {
	properties := make([]property, 0, len(tool.Inputs))
	for _, input := range tool.Inputs {
		shape := parsed(input.Schema)
		description := input.Description
		if description == "" {
			description, _ = shape["description"].(string)
		}
		properties = append(properties, property{input.Name, shape, description, !input.Required || input.Defaulted})
	}

	return objectType(properties, "", "", 0)
}

func sample(shape schema, depth int) any {
	if depth > typedAtMostDeep {
		return nil
	}
	if examples := listed(shape, "examples"); len(examples) > 0 {
		return examples[0]
	}
	if given, ok := shape["default"]; ok {
		return given
	}
	if constant, ok := shape["const"]; ok {
		return constant
	}
	if values := listed(shape, "enum"); len(values) > 0 {
		return values[0]
	}
	for _, key := range []string{"anyOf", "oneOf", "allOf"} {
		if choices := listed(shape, key); len(choices) > 0 {
			first, _ := choices[0].(map[string]any)
			return sample(first, depth+1)
		}
	}

	kind, _ := shape["type"].(string)
	if kinds := listed(shape, "type"); len(kinds) > 0 {
		for _, each := range kinds {
			if named, _ := each.(string); named != "null" {
				kind = named
				break
			}
		}
	}
	if kind == "" {
		switch {
		case shape["properties"] != nil:
			kind = "object"
		case shape["items"] != nil:
			kind = "array"
		}
	}

	switch kind {
	case "string":
		return "…"
	case "number", "integer":
		return 0
	case "boolean":
		return true
	case "null":
		return nil
	case "array":
		items, _ := shape["items"].(map[string]any)
		return []any{sample(items, depth+1)}
	case "object":
		object := map[string]any{}
		for _, each := range propertiesOf(shape) {
			if !each.optional {
				object[each.name] = sample(each.shape, depth+1)
			}
		}
		return object
	}

	return "…"
}

func shellQuoted(text string) string {
	return "'" + strings.ReplaceAll(text, "'", `'\''`) + "'"
}

func flagValue(value any) string {
	switch given := value.(type) {
	case string:
		if given == "…" {
			return `"…"`
		}
		return shellQuoted(given)
	case nil:
		return shellQuoted("")
	}

	return jsonLiteral(value)
}

func exampleCall(tool protocol.ToolManifest) string {
	var given []protocol.ToolInputManifest
	for _, input := range tool.Inputs {
		if (input.Required && !input.Defaulted) || (input.Name == protocol.ToolIntentInput && tool.Approval != nil) {
			given = append(given, input)
		}
	}

	scalar := true
	for _, input := range given {
		scalar = scalar && input.Scalar()
	}

	parts := []string{command(tool.Name)}
	if !scalar {
		object := map[string]any{}
		for _, input := range given {
			object[input.Name] = sample(parsed(input.Schema), 0)
		}
		return strings.Join(append(parts, "--json", shellQuoted(jsonLiteral(object))), " ")
	}

	for _, input := range given {
		value := sample(parsed(input.Schema), 0)
		switch {
		case value == true && input.Kind() == "boolean":
			parts = append(parts, "--"+input.Name)
		case input.Kind() == "boolean":
			parts = append(parts, fmt.Sprintf("--%s=%s", input.Name, jsonLiteral(value)))
		default:
			parts = append(parts, fmt.Sprintf("--%s %s", input.Name, flagValue(value)))
		}
	}

	return strings.Join(parts, " ")
}

func describing(tool protocol.ToolManifest) string {
	heading := tool.Name
	if tool.Integration != "" {
		heading += " (from " + tool.Integration + ")"
	}

	sections := []string{heading + "\n" + strings.TrimSpace(tool.Description)}
	if len(tool.Inputs) == 0 {
		sections = append(sections, "Takes nothing.")
	} else {
		sections = append(sections, "Takes:\n"+inputType(tool))
	}
	sections = append(sections, "For example:\n"+exampleCall(tool))

	return strings.Join(sections, "\n\n")
}

const describeUsage = "usage: spotlight tools describe <tool>   as spotlight tools describe linear.issue-create"

func describeTool(args []string, out io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("say which tool\n%s", describeUsage)
	}

	tools, err := manifest()
	if err != nil {
		return err
	}

	tool, rest, found := named(tools, args)
	if !found || len(rest) > 0 {
		asked := strings.Join(args, " ")
		if near := search(tools, asked, 3); len(near) > 0 {
			names := make([]string, 0, len(near))
			for _, each := range near {
				names = append(names, each.Name)
			}
			return fmt.Errorf("this run was given no tool %q; the nearest are %s\n%s", asked, strings.Join(names, ", "), describeUsage)
		}
		return fmt.Errorf("this run was given no tool %q\n%s", asked, describeUsage)
	}

	fmt.Fprintln(out, describing(tool))

	return nil
}
