package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

var commenting = protocol.ToolManifest{
	Name:        "linear.comment",
	Description: "Comment on the Linear issue this task came from.",
	Inputs: []protocol.ToolInputManifest{
		{Name: "issue", Schema: json.RawMessage(`{"type":"string"}`), Defaulted: true},
		{Name: "body", Schema: json.RawMessage(`{"type":"string"}`), Description: "What to say", Required: true, Stdin: true},
		{Name: "notify", Schema: json.RawMessage(`{"type":"boolean"}`)},
	},
}

var searching = protocol.ToolManifest{
	Name:        "linear.search",
	Description: "Search the team's Linear issues.",
	Inputs: []protocol.ToolInputManifest{
		{Name: "filter", Schema: json.RawMessage(`{"type":"object","properties":{"state":{"type":"string"}}}`)},
		{Name: "first", Schema: json.RawMessage(`{"type":["integer","null"]}`)},
		{Name: "team_id", Schema: json.RawMessage(`{"type":"string"}`), Required: true},
		{Name: "state", Schema: json.RawMessage(`{"enum":["open","closed"]}`)},
		{Name: "json", Schema: json.RawMessage(`{"type":"string"}`)},
	},
}

func withTools(t *testing.T, answer string) (*channel, *map[string]any) {
	t.Helper()

	server := inARun(t)
	carried := map[string]any{}
	server.Tools([]string{"linear.comment", "linear.search"}, func(_ context.Context, name string, input json.RawMessage) (json.RawMessage, error) {
		if name != "linear.comment" && name != "linear.search" {
			t.Errorf("called %q", name)
		}
		if err := json.Unmarshal(input, &carried); err != nil {
			t.Errorf("carried %s: %v", input, err)
		}
		return json.RawMessage(answer), nil
	})
	server.Manifest([]protocol.ToolManifest{
		commenting,
		searching,
		{Name: "linear.close", Description: "Close the issue."},
	})

	return server, &carried
}

func TestListsTheToolsEnabledForTheRun(t *testing.T) {
	withTools(t, `{}`)
	out := new(bytes.Buffer)

	if err := run([]string{"tools"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	listed := out.String()
	for _, want := range []string{
		"spotlight tools call linear.comment [--issue <string>] --body <string> (or piped in) [--notify] [--json <object> | --json -]",
		"spotlight tools call linear.search [--filter <json>] [--first <number>] --team_id <string> [--state <string>] [--json <object> | --json -]",
		"Comment on the Linear issue this task came from.",
		"--body  What to say",
	} {
		if !strings.Contains(listed, want) {
			t.Errorf("listed %q, want it to say %q", listed, want)
		}
	}
	if strings.Contains(listed, "linear close") {
		t.Errorf("listed a tool not enabled for the run: %q", listed)
	}
}

func TestUsesAToolTypedAsTwoWords(t *testing.T) {
	_, carried := withTools(t, `{"output":"https://linear.app/acme/issue/ENG-12#comment-1"}`)
	out := new(bytes.Buffer)

	args := []string{"tools", "call", "linear", "comment", "--body", "Fixed in the queue worker.", "--notify"}
	if err := run(args, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["body"] != "Fixed in the queue worker." || (*carried)["notify"] != true {
		t.Errorf("carried %v", *carried)
	}
	if _, left := (*carried)["issue"]; left {
		t.Errorf("carried an issue nobody supplied, which the task is left to say: %v", *carried)
	}
	if strings.TrimSpace(out.String()) != `"https://linear.app/acme/issue/ENG-12#comment-1"` {
		t.Errorf("output %q, want the tool's output as JSON", out.String())
	}
}

func TestUsesAToolByItsFullNameWithWhatIsPipedIn(t *testing.T) {
	_, carried := withTools(t, `{"output":{"id":"c_1","url":"https://linear.app/c/1"}}`)
	out := new(bytes.Buffer)

	if err := run([]string{"tools", "call", "linear.comment"}, strings.NewReader("Split out in 4a1c2b0.\n"), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["body"] != "Split out in 4a1c2b0." {
		t.Errorf("carried %v", *carried)
	}
	if !strings.Contains(out.String(), `"url": "https://linear.app/c/1"`) {
		t.Errorf("output %q, want the answer as indented JSON", out.String())
	}
}

func TestRejectsAFlagTheToolDoesNotTake(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"tools", "call", "linear", "comment", "--isue", "ENG-1"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "usage: spotlight tools call linear.comment [--issue <string>]") {
		t.Fatalf("err = %v, want how the tool is typed", err)
	}
}

func TestSaysWhichToolsThereAreForOneNotEnabledForTheRun(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"tools", "call", "linear", "close"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), `this run has no tool "linear" enabled; the nearest are linear.comment`) {
		t.Fatalf("err = %v, want the tools enabled for it", err)
	}
}

func TestRejectsAToolUseMissingWhatItRequires(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"tools", "call", "linear", "comment", "--notify"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "--body is required") {
		t.Fatalf("err = %v, want it to require the body", err)
	}
}

func TestReadsTheStdinInputWhenNamedAsStandardInput(t *testing.T) {
	for _, named := range []string{"/dev/stdin", "-"} {
		t.Run(named, func(t *testing.T) {
			_, carried := withTools(t, `{}`)

			args := []string{"tools", "call", "linear", "comment", "--body", named}
			if err := run(args, strings.NewReader("From the pipe.\n"), new(bytes.Buffer)); err != nil {
				t.Fatalf("run: %v", err)
			}

			if (*carried)["body"] != "From the pipe." {
				t.Errorf("carried %v", *carried)
			}
		})
	}
}

func TestTakesTheWholeInputAsOneJSONObject(t *testing.T) {
	_, carried := withTools(t, `{}`)

	args := []string{"tools", "call", "linear", "search", "--json", `{"team_id":"ENG","first":5,"filter":{"state":"open"}}`}
	if err := run(args, strings.NewReader(""), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	filter, _ := (*carried)["filter"].(map[string]any)
	if (*carried)["team_id"] != "ENG" || (*carried)["first"] != float64(5) || filter["state"] != "open" {
		t.Errorf("carried %v", *carried)
	}
}

func TestReadsTheJSONObjectFromStandardInput(t *testing.T) {
	_, carried := withTools(t, `{}`)

	args := []string{"tools", "call", "linear", "comment", "--json", "-"}
	if err := run(args, strings.NewReader(`{"body":"From the object.","notify":true}`), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["body"] != "From the object." || (*carried)["notify"] != true {
		t.Errorf("carried %v", *carried)
	}
}

func TestRejectsTheStdinInputNamedWhenStandardInputCarriesTheJSON(t *testing.T) {
	withTools(t, `{}`)

	args := []string{"tools", "call", "linear", "comment", "--json", "-", "--body", "-"}
	err := run(args, strings.NewReader(`{"notify":true}`), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "--body cannot be read from stdin when --json is") {
		t.Fatalf("err = %v, want it to say stdin carries the JSON", err)
	}
}

func TestAFlagOverridesTheJSONObjectsField(t *testing.T) {
	_, carried := withTools(t, `{}`)

	args := []string{"tools", "call", "linear", "search", "--json", `{"team_id":"ENG","first":5}`, "--team_id", "OPS"}
	if err := run(args, strings.NewReader(""), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["team_id"] != "OPS" || (*carried)["first"] != float64(5) {
		t.Errorf("carried %v", *carried)
	}
}

func TestCarriesFlagsAsTheTextTyped(t *testing.T) {
	_, carried := withTools(t, `{}`)

	args := []string{"tools", "call", "linear", "search", "--team_id", "ENG", "--first", "10", "--filter", `{"state":"open"}`}
	if err := run(args, strings.NewReader(""), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["first"] != "10" || (*carried)["filter"] != `{"state":"open"}` {
		t.Errorf("carried %v, want the number and the object as the text typed", *carried)
	}
}

func TestRejectsJSONThatIsNotAnObject(t *testing.T) {
	for _, input := range []string{`["ENG"]`, `null`, `{"team_id":`} {
		t.Run(input, func(t *testing.T) {
			withTools(t, `{}`)

			err := run([]string{"tools", "call", "linear", "search", "--json", input}, strings.NewReader(""), new(bytes.Buffer))
			if err == nil || !strings.Contains(err.Error(), "--json takes one JSON object") {
				t.Fatalf("err = %v, want it to require a JSON object", err)
			}
		})
	}
}

func TestRejectsAValueAfterASwitch(t *testing.T) {
	_, carried := withTools(t, `{}`)

	args := []string{"tools", "call", "linear", "comment", "--notify", "false", "--body", "Fixed."}
	err := run(args, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), `"false" follows --notify, which takes no value; write --notify=false`) {
		t.Fatalf("err = %v, want it to say how a switch takes a value", err)
	}
	if len(*carried) != 0 {
		t.Errorf("carried %v, want nothing used", *carried)
	}
}

func TestRejectsAStrayArgument(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"tools", "call", "linear", "comment", "--body", "Fixed.", "again"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), `"again" is not a flag`) {
		t.Fatalf("err = %v, want it to name the stray argument", err)
	}
}

func manyTools(count int) []protocol.ToolManifest {
	tools := make([]protocol.ToolManifest, 0, count)
	for at := range count {
		from, integration := "linear", "Linear"
		if at%3 == 0 {
			from, integration = "petstore", "Petstore"
		}
		tools = append(tools, protocol.ToolManifest{
			Name:        fmt.Sprintf("%s.thing-%d", from, at),
			Description: "Does a thing.",
			Integration: integration,
		})
	}

	return tools
}

func TestListsEveryToolUpToThirty(t *testing.T) {
	listed := listing(manyTools(30))

	if !strings.Contains(listed, "spotlight tools call linear.thing-29") || strings.Contains(listed, "too many to list") {
		t.Errorf("listed %q, want all thirty tools", listed)
	}
}

func TestSummarisesMoreThanThirtyToolsByIntegration(t *testing.T) {
	listed := listing(manyTools(31))

	for _, want := range []string{
		"This run has 31 tools enabled, too many to list:",
		"  Petstore  11\n",
		"  Linear  20\n",
		`spotlight tools search "<words>"`,
		"spotlight tools describe <tool>",
	} {
		if !strings.Contains(listed, want) {
			t.Errorf("listed %q, want it to say %q", listed, want)
		}
	}
	if strings.Contains(listed, "thing-1") {
		t.Errorf("listed a tool by name in a summary: %q", listed)
	}
}

func TestSummarisesSpotlightsOwnToolsUnderSpotlight(t *testing.T) {
	tools := append(manyTools(31), protocol.ToolManifest{Name: "pull-request", Description: "Open one."})

	if listed := listing(tools); !strings.Contains(listed, "  Spotlight  1\n") {
		t.Errorf("listed %q, want Spotlight's own tool counted", listed)
	}
}

func TestPrintsATextAnswerAsJSON(t *testing.T) {
	if output := readable(`{"output":"done \"now\""}`); output != `"done \"now\""` {
		t.Errorf("output %s, want the text as a JSON string", output)
	}
}

func TestRejectsAToolsCommandThereIsNot(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"tools", "find", "issue"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), `no command "tools find"`) {
		t.Fatalf("err = %v, want it to name the command", err)
	}
}

func TestPrintsOnlyTheOutputOfAnAnswerThatSaysWhoItActedAs(t *testing.T) {
	output := readable(`{"output":{"id":"ENG-1"},"actingAs":{"actsAs":"requester","personId":"user_1"}}`)

	if output != "{\n  \"id\": \"ENG-1\"\n}" {
		t.Errorf("output %s, want only the output", output)
	}
}
