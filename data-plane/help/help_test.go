package help

import (
	"slices"
	"strings"
	"testing"
)

var registry = NewRegistry([]Command{
	{Path: "tools", Group: true, Summary: "Use the tools of a station.", Usage: []string{"spotlight tools <command>"}},
	{Path: "tools call", Summary: "Call a tool.", Usage: []string{"spotlight tools call <tool> --input <json>"},
		Flags:    []Flag{{Name: "input", Value: "<json>", Usage: "The tool input."}, {Name: "f", Usage: "Follow."}},
		Examples: []Example{{Comment: "Call one", Command: "spotlight tools call github.issue --input {}"}},
		Exits:    []Exit{{Code: 2, Means: "The tool failed."}},
		Docs:     "tools-command#spotlight-tools-call"},
	{Path: "tools search", Summary: "Search the tools.", Usage: []string{"spotlight tools search <words>"}},
	{Path: "host", Summary: "Run sandboxes.", Usage: []string{"spotlight host"}},
})

func TestResolvesTheLongestKnownCommand(t *testing.T) {
	command, rest, found := registry.Resolve([]string{"tools", "call", "--input", "{}"})
	if !found || command.Path != "tools call" || !slices.Equal(rest, []string{"--input", "{}"}) {
		t.Fatalf("resolved %q, rest %q, found %v", command.Path, rest, found)
	}

	command, rest, _ = registry.Resolve([]string{"tools", "clal"})
	if command.Path != "tools" || !slices.Equal(rest, []string{"clal"}) {
		t.Fatalf("resolved %q, rest %q", command.Path, rest)
	}

	if _, _, found := registry.Resolve([]string{"deploy"}); found {
		t.Fatal("resolved a command that is not there")
	}
}

func TestSuggestsCommandsNearATypo(t *testing.T) {
	for typed, want := range map[string]string{"hots": "host", "tolos": "tools", "too": "tools"} {
		if got := registry.Nearest("", typed); !slices.Equal(got, []string{want}) {
			t.Errorf("Nearest(%q) = %q, want %q", typed, got, want)
		}
	}
	if got := registry.Nearest("tools", "clal"); !slices.Equal(got, []string{"tools call"}) {
		t.Errorf("Nearest(tools clal) = %q", got)
	}
	if got := registry.Nearest("", "deploy"); len(got) > 0 {
		t.Errorf("Nearest(deploy) = %q, want nothing", got)
	}
}

func TestWantsHelpOnlyBeforeTheEndOfFlags(t *testing.T) {
	if !Wanted([]string{"tools", "call", "--help"}) || !Wanted([]string{"-h"}) {
		t.Error("missed a help flag")
	}
	if Wanted([]string{"tools", "call", "x", "--", "--help"}) {
		t.Error("took --help after -- as a help flag")
	}
}

func TestRendersACommandsFlagsExamplesAndExitCodes(t *testing.T) {
	command, _ := registry.Command("tools call")
	rendered := registry.Render(command)

	for _, want := range []string{
		"Call a tool.\n\nUsage:\n  spotlight tools call <tool> --input <json>",
		"  --input <json>  The tool input.",
		"  -f              Follow.",
		"  -h, --help      Show this help.",
		"Examples:\n  # Call one\n  spotlight tools call github.issue --input {}",
		"Exit codes:\n  2  The tool failed.",
		"Docs: " + DocsBase + "tools-command#spotlight-tools-call",
	} {
		if !strings.Contains(rendered, want) {
			t.Errorf("rendered\n%s\nwant it to say\n%s", rendered, want)
		}
	}
}

func TestRendersAGroupWithItsCommands(t *testing.T) {
	command, _ := registry.Command("tools")
	rendered := registry.Render(command)

	if !strings.Contains(rendered, "Commands:\n  call    Call a tool.\n  search  Search the tools.") {
		t.Errorf("rendered\n%s", rendered)
	}
	if !strings.Contains(rendered, "Run spotlight tools <command> --help for flags and examples.") {
		t.Errorf("rendered\n%s", rendered)
	}
}

func TestRendersTheRootBySection(t *testing.T) {
	rendered := registry.RenderRoot(Root{
		Summary:  "Spotlight.",
		Sections: []Section{{Title: "Tools", Paths: []string{"tools", "tools call"}}},
		Footer:   []string{"Run spotlight <command> --help."},
	})

	want := "Spotlight.\n\nUsage:\n  spotlight <command> [flags]\n\nTools:\n  tools       Use the tools of a station.\n  tools call  Call a tool.\n\nRun spotlight <command> --help."
	if rendered != want {
		t.Errorf("rendered\n%s\nwant\n%s", rendered, want)
	}
}

func TestSynopsisNamesTheHelpToRun(t *testing.T) {
	command, _ := registry.Command("tools call")
	if got := command.Synopsis(); got != "usage: spotlight tools call <tool> --input <json>\nRun spotlight tools call --help for flags and examples." {
		t.Errorf("Synopsis() = %q", got)
	}
}
