package help

import (
	"slices"
	"strings"
	"testing"
)

var registry = NewRegistry([]Command{
	{Path: "replay", Group: true, Summary: "Replay a station.", Usage: []string{"spotlight replay <command>"}},
	{Path: "replay start", Summary: "Start a replay.", Usage: []string{"spotlight replay start --set <set>"},
		Flags:    []Flag{{Name: "set", Value: "<set>", Usage: "The replay set."}, {Name: "f", Usage: "Follow."}},
		Examples: []Example{{Comment: "Start one", Command: "spotlight replay start --set nightly"}},
		Exits:    []Exit{{Code: 2, Means: "A regression."}},
		Docs:     "replay-command#spotlight-replay-start"},
	{Path: "replay stop", Summary: "Stop a replay.", Usage: []string{"spotlight replay stop <id>"}},
	{Path: "host", Summary: "Run sandboxes.", Usage: []string{"spotlight host"}},
})

func TestResolvesTheLongestKnownCommand(t *testing.T) {
	command, rest, found := registry.Resolve([]string{"replay", "start", "--set", "nightly"})
	if !found || command.Path != "replay start" || !slices.Equal(rest, []string{"--set", "nightly"}) {
		t.Fatalf("resolved %q, rest %q, found %v", command.Path, rest, found)
	}

	command, rest, _ = registry.Resolve([]string{"replay", "strat"})
	if command.Path != "replay" || !slices.Equal(rest, []string{"strat"}) {
		t.Fatalf("resolved %q, rest %q", command.Path, rest)
	}

	if _, _, found := registry.Resolve([]string{"deploy"}); found {
		t.Fatal("resolved a command that is not there")
	}
}

func TestSuggestsCommandsNearATypo(t *testing.T) {
	for typed, want := range map[string]string{"hots": "host", "rpelay": "replay", "rep": "replay"} {
		if got := registry.Nearest("", typed); !slices.Equal(got, []string{want}) {
			t.Errorf("Nearest(%q) = %q, want %q", typed, got, want)
		}
	}
	if got := registry.Nearest("replay", "strat"); !slices.Equal(got, []string{"replay start"}) {
		t.Errorf("Nearest(replay strat) = %q", got)
	}
	if got := registry.Nearest("", "deploy"); len(got) > 0 {
		t.Errorf("Nearest(deploy) = %q, want nothing", got)
	}
}

func TestWantsHelpOnlyBeforeTheEndOfFlags(t *testing.T) {
	if !Wanted([]string{"replay", "start", "--help"}) || !Wanted([]string{"-h"}) {
		t.Error("missed a help flag")
	}
	if Wanted([]string{"tools", "call", "x", "--", "--help"}) {
		t.Error("took --help after -- as a help flag")
	}
}

func TestRendersACommandsFlagsExamplesAndExitCodes(t *testing.T) {
	command, _ := registry.Command("replay start")
	rendered := registry.Render(command)

	for _, want := range []string{
		"Start a replay.\n\nUsage:\n  spotlight replay start --set <set>",
		"  --set <set>  The replay set.",
		"  -f           Follow.",
		"  -h, --help   Show this help.",
		"Examples:\n  # Start one\n  spotlight replay start --set nightly",
		"Exit codes:\n  2  A regression.",
		"Docs: " + DocsBase + "replay-command#spotlight-replay-start",
	} {
		if !strings.Contains(rendered, want) {
			t.Errorf("rendered\n%s\nwant it to say\n%s", rendered, want)
		}
	}
}

func TestRendersAGroupWithItsCommands(t *testing.T) {
	command, _ := registry.Command("replay")
	rendered := registry.Render(command)

	if !strings.Contains(rendered, "Commands:\n  start  Start a replay.\n  stop   Stop a replay.") {
		t.Errorf("rendered\n%s", rendered)
	}
	if !strings.Contains(rendered, "Run spotlight replay <command> --help for flags and examples.") {
		t.Errorf("rendered\n%s", rendered)
	}
}

func TestRendersTheRootBySection(t *testing.T) {
	rendered := registry.RenderRoot(Root{
		Summary:  "Spotlight.",
		Sections: []Section{{Title: "Replays", Paths: []string{"replay", "replay start"}}},
		Footer:   []string{"Run spotlight <command> --help."},
	})

	want := "Spotlight.\n\nUsage:\n  spotlight <command> [flags]\n\nReplays:\n  replay        Replay a station.\n  replay start  Start a replay.\n\nRun spotlight <command> --help."
	if rendered != want {
		t.Errorf("rendered\n%s\nwant\n%s", rendered, want)
	}
}

func TestSynopsisNamesTheHelpToRun(t *testing.T) {
	command, _ := registry.Command("replay start")
	if got := command.Synopsis(); got != "usage: spotlight replay start --set <set>\nRun spotlight replay start --help for flags and examples." {
		t.Errorf("Synopsis() = %q", got)
	}
}
