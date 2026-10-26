package main

import (
	"fmt"
	"io"
	"os"
	"strings"

	"usespotlight.ai/data-plane/agent"
	"usespotlight.ai/data-plane/egress"
	"usespotlight.ai/data-plane/help"
	"usespotlight.ai/data-plane/host"
	"usespotlight.ai/data-plane/login"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/replay"
	"usespotlight.ai/data-plane/runner"
	"usespotlight.ai/data-plane/telemetry"
)

var version = "dev"

var helpHelp = help.Command{
	Path:    "help",
	Summary: "Show help for spotlight, or for one command.",
	Usage:   []string{"spotlight help [<command>...]", "spotlight help --all"},
	Flags:   []help.Flag{{Name: "all", Usage: "List every command, in a run and outside one."}},
	Examples: []help.Example{
		{Command: "spotlight help replay check"},
		{Command: "spotlight help --all"},
	},
}

var versionHelp = help.Command{
	Path:    "version",
	Summary: "Print the release of this binary.",
	Usage:   []string{"spotlight version", "spotlight --version"},
}

var commands = help.NewRegistry(
	agent.Commands, host.Commands, replay.Commands, login.Commands, egress.Commands, runner.Commands,
	[]help.Command{helpHelp, versionHelp},
)

var agentSections = []help.Section{
	{Title: "Hand the task on", Paths: []string{"handover", "reply"}},
	{Title: "Tools", Paths: []string{"tools", "tools search", "tools describe", "tools call"}},
	{Title: "Team memory", Paths: []string{"recall", "remember"}},
	{Title: "Earlier work", Paths: []string{"trace", "history"}},
	{Title: "Station search", Paths: []string{"candidate", "cause"}},
}

var operatorSections = []help.Section{
	{Title: "Start here", Paths: []string{"login", "host init"}},
	{Title: "Hosts", Paths: []string{"host", "host status", "host config", "host logs", "host update"}},
	{Title: "Replays", Paths: []string{"replay", "replay check"}},
	{Title: "Account", Paths: []string{"logout"}},
	{Title: "Other", Paths: []string{"version", "help"}},
}

var sandboxSection = help.Section{Title: "Started by the host", Paths: []string{"runner", "egress"}}

func inRun() bool {
	return os.Getenv(protocol.AgentAPIURLVar) != ""
}

func root(all bool) help.Root {
	footer := []string{"Run spotlight <command> --help for flags and examples."}

	switch {
	case all:
		sections := append(append([]help.Section{}, operatorSections...), sandboxSection)
		for _, each := range agentSections {
			sections = append(sections, help.Section{Title: each.Title + " (in a run)", Paths: each.Paths})
		}
		return help.Root{Summary: "Spotlight command line.", Sections: sections, Footer: append(footer, "Docs: "+help.DocsBase+"spotlight-command")}
	case inRun():
		return help.Root{Summary: "Commands for this Spotlight run.", Sections: agentSections, Footer: append(footer, "Docs: "+help.DocsBase+"agent-commands")}
	default:
		return help.Root{
			Summary:  "Spotlight command line: hosts for your runs, replays, and your login.",
			Sections: operatorSections,
			Footer: append(footer,
				"Run spotlight help --all for the commands that agents use in a run.",
				"Docs: "+help.DocsBase+"spotlight-command"),
		}
	}
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, out, errs io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(out, commands.RenderRoot(root(false)))
		return 0
	}

	switch args[0] {
	case "help":
		return helpFor(args[1:], out, errs)
	case "-h", "-help", "--help":
		return helpFor(args[1:], out, errs)
	case "--version", "-v":
		args = []string{"version"}
	}

	command, rest, found := commands.Resolve(args)
	if !found {
		return unknown("", args, errs)
	}
	if help.Wanted(args) || (command.Group && len(rest) == 0) {
		return helpFor(args, out, errs)
	}
	if len(rest) > 0 && !strings.HasPrefix(rest[0], "-") && len(commands.Children(command.Path)) > 0 {
		return unknown(command.Path, rest, errs)
	}

	defer telemetry.Start(roleOf(args[0]), version).Stop()

	switch args[0] {
	case "host":
		return host.Main(args[1:], version)
	case "runner":
		return runner.Main(args[1:], version)
	case "egress":
		return egress.Main(args[1:], version)
	case "replay":
		return replay.Main(args[1:], version)
	case "login":
		return login.Main(args[1:], version)
	case "logout":
		return login.Logout(args[1:], version)
	case "token":
		return login.Token(args[1:], version)
	case "version":
		fmt.Fprintln(out, version)
		return 0
	default:
		return agent.Main(args)
	}
}

func helpFor(args []string, out, errs io.Writer) int {
	var words []string
	all := false
	for _, each := range args {
		switch each {
		case "--all", "-all":
			all = true
		case "-h", "-help", "--help":
		default:
			words = append(words, each)
		}
	}

	if len(words) == 0 {
		fmt.Fprintln(out, commands.RenderRoot(root(all)))
		return 0
	}

	command, rest, found := commands.Resolve(words)
	if !found {
		return unknown("", words, errs)
	}
	if command.Path == "tools call" && len(rest) > 0 && inRun() {
		if err := agent.Describe(toolOf(rest), out); err != nil {
			fmt.Fprintln(errs, err)
			return 1
		}
		return 0
	}
	if len(rest) > 0 && len(commands.Children(command.Path)) > 0 {
		return unknown(command.Path, rest, errs)
	}

	fmt.Fprintln(out, commands.Render(command))
	return 0
}

func toolOf(args []string) []string {
	var named []string
	for _, each := range args {
		if strings.HasPrefix(each, "-") || len(named) == 2 {
			break
		}
		named = append(named, each)
	}

	return named
}

func unknown(parent string, args []string, errs io.Writer) int {
	asked := strings.TrimSpace(parent + " " + args[0])
	fmt.Fprintf(errs, "spotlight: no command %q.\n", asked)

	if near := commands.Nearest(parent, args[0]); len(near) > 0 {
		fmt.Fprintf(errs, "Did you mean spotlight %s?\n", strings.Join(near, " or spotlight "))
	} else if (parent == "" || parent == "tools") && inRun() {
		if call, ok := agent.ToolCommand(args); ok {
			fmt.Fprintf(errs, "Tools are called with spotlight tools call, as in: %s\n", call)
		}
	}

	if parent == "" {
		fmt.Fprintln(errs, "Run spotlight --help for the commands.")
	} else {
		fmt.Fprintf(errs, "Run spotlight %s --help for its commands.\n", parent)
	}

	return 1
}

func roleOf(command string) string {
	switch command {
	case "host", "runner", "egress", "replay":
		return command
	case "login", "logout", "token":
		return "login"
	default:
		return "agent"
	}
}
