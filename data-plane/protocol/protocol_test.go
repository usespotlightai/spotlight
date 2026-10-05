package protocol

import (
	"encoding/json"
	"testing"
)

func TestReadsAnInputsKindFromItsSchema(t *testing.T) {
	for schema, want := range map[string]struct {
		kind   string
		scalar bool
	}{
		`{"type":"string"}`:             {"string", true},
		`{"type":["null","integer"]}`:   {"integer", true},
		`{"type":"object"}`:             {"object", false},
		`{"type":["null"]}`:             {"", false},
		`{"enum":["open","closed"]}`:    {"string", true},
		`{"enum":[1,2.5]}`:              {"number", true},
		`{"enum":[true,false]}`:         {"boolean", true},
		`{"enum":["open",1]}`:           {"", false},
		`{"enum":["open",null]}`:        {"", false},
		`{"const":"open"}`:              {"string", true},
		`{"const":{"state":"open"}}`:    {"", false},
		`{"anyOf":[{"type":"string"}]}`: {"", false},
		`{"type":"string","enum":[1]}`:  {"string", true},
		`not a schema`:                  {"", false},
	} {
		input := ToolInputManifest{Name: "state", Schema: json.RawMessage(schema)}
		if kind, scalar := input.Kind(), input.Scalar(); kind != want.kind || scalar != want.scalar {
			t.Errorf("%s: kind %q scalar %v, want %q %v", schema, kind, scalar, want.kind, want.scalar)
		}
	}
}

func TestReadsWhyAToolWaitsForAPersonAndWhereItComesFrom(t *testing.T) {
	var tools []ToolManifest
	written := `[{"name":"linear.issue-create","description":"Create an issue.","approval":{"because":"It is public."},"integration":"Linear"},{"name":"pull-request","description":"Open one.","approval":null}]`
	if err := json.Unmarshal([]byte(written), &tools); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if tools[0].Approval == nil || tools[0].Approval.Because != "It is public." || tools[0].Integration != "Linear" {
		t.Errorf("read %+v", tools[0])
	}
	if tools[1].Approval != nil || tools[1].Integration != "" {
		t.Errorf("read %+v", tools[1])
	}
}
