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
