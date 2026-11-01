package protocol

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"reflect"
	"strings"
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

func TestAHostCallAndItsSecretsGoBetweenTheHostAndEgressIntact(t *testing.T) {
	config := EgressConfig{
		URL: "https://spotlight.test", Credential: "proxy",
		Send:        &HostCall{ID: "call_1", Method: "POST", URL: "https://slack.com/api/chat.postMessage", SecretsToken: "secrets-token"},
		SendSecrets: &CallSecrets{CallID: "call_1", Host: "host_1", Token: "secrets-token"},
	}

	written, err := json.Marshal(config)
	if err != nil {
		t.Fatal(err)
	}
	var fields struct {
		Send        map[string]any `json:"send"`
		SendSecrets map[string]any `json:"sendSecrets"`
	}
	if err := json.Unmarshal(written, &fields); err != nil {
		t.Fatal(err)
	}
	if fields.Send["secretsToken"] != "secrets-token" || fields.SendSecrets["callId"] != "call_1" ||
		fields.SendSecrets["host"] != "host_1" || fields.SendSecrets["token"] != "secrets-token" || len(fields.SendSecrets) != 3 {
		t.Errorf("wrote %s", written)
	}

	var read EgressConfig
	if err := json.Unmarshal(written, &read); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(read, config) {
		t.Errorf("read %+v", read)
	}

	if unsecret, _ := json.Marshal(HostCall{ID: "call_2"}); strings.Contains(string(unsecret), "secretsToken") {
		t.Errorf("a call with no secrets wrote %s", unsecret)
	}
	if unsecret, _ := json.Marshal(EgressConfig{URL: "https://spotlight.test"}); strings.Contains(string(unsecret), "sendSecrets") {
		t.Errorf("an egress with no call secrets wrote %s", unsecret)
	}

	redeem, _ := json.Marshal(HostCallSecretsRequest{Host: "host_1", Token: "secrets-token", Recipient: "key"})
	if string(redeem) != `{"host":"host_1","token":"secrets-token","recipient":"key"}` {
		t.Errorf("redeems with %s", redeem)
	}
}

func TestCallSecretsLogNoToken(t *testing.T) {
	var logged bytes.Buffer
	slog.New(slog.NewTextHandler(&logged, nil)).Info("redeem", "secrets", CallSecrets{CallID: "call_1", Host: "host_1", Token: "secrets-token"})

	if strings.Contains(logged.String(), "secrets-token") || !strings.Contains(logged.String(), "call_1") {
		t.Errorf("logged %s", logged.String())
	}
}
