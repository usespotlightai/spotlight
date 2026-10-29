package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/help"
	"usespotlight.ai/data-plane/protocol"
)

func outsideARun(t *testing.T) {
	t.Setenv(protocol.AgentAPIURLVar, "")
	t.Setenv(protocol.AgentAPITokenVar, "")
}

func inARun(t *testing.T, manifest string) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != strings.TrimSuffix(protocol.AgentAPIToolsPath, "/") {
			http.NotFound(writer, request)
			return
		}
		writer.Write([]byte(manifest))
	}))
	t.Cleanup(server.Close)

	t.Setenv(protocol.AgentAPIURLVar, server.URL)
	t.Setenv(protocol.AgentAPITokenVar, "token")
}

func ran(args ...string) (int, string, string) {
	var out, errs bytes.Buffer
	code := run(args, &out, &errs)

	return code, out.String(), errs.String()
}

func TestEveryListedCommandIsKnown(t *testing.T) {
	for _, group := range [][]help.Section{operatorSections, agentSections, {sandboxSection}} {
		for _, section := range group {
			for _, path := range section.Paths {
				if _, ok := commands.Command(path); !ok {
					t.Errorf("section %q lists %q, which has no help", section.Title, path)
				}
			}
		}
	}
}

func TestEveryCommandHasASummaryAndUsage(t *testing.T) {
	for _, args := range [][]string{{"handover"}, {"tools", "call"}, {"host", "config", "set"}, {"replay", "check"}, {"login"}, {"egress", "serve"}} {
		command, rest, found := commands.Resolve(args)
		if !found || len(rest) > 0 || command.Summary == "" || len(command.Usage) == 0 {
			t.Errorf("%q resolved to %+v, rest %q", args, command, rest)
		}
	}
}

func TestBareSpotlightListsThePersonsCommands(t *testing.T) {
	outsideARun(t)

	code, out, _ := ran()
	if code != 0 || !strings.Contains(out, "host init") || strings.Contains(out, "handover") {
		t.Fatalf("exit %d, printed\n%s", code, out)
	}
	if !strings.Contains(out, "spotlight help --all") {
		t.Errorf("printed\n%s\nwant it to name help --all", out)
	}
}

func TestHelpInARunListsTheAgentsCommands(t *testing.T) {
	inARun(t, `[]`)

	code, out, _ := ran("--help")
	if code != 0 || !strings.Contains(out, "handover") || !strings.Contains(out, "tools call") || strings.Contains(out, "host init") {
		t.Fatalf("exit %d, printed\n%s", code, out)
	}
}

func TestHelpAllListsEveryCommand(t *testing.T) {
	outsideARun(t)

	_, out, _ := ran("help", "--all")
	for _, want := range []string{"host init", "replay check", "runner", "handover", "Tools (in a run):"} {
		if !strings.Contains(out, want) {
			t.Errorf("printed\n%s\nwant it to list %q", out, want)
		}
	}
}

func TestEveryFormOfHelpPrintsTheSameCommandHelp(t *testing.T) {
	outsideARun(t)

	_, want, _ := ran("replay", "check", "--help")
	if !strings.Contains(want, "Exit codes:") {
		t.Fatalf("printed\n%s", want)
	}
	for _, args := range [][]string{{"help", "replay", "check"}, {"replay", "check", "-h"}, {"replay", "check", "plan.json", "--help"}} {
		if code, out, _ := ran(args...); code != 0 || out != want {
			t.Errorf("%q: exit %d, printed\n%s", args, code, out)
		}
	}
}

func TestAGroupWithoutACommandPrintsItsHelp(t *testing.T) {
	outsideARun(t)

	code, out, _ := ran("replay")
	if code != 0 || !strings.Contains(out, "Commands:\n  check") {
		t.Fatalf("exit %d, printed\n%s", code, out)
	}
	for _, removed := range []string{"propose", "candidates", "show", "set", "start", "status", "watch", "stop"} {
		if strings.Contains(out, "\n  "+removed+" ") {
			t.Errorf("replay help lists %s:\n%s", removed, out)
		}
	}
}

func TestSuggestsTheCommandNearATypo(t *testing.T) {
	outsideARun(t)

	code, _, errs := ran("replay", "chek", "plan.json")
	if code != 1 || !strings.Contains(errs, `no command "replay chek"`) || !strings.Contains(errs, "Did you mean spotlight replay check?") {
		t.Fatalf("exit %d, said\n%s", code, errs)
	}
}

func TestPointsAToolTypedAsACommandToToolsCall(t *testing.T) {
	inARun(t, `[{"name": "linear.comment", "description": "Comment on the issue."}]`)

	code, _, errs := ran("linear", "comment", "--body", "Done.")
	if code != 1 || !strings.Contains(errs, "Tools are called with spotlight tools call, as in: spotlight tools call linear.comment") {
		t.Fatalf("exit %d, said\n%s", code, errs)
	}
}

func TestPointsAToolAfterToolsToToolsCall(t *testing.T) {
	inARun(t, `[{"name": "linear.comment", "description": "Comment on the issue."}]`)

	code, _, errs := ran("tools", "linear.comment", "--body", "Done.")
	if code != 1 || !strings.Contains(errs, "as in: spotlight tools call linear.comment") {
		t.Fatalf("exit %d, said\n%s", code, errs)
	}
}

func TestHelpForAToolCallDescribesTheTool(t *testing.T) {
	inARun(t, `[{"name": "linear.comment", "description": "Comment on the issue."}]`)

	code, out, _ := ran("tools", "call", "linear.comment", "--help")
	if code != 0 || !strings.Contains(out, "Comment on the issue.") || !strings.Contains(out, "spotlight tools call linear.comment") {
		t.Fatalf("exit %d, printed\n%s", code, out)
	}
}

func TestPrintsTheVersion(t *testing.T) {
	for _, args := range [][]string{{"version"}, {"--version"}} {
		if code, out, _ := ran(args...); code != 0 || out != "dev\n" {
			t.Errorf("%q: exit %d, printed %q", args, code, out)
		}
	}
}
