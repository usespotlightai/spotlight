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
		{Name: "body", Schema: json.RawMessage(`{"type":"string"}`), Description: "What to say", Required: true, Piped: true},
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
			t.Errorf("reached for %q", name)
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

func TestListsTheToolsTheRunWasGiven(t *testing.T) {
	withTools(t, `{}`)
	out := new(bytes.Buffer)

	if err := run([]string{"tools"}, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	listed := out.String()
	for _, want := range []string{
		"spotlight linear comment [--issue <string>] --body <string> (or piped in) [--notify] [--json <object> | --json -]",
		"spotlight linear search [--filter <json>] [--first <number>] --team_id <string> [--state <string>] [--json <object> | --json -]",
		"Comment on the Linear issue this task came from.",
		"--body  What to say",
	} {
		if !strings.Contains(listed, want) {
			t.Errorf("listed %q, want it to say %q", listed, want)
		}
	}
	if strings.Contains(listed, "linear close") {
		t.Errorf("listed a tool the run was not given: %q", listed)
	}
}

func TestUsesAToolTypedAsTwoWords(t *testing.T) {
	_, carried := withTools(t, `{"output":"https://linear.app/acme/issue/ENG-12#comment-1"}`)
	out := new(bytes.Buffer)

	args := []string{"linear", "comment", "--body", "Fixed in the queue worker.", "--notify"}
	if err := run(args, strings.NewReader(""), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["body"] != "Fixed in the queue worker." || (*carried)["notify"] != true {
		t.Errorf("carried %v", *carried)
	}
	if _, left := (*carried)["issue"]; left {
		t.Errorf("carried an issue nobody gave, which the task is left to say: %v", *carried)
	}
	if strings.TrimSpace(out.String()) != `"https://linear.app/acme/issue/ENG-12#comment-1"` {
		t.Errorf("said %q, want the tool's output as JSON", out.String())
	}
}

func TestUsesAToolByItsFullNameWithWhatIsPipedIn(t *testing.T) {
	_, carried := withTools(t, `{"output":{"id":"c_1","url":"https://linear.app/c/1"}}`)
	out := new(bytes.Buffer)

	if err := run([]string{"linear.comment"}, strings.NewReader("Split out in 4a1c2b0.\n"), out); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["body"] != "Split out in 4a1c2b0." {
		t.Errorf("carried %v", *carried)
	}
	if !strings.Contains(out.String(), `"url": "https://linear.app/c/1"`) {
		t.Errorf("said %q, want the answer as indented JSON", out.String())
	}
}

func TestRefusesAFlagTheToolDoesNotTake(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"linear", "comment", "--isue", "ENG-1"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "usage: spotlight linear comment [--issue <string>]") {
		t.Fatalf("err = %v, want how the tool is typed", err)
	}
}

func TestSaysWhichToolsThereAreForOneTheRunWasNotGiven(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"linear", "close"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "This run's tools:\nspotlight linear comment") {
		t.Fatalf("err = %v, want the tools it was given", err)
	}
}

func TestRefusesAToolUseMissingWhatItRequires(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"linear", "comment", "--notify"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "--body is required") {
		t.Fatalf("err = %v, want it to ask for the body", err)
	}
}

func TestReadsAPipedInputFromStandardInputWhenNamed(t *testing.T) {
	for _, named := range []string{"/dev/stdin", "-"} {
		t.Run(named, func(t *testing.T) {
			_, carried := withTools(t, `{}`)

			args := []string{"linear", "comment", "--body", named}
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

	args := []string{"linear", "search", "--json", `{"team_id":"ENG","first":5,"filter":{"state":"open"}}`}
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

	args := []string{"linear", "comment", "--json", "-"}
	if err := run(args, strings.NewReader(`{"body":"From the object.","notify":true}`), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["body"] != "From the object." || (*carried)["notify"] != true {
		t.Errorf("carried %v", *carried)
	}
}

func TestRefusesAPipedInputNamedWhenStandardInputCarriesTheJSON(t *testing.T) {
	withTools(t, `{}`)

	args := []string{"linear", "comment", "--json", "-", "--body", "-"}
	err := run(args, strings.NewReader(`{"notify":true}`), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), "--body cannot be read from stdin when --json is") {
		t.Fatalf("err = %v, want it to say stdin carries the JSON", err)
	}
}

func TestAFlagOverridesTheJSONObjectsField(t *testing.T) {
	_, carried := withTools(t, `{}`)

	args := []string{"linear", "search", "--json", `{"team_id":"ENG","first":5}`, "--team_id", "OPS"}
	if err := run(args, strings.NewReader(""), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["team_id"] != "OPS" || (*carried)["first"] != float64(5) {
		t.Errorf("carried %v", *carried)
	}
}

func TestCarriesFlagsAsTheTextGiven(t *testing.T) {
	_, carried := withTools(t, `{}`)

	args := []string{"linear", "search", "--team_id", "ENG", "--first", "10", "--filter", `{"state":"open"}`}
	if err := run(args, strings.NewReader(""), new(bytes.Buffer)); err != nil {
		t.Fatalf("run: %v", err)
	}

	if (*carried)["first"] != "10" || (*carried)["filter"] != `{"state":"open"}` {
		t.Errorf("carried %v, want the number and the object as the text given", *carried)
	}
}

func TestRefusesJSONThatIsNotAnObject(t *testing.T) {
	for _, given := range []string{`["ENG"]`, `null`, `{"team_id":`} {
		t.Run(given, func(t *testing.T) {
			withTools(t, `{}`)

			err := run([]string{"linear", "search", "--json", given}, strings.NewReader(""), new(bytes.Buffer))
			if err == nil || !strings.Contains(err.Error(), "--json takes one JSON object") {
				t.Fatalf("err = %v, want it to ask for a JSON object", err)
			}
		})
	}
}

func TestRefusesAValueAfterASwitch(t *testing.T) {
	_, carried := withTools(t, `{}`)

	args := []string{"linear", "comment", "--notify", "false", "--body", "Fixed."}
	err := run(args, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), `"false" follows --notify, which takes no value; write --notify=false`) {
		t.Fatalf("err = %v, want it to say how a switch takes a value", err)
	}
	if len(*carried) != 0 {
		t.Errorf("carried %v, want nothing used", *carried)
	}
}

func TestRefusesAStrayArgument(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"linear", "comment", "--body", "Fixed.", "again"}, strings.NewReader(""), new(bytes.Buffer))
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

	if !strings.Contains(listed, "spotlight linear thing-29") || strings.Contains(listed, "too many to list") {
		t.Errorf("listed %q, want all thirty tools", listed)
	}
}

func TestSummarisesMoreThanThirtyToolsByIntegration(t *testing.T) {
	listed := listing(manyTools(31))

	for _, want := range []string{
		"This run was given 31 tools, too many to list:",
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
	if said := readable(`{"output":"done \"now\""}`); said != `"done \"now\""` {
		t.Errorf("said %s, want the text as a JSON string", said)
	}
}

func TestRefusesAToolsCommandThereIsNot(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"tools", "find", "issue"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), `no such command "tools find"`) {
		t.Fatalf("err = %v, want it to name the command", err)
	}
}

func TestPrintsOnlyTheOutputOfAnAnswerThatSaysWhoItActedAs(t *testing.T) {
	said := readable(`{"output":{"id":"ENG-1"},"actingAs":{"holder":"user_1","personId":"user_1"}}`)

	if said != "{\n  \"id\": \"ENG-1\"\n}" {
		t.Errorf("said %s, want only the output", said)
	}
}
