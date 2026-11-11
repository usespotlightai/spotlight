package session

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

type historyFake struct {
	history   string
	view      string
	viewErr   error
	viewsRead int
}

func (f *historyFake) History(context.Context, string, protocol.HistoryRequest) (json.RawMessage, error) {
	return json.RawMessage(f.history), nil
}

func (f *historyFake) SearchView(context.Context, string) (json.RawMessage, error) {
	f.viewsRead++
	return json.RawMessage(f.view), f.viewErr
}

func searchRun() protocol.Run {
	return protocol.Run{ID: "run_1", Spec: protocol.Spec{Search: &protocol.SearchSpec{}}}
}

func TestHistoryOfARunThatSearchesNothingIsTheHistoryAsRead(t *testing.T) {
	read := `{"line":{"key":"delivery","name":"Delivery"},"runs":[]}`
	from := &historyFake{history: read}

	got, err := history(context.Background(), from, protocol.Run{ID: "run_1"}, protocol.HistoryRequest{Station: "review"})
	if err != nil {
		t.Fatalf("history: %v", err)
	}

	if string(got) != read {
		t.Errorf("history %s, want %s", got, read)
	}
	if from.viewsRead != 0 {
		t.Errorf("read the search view %d times, want never", from.viewsRead)
	}
}

func TestHistoryOfASearchRunCarriesTheCandidatesAndSeedBlockOfItsSearchView(t *testing.T) {
	from := &historyFake{
		history: `{"line":{"key":"delivery","name":"Delivery"},"station":{"key":"review","name":"Review"},"configs":[],"runs":[{"runId":"run_0"}]}`,
		view:    `{"candidates":[{"candidateName":"terse","fingerprint":"f1","hypothesis":"shorter prompts","block":{"prompt":"Be brief"},"runs":[]}],"seedBlock":{"prompt":"Review it"}}`,
	}

	got, err := history(context.Background(), from, searchRun(), protocol.HistoryRequest{Station: "review"})
	if err != nil {
		t.Fatalf("history: %v", err)
	}

	var merged protocol.History
	if err := json.Unmarshal(got, &merged); err != nil {
		t.Fatalf("read the merged history: %v", err)
	}
	if merged.Station.Key != "review" || len(merged.Runs) != 1 || merged.Runs[0].RunID != "run_0" {
		t.Errorf("history %s lost what the history said", got)
	}
	if len(merged.Candidates) != 1 || merged.Candidates[0].CandidateName != "terse" ||
		string(merged.Candidates[0].Block) != `{"prompt":"Be brief"}` {
		t.Errorf("candidates %+v", merged.Candidates)
	}
	if string(merged.SeedBlock) != `{"prompt":"Review it"}` {
		t.Errorf("seed block %s", merged.SeedBlock)
	}
}

func TestHistoryOfASearchRunWithoutASeedBlockSaysSo(t *testing.T) {
	from := &historyFake{history: `{"runs":[]}`, view: `{"candidates":[],"seedBlock":null}`}

	got, err := history(context.Background(), from, searchRun(), protocol.HistoryRequest{Station: "review"})
	if err != nil {
		t.Fatalf("history: %v", err)
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(got, &fields); err != nil {
		t.Fatalf("read the merged history: %v", err)
	}
	if string(fields["candidates"]) != "[]" || string(fields["seedBlock"]) != "null" {
		t.Errorf("history %s, want empty candidates and a null seed block", got)
	}
}

func TestHistoryOfASearchRunFailsWhenItsSearchViewCannotBeRead(t *testing.T) {
	refused := errors.New("read the search view: 404")
	from := &historyFake{history: `{"runs":[]}`, viewErr: refused}

	if _, err := history(context.Background(), from, searchRun(), protocol.HistoryRequest{Station: "review"}); !errors.Is(err, refused) {
		t.Errorf("err = %v, want %v", err, refused)
	}
}

func TestHistoryOfASearchRunAddsTheConfigsOfItsSearchViewThatTheHistoryLacks(t *testing.T) {
	from := &historyFake{
		history: `{"configs":[{"fingerprint":"f0","config":{"harness":"claude-code"}}],"runs":[]}`,
		view: `{"configs":[{"fingerprint":"f0","config":{"harness":"other"}},{"fingerprint":"f1","config":{"harness":"codex"}}],` +
			`"candidates":[],"seedBlock":null}`,
	}

	got, err := history(context.Background(), from, searchRun(), protocol.HistoryRequest{Station: "review"})
	if err != nil {
		t.Fatalf("history: %v", err)
	}

	var merged protocol.History
	if err := json.Unmarshal(got, &merged); err != nil {
		t.Fatalf("read the merged history: %v", err)
	}
	if len(merged.Configs) != 2 ||
		merged.Configs[0].Fingerprint != "f0" || merged.Configs[0].Config.Harness != "claude-code" ||
		merged.Configs[1].Fingerprint != "f1" || merged.Configs[1].Config.Harness != "codex" {
		t.Errorf("configs %+v", merged.Configs)
	}
}
