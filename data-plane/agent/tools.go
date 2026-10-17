package agent

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

func reach() (string, string, error) {
	endpoint, token := os.Getenv(protocol.AgentAPIURLVar), os.Getenv(protocol.AgentAPITokenVar)
	if endpoint == "" || token == "" {
		return "", "", fmt.Errorf("no run to reach for tools in: spotlight runs inside a Spotlight workspace")
	}

	return strings.TrimSuffix(endpoint, "/"), token, nil
}

func manifest() ([]protocol.ToolManifest, error) {
	endpoint, token, err := reach()
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequest(http.MethodGet, endpoint+strings.TrimSuffix(protocol.AgentAPIToolsPath, "/"), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+token)

	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("reach Spotlight: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		errorBody, _ := io.ReadAll(response.Body)
		return nil, fmt.Errorf("%s", strings.TrimSpace(string(errorBody)))
	}

	var tools []protocol.ToolManifest
	if err := json.NewDecoder(response.Body).Decode(&tools); err != nil {
		return nil, fmt.Errorf("Spotlight sent an unreadable tool list: %w", err)
	}

	return tools, nil
}

func command(name string) string {
	return "spotlight " + strings.Replace(name, ".", " ", 1)
}

const whole = "json"

func placeholder(input protocol.ToolInputManifest) string {
	switch {
	case input.Kind() == "number" || input.Kind() == "integer":
		return "<number>"
	case input.Scalar():
		return "<string>"
	}

	return "<json>"
}

func flagged(tool protocol.ToolManifest) []protocol.ToolInputManifest {
	var inputs []protocol.ToolInputManifest
	for _, input := range tool.Inputs {
		if input.Name != whole {
			inputs = append(inputs, input)
		}
	}

	return inputs
}

func signature(tool protocol.ToolManifest) string {
	parts := []string{command(tool.Name)}

	for _, input := range flagged(tool) {
		written := fmt.Sprintf("--%s %s", input.Name, placeholder(input))
		if input.Kind() == "boolean" {
			written = "--" + input.Name
		}
		if input.Piped {
			written += " (or piped in)"
		}
		if !input.Required || input.Defaulted {
			written = "[" + written + "]"
		}
		parts = append(parts, written)
	}
	if len(tool.Inputs) > 0 {
		parts = append(parts, "[--json <object> | --json -]")
	}

	return strings.Join(parts, " ")
}

const toolsListedAtMost = 30

func listing(tools []protocol.ToolManifest) string {
	if len(tools) == 0 {
		return "This run was given no tools."
	}
	if len(tools) > toolsListedAtMost {
		return summary(tools)
	}

	var written strings.Builder
	for index, tool := range tools {
		if index > 0 {
			written.WriteString("\n")
		}
		fmt.Fprintf(&written, "%s\n  %s\n", signature(tool), tool.Description)
		for _, input := range tool.Inputs {
			if input.Description != "" {
				fmt.Fprintf(&written, "    --%s  %s\n", input.Name, input.Description)
			}
		}
	}

	return strings.TrimRight(written.String(), "\n")
}

func summary(tools []protocol.ToolManifest) string {
	var order []string
	counted := map[string]int{}
	for _, tool := range tools {
		from := tool.Integration
		if from == "" {
			from = "Spotlight"
		}
		if counted[from] == 0 {
			order = append(order, from)
		}
		counted[from]++
	}

	var written strings.Builder
	fmt.Fprintf(&written, "This run was given %d tools, too many to list:\n", len(tools))
	for _, from := range order {
		fmt.Fprintf(&written, "  %s  %d\n", from, counted[from])
	}
	written.WriteString("\nFind one with: spotlight tools search \"<words>\"\nRead one with: spotlight tools describe <tool>")

	return written.String()
}

func toolsCmd(args []string, out io.Writer) error {
	if len(args) > 0 {
		switch args[0] {
		case "search":
			return searchTools(args[1:], out)
		case "describe":
			return describeTool(args[1:], out)
		default:
			return fmt.Errorf("no such command %q\n%s", "tools "+args[0], usage)
		}
	}

	tools, err := manifest()
	if err != nil {
		return err
	}

	fmt.Fprintln(out, listing(tools))

	return nil
}

func named(tools []protocol.ToolManifest, args []string) (protocol.ToolManifest, []string, bool) {
	for _, tool := range tools {
		if args[0] == tool.Name {
			return tool, args[1:], true
		}
		if len(args) > 1 && args[0]+"."+args[1] == tool.Name {
			return tool, args[2:], true
		}
	}

	return protocol.ToolManifest{}, nil, false
}

func piping(in io.Reader) bool {
	file, ok := in.(*os.File)
	if !ok {
		return true
	}

	info, err := file.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice == 0
}

func useTool(args []string, in io.Reader, out io.Writer) error {
	tools, err := manifest()
	if err != nil {
		return fmt.Errorf("could not read this run's tools to find %q: %w\n%s", args[0], err, usage)
	}

	tool, rest, found := named(tools, args)
	if !found {
		return fmt.Errorf("no such command %q\n%s\n\nThis run's tools:\n%s",
			strings.Join(args[:min(2, len(args))], " "), usage, listing(tools))
	}

	flags := flag.NewFlagSet(tool.Name, flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	object := flags.String(whole, "", "the whole input as one JSON object, or - to read it from stdin")
	texts := map[string]*string{}
	switches := map[string]*bool{}
	for _, input := range flagged(tool) {
		if input.Kind() == "boolean" {
			switches[input.Name] = flags.Bool(input.Name, false, input.Description)
		} else {
			texts[input.Name] = flags.String(input.Name, "", input.Description)
		}
	}

	if err := flags.Parse(rest); err != nil {
		return fmt.Errorf("%s: %v\nusage: %s", command(tool.Name), err, signature(tool))
	}
	if flags.NArg() > 0 {
		stray := flags.Arg(0)
		if at := len(rest) - flags.NArg(); at > 0 {
			before := strings.TrimLeft(rest[at-1], "-")
			if _, ok := switches[before]; ok {
				return fmt.Errorf("%s: %q follows --%s, which takes no value; write --%s=%s\nusage: %s",
					command(tool.Name), stray, before, before, stray, signature(tool))
			}
		}
		return fmt.Errorf("%s: %q is not a flag\nusage: %s", command(tool.Name), stray, signature(tool))
	}

	wholeGiven := false
	byFlag := map[string]bool{}
	flags.Visit(func(set *flag.Flag) {
		if set.Name == whole {
			wholeGiven = true
			return
		}
		byFlag[set.Name] = true
	})

	given := map[string]any{}
	stdinTaken := false
	if wholeGiven {
		text := *object
		if text == "-" || text == "/dev/stdin" {
			read, err := io.ReadAll(in)
			if err != nil {
				return fmt.Errorf("read the --json piped in: %w", err)
			}
			text, stdinTaken = string(read), true
		}

		var fields map[string]json.RawMessage
		if err := json.Unmarshal([]byte(text), &fields); err != nil || fields == nil {
			return fmt.Errorf("--json takes one JSON object, as --json '{\"name\": \"value\"}'\nusage: %s", signature(tool))
		}
		for name, value := range fields {
			given[name] = value
		}
	}

	for name := range byFlag {
		if value, ok := switches[name]; ok {
			given[name] = *value
			continue
		}
		given[name] = *texts[name]
	}

	for _, input := range tool.Inputs {
		if !input.Piped {
			continue
		}
		value, set := given[input.Name]
		named := byFlag[input.Name] && (value == "-" || value == "/dev/stdin")
		if set && !named {
			continue
		}
		if stdinTaken {
			if named {
				return fmt.Errorf("--%s cannot be read from stdin when --json is\nusage: %s", input.Name, signature(tool))
			}
			continue
		}
		if !set && !piping(in) {
			continue
		}

		piped, err := prose("", in)
		if err != nil {
			return fmt.Errorf("read what was piped in: %w", err)
		}
		if piped != "" {
			given[input.Name] = piped
		} else {
			delete(given, input.Name)
		}
	}

	for _, input := range tool.Inputs {
		if _, set := given[input.Name]; !set && input.Required && !input.Defaulted {
			return fmt.Errorf("--%s is required\nusage: %s", input.Name, signature(tool))
		}
	}

	asked, err := json.Marshal(given)
	if err != nil {
		return err
	}

	endpoint, token, err := reach()
	if err != nil {
		return err
	}

	answered, err := post(endpoint+protocol.AgentAPIToolsPath+tool.Name, token, asked)
	if err != nil {
		return err
	}

	fmt.Fprintln(out, readable(answered))

	return nil
}

func readable(answered string) string {
	var shaped struct {
		Output json.RawMessage `json:"output"`
	}
	if err := json.Unmarshal([]byte(answered), &shaped); err != nil {
		return answered
	}
	if shaped.Output == nil {
		return answered
	}

	var indented bytes.Buffer
	if json.Indent(&indented, shaped.Output, "", "  ") == nil {
		return indented.String()
	}

	return string(shaped.Output)
}
