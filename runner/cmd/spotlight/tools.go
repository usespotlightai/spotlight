package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"usespotlight.ai/runner/internal/declare"
	"usespotlight.ai/runner/internal/protocol"
)

func reach() (string, string, error) {
	endpoint, token := os.Getenv(declare.URLVar), os.Getenv(declare.TokenVar)
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

	request, err := http.NewRequest(http.MethodGet, endpoint+strings.TrimSuffix(declare.ToolsPath, "/"), nil)
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
		said, _ := io.ReadAll(response.Body)
		return nil, fmt.Errorf("%s", strings.TrimSpace(string(said)))
	}

	var tools []protocol.ToolManifest
	if err := json.NewDecoder(response.Body).Decode(&tools); err != nil {
		return nil, fmt.Errorf("Spotlight said what tools there are unreadably: %w", err)
	}

	return tools, nil
}

func command(name string) string {
	return "spotlight " + strings.Replace(name, ".", " ", 1)
}

func signature(tool protocol.ToolManifest) string {
	parts := []string{command(tool.Name)}

	for _, input := range tool.Inputs {
		written := fmt.Sprintf("--%s <%s>", input.Name, input.Type)
		if input.Type == "boolean" {
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

	return strings.Join(parts, " ")
}

func listing(tools []protocol.ToolManifest) string {
	if len(tools) == 0 {
		return "This run was given no tools."
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

func listTools(out io.Writer) error {
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

	texts := map[string]*string{}
	switches := map[string]*bool{}
	for _, input := range tool.Inputs {
		if input.Type == "boolean" {
			switches[input.Name] = flags.Bool(input.Name, false, input.Description)
		} else {
			texts[input.Name] = flags.String(input.Name, "", input.Description)
		}
	}

	if err := flags.Parse(rest); err != nil {
		return fmt.Errorf("%s: %v\nusage: %s", command(tool.Name), err, signature(tool))
	}

	given := map[string]any{}
	flags.Visit(func(set *flag.Flag) {
		if value, ok := switches[set.Name]; ok {
			given[set.Name] = *value
			return
		}
		given[set.Name] = *texts[set.Name]
	})

	for _, input := range tool.Inputs {
		value, set := given[input.Name]
		named := set && (value == "-" || value == "/dev/stdin")
		if !input.Piped || (set && !named) || (!set && !piping(in)) {
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

	answered, err := post(endpoint+declare.ToolsPath+tool.Name, token, asked)
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

	var text string
	if json.Unmarshal(shaped.Output, &text) == nil {
		return text
	}

	var indented bytes.Buffer
	if json.Indent(&indented, shaped.Output, "", "  ") == nil {
		return indented.String()
	}

	return string(shaped.Output)
}
