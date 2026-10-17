package agent

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

var creating = protocol.ToolManifest{
	Name:        "linear.issue-create",
	Description: "Create an issue. Needs a person’s approval before it runs: It posts publicly under the team's name. Using it asks them and does nothing else, so hand over and wait for their answer. Say what you want to do with --intent; the person reads it first.",
	Integration: "Linear",
	Approval:    &protocol.ToolApproval{Because: "It posts publicly under the team's name."},
	Inputs: []protocol.ToolInputManifest{
		{Name: "title", Schema: json.RawMessage(`{"type":"string"}`), Description: "What it is about", Required: true},
		{Name: "team-id", Schema: json.RawMessage(`{"type":"string","examples":["ENG"]}`), Required: true},
		{Name: "priority", Schema: json.RawMessage(`{"enum":[0,1,2]}`)},
		{Name: "state", Schema: json.RawMessage(`{"type":["string","null"],"enum":["open","closed",null]}`)},
		{Name: "labels", Schema: json.RawMessage(`{"type":"array","items":{"type":"string"}}`)},
		{Name: "estimate", Schema: json.RawMessage(`{"anyOf":[{"type":"integer"},{"type":"null"}]}`)},
		{Name: "draft", Schema: json.RawMessage(`{"type":"boolean"}`), Required: true},
		{Name: protocol.ToolIntentInput, Schema: json.RawMessage(`{"type":"string"}`)},
	},
}

func TestTypesAnObjectInTypeScript(t *testing.T) {
	typed := typescript(json.RawMessage(`{
		"type": "object",
		"required": ["name", "owner"],
		"properties": {
			"name": {"type": "string", "description": "What it is called"},
			"tags": {"type": "array", "items": {"type": "string"}},
			"owner": {
				"type": "object",
				"required": ["id"],
				"properties": {"id": {"type": "integer"}, "x-team": {"type": "string"}}
			},
			"kind": {"enum": ["bug", "feature"]},
			"either": {"type": "array", "items": {"anyOf": [{"type": "string"}, {"type": "number"}]}},
			"meta": {"type": "object", "additionalProperties": {"type": "boolean"}},
			"anything": {}
		}
	}`))

	want := `{
  anything?: unknown;
  either?: (string | number)[];
  kind?: "bug" | "feature";
  meta?: {
    [key: string]: boolean;
  };
  /** What it is called */
  name: string;
  owner: {
    id: number;
    "x-team"?: string;
  };
  tags?: string[];
}`
	if typed != want {
		t.Errorf("typed\n%s\nwant\n%s", typed, want)
	}
}

func TestTypesWhatSchemasLeaveOpen(t *testing.T) {
	for schema, want := range map[string]string{
		`{}`:                            "unknown",
		`{"type":"object"}`:             "Record<string, unknown>",
		`{"type":"array"}`:              "unknown[]",
		`{"type":["integer","null"]}`:   "number | null",
		`{"const":"open"}`:              `"open"`,
		`{"allOf":[{"type":"string"}]}`: "string",
		`{"type":"array","items":{"type":"array","items":{"enum":[1,2]}}}`: "(1 | 2)[][]",
		`{"properties":{"a":{"type":"string"}}}`:                           "{\n  a?: string;\n}",
	} {
		if got := typescript(json.RawMessage(schema)); got != want {
			t.Errorf("typescript(%s) = %q, want %q", schema, got, want)
		}
	}
}

func TestStopsTypingWhatNestsTooDeep(t *testing.T) {
	schema := `{"type":"string"}`
	for range 10 {
		schema = `{"type":"array","items":` + schema + `}`
	}

	if got := typescript(json.RawMessage(schema)); !strings.HasPrefix(got, "unknown[]") || strings.Contains(got, "string") {
		t.Errorf("typed %q, want it cut off as unknown", got)
	}
}

func TestEscapesWhatWouldCloseADocComment(t *testing.T) {
	typed := typescript(json.RawMessage(`{"type":"object","properties":{"a":{"type":"string","description":"ends */ here\nand on"}}}`))

	if !strings.Contains(typed, "/** ends *\\/ here and on */") {
		t.Errorf("typed %q", typed)
	}
}

func TestDescribesATool(t *testing.T) {
	described := describing(creating)

	for _, want := range []string{
		"linear.issue-create (from Linear)\nCreate an issue. Needs a person’s approval before it runs: It posts publicly under the team's name.",
		"Takes:\n{\n  /** What it is about */\n  title: string;\n  \"team-id\": string;\n  priority?: 0 | 1 | 2;\n  state?: \"open\" | \"closed\" | null;\n  labels?: string[];\n  estimate?: number | null;\n  draft: boolean;\n  intent?: string;\n}",
		"For example:\nspotlight linear issue-create --title \"…\" --team-id 'ENG' --draft --intent \"…\"",
	} {
		if !strings.Contains(described, want) {
			t.Errorf("described\n%s\nwant it to say\n%s", described, want)
		}
	}
	if strings.Count(described, "posts publicly") != 1 {
		t.Errorf("described the approval more than once:\n%s", described)
	}
}

func TestDescribesAToolThatTakesNothing(t *testing.T) {
	described := describing(tool("linear.teams", "Lists the teams."))

	if !strings.Contains(described, "Takes nothing.\n\nFor example:\nspotlight linear teams") {
		t.Errorf("described\n%s", described)
	}
}

func TestBracketsOnlyAUnionOrIntersectionInsideAnother(t *testing.T) {
	for schema, want := range map[string]string{
		`{"type":"array","items":{"const":"a|b"}}`:                                              `"a|b"[]`,
		`{"type":"array","items":{"enum":["a","b"]}}`:                                           `("a" | "b")[]`,
		`{"type":"array","items":{"allOf":[{"type":"object"},{"type":"object"}]}}`:              "(Record<string, unknown> & Record<string, unknown>)[]",
		`{"allOf":[{"enum":["a","b"]},{"type":"string"}]}`:                                      `("a" | "b") & string`,
		`{"type":"array","items":{"type":"object","properties":{"a":{"description":"x | y"}}}}`: "{\n  /** x | y */\n  a?: unknown;\n}[]",
		`{"const":"<b>&</b>"}`: `"<b>&</b>"`,
	} {
		if got := typescript(json.RawMessage(schema)); got != want {
			t.Errorf("typescript(%s) = %q, want %q", schema, got, want)
		}
	}
}

func TestWritesAnExampleCallAsJSONWhereAnInputIsNotScalar(t *testing.T) {
	call := exampleCall(protocol.ToolManifest{
		Name: "linear.issues",
		Inputs: []protocol.ToolInputManifest{
			{Name: "first", Schema: json.RawMessage(`{"type":"integer","default":50}`), Required: true},
			{Name: "filter", Schema: json.RawMessage(`{"type":"object","required":["state"],"properties":{"state":{"enum":["open"]},"team":{"type":"string"}}}`), Required: true},
			{Name: "after", Schema: json.RawMessage(`{"type":"string"}`)},
		},
	})

	if call != `spotlight linear issues --json '{"filter":{"state":"open"},"first":50}'` {
		t.Errorf("call = %s", call)
	}
}

func TestQuotesAnExampleForTheShell(t *testing.T) {
	call := exampleCall(protocol.ToolManifest{
		Name: "linear.comment",
		Inputs: []protocol.ToolInputManifest{
			{Name: "body", Schema: json.RawMessage(`{"type":"string","examples":["it's done"]}`), Required: true},
			{Name: "notify", Schema: json.RawMessage(`{"type":"boolean","default":false}`), Required: true},
		},
	})

	if call != `spotlight linear comment --body 'it'\''s done' --notify=false` {
		t.Errorf("call = %s", call)
	}
}

func TestDescribesARunsToolByEitherSpelling(t *testing.T) {
	for _, args := range [][]string{{"linear.search"}, {"linear", "search"}} {
		t.Run(strings.Join(args, " "), func(t *testing.T) {
			withTools(t, `{}`)
			out := new(bytes.Buffer)

			if err := run(append([]string{"tools", "describe"}, args...), strings.NewReader(""), out); err != nil {
				t.Fatalf("run: %v", err)
			}
			if !strings.Contains(out.String(), "linear.search\nSearch the team's Linear issues.") || !strings.Contains(out.String(), `--team_id "…"`) {
				t.Errorf("output %q", out.String())
			}
		})
	}
}

func TestNamesTheNearestToolsForOneTheRunWasNotGiven(t *testing.T) {
	withTools(t, `{}`)

	err := run([]string{"tools", "describe", "linear.comments"}, strings.NewReader(""), new(bytes.Buffer))
	if err == nil || !strings.Contains(err.Error(), `no tool "linear.comments"; the nearest are linear.comment`) {
		t.Fatalf("err = %v", err)
	}
}

func TestDescribesWhatAToolAnsweredBeforeAsLearned(t *testing.T) {
	learned := tool("linear.comment", "Comment on an issue.")
	learned.Output = json.RawMessage(`{"type":"object","properties":{"url":{"type":"string"},"labels":{"type":"object","additionalProperties":{"type":"number"}}},"required":["url"],"additionalProperties":false}`)

	described := describing(learned)
	want := "Answers with (learned from earlier calls, may be incomplete):\n{\n  labels?: {\n    [key: string]: number;\n  };\n  url: string;\n}\n\nFor example:"
	if !strings.Contains(described, want) {
		t.Errorf("described\n%s\nwant it to say\n%s", described, want)
	}

	if described := describing(tool("linear.teams", "Lists the teams.")); strings.Contains(described, "Answers with") {
		t.Errorf("described an output nobody knows:\n%s", described)
	}
}
