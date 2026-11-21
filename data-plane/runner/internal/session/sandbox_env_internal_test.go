package session

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/egresskit/inject"
	"usespotlight.ai/data-plane/protocol"
)

func TestRedactingJSONTouchesOnlyItsStrings(t *testing.T) {
	redactor := inject.NewRedactor(map[string]string{"TINY": "1"})

	got := redactedJSON(redactor, []byte(`{"seq":1,"ids":[1,12345678901234567890],"text":"a1b","1":"x","frame":"{\"key\":\"1\"}"}`))

	var decoded map[string]any
	if err := json.Unmarshal(got, &decoded); err != nil {
		t.Fatalf("no longer JSON: %s: %v", got, err)
	}
	for _, want := range []string{`"seq":1`, `12345678901234567890`, `"text":"aspotlight-egress:TINYb"`, `"spotlight-egress:TINY":"x"`, `{\"key\":\"spotlight-egress:TINY\"}`} {
		if !strings.Contains(string(got), want) {
			t.Errorf("%s does not hold %s", got, want)
		}
	}
}

func TestRedactingLeavesDataWithoutASecretAsItWas(t *testing.T) {
	redactor := inject.NewRedactor(map[string]string{"KEY": "secret-value"})
	data := []byte(`{ "b": 1,  "a": "kept as written" }`)

	if got := redactedJSON(redactor, data); string(got) != string(data) {
		t.Errorf("rewrote %s as %s", data, got)
	}
	if got := redactedJSON(redactor, []byte("plain secret-value")); string(got) != "plain spotlight-egress:KEY" {
		t.Errorf("redacted text as %s", got)
	}
}

func TestWhatGoesToSpotlightBesideTheJournalIsRedacted(t *testing.T) {
	redactor := inject.NewRedactor(map[string]string{"KEY": "secret-value"})
	sent := &sentToSpotlight{}
	journal := redactingJournal{Journal: sent, redactor: redactor}

	_ = journal.Complete(t.Context(), "run_1", protocol.Completion{
		Message:  "failed with secret-value",
		Handover: &protocol.Handover{Next: "secret-value", Note: "secret-value", Suggest: "secret-value"},
	})
	_, _ = journal.AskPermission(t.Context(), "run_1", protocol.PermissionRequest{Title: "curl secret-value", Input: json.RawMessage(`{"command":"curl secret-value"}`)})
	_, _ = journal.Remember(t.Context(), "run_1", protocol.RememberRequest{Body: "the key is secret-value"})
	_ = journal.ReplyToReviewComment(t.Context(), "run_1", protocol.ReviewCommentReply{Body: "used secret-value"})
	_, _ = journal.RecallMemories(t.Context(), "run_1", "where secret-value is")
	_, _ = journal.RecallMemory(t.Context(), "run_1", "secret-value")
	_, _ = journal.Trace(t.Context(), "run_1", "secret-value")
	_, _ = journal.History(t.Context(), "run_1", protocol.HistoryRequest{
		Station: "secret-value", Line: "secret-value", Fingerprint: "secret-value", Outcome: "secret-value", Since: "secret-value",
	})
	_, _ = journal.UseTool(t.Context(), "run_1", "pull-request", json.RawMessage(`{"body":"secret-value"}`))
	_ = journal.GenerateChangeStack(t.Context(), "run_1", "web", "+KEY=secret-value", "main")
	_, _ = journal.ProposeCandidate(t.Context(), "run_1", protocol.CandidateProposal{
		Name: "secret-value", Hypothesis: "secret-value", Station: json.RawMessage(`{"briefing":"secret-value"}`),
	})
	_, _ = journal.RecordCause(t.Context(), "run_1", protocol.CauseRecord{Cause: "secret-value", Evidence: "secret-value", Suggestion: "secret-value"})

	encoded, _ := json.Marshal(sent)
	if strings.Contains(string(encoded), "secret-value") || strings.Count(string(encoded), "spotlight-egress:KEY") != 24 {
		t.Errorf("sent %s", encoded)
	}
}

type sentToSpotlight struct {
	Journal
	Completed  protocol.Completion
	Asked      protocol.PermissionRequest
	Remembered protocol.RememberRequest
	Replied    protocol.ReviewCommentReply
	Recalled   string
	Memory     string
	Traced     string
	Read       protocol.HistoryRequest
	ToolInput  string
	Diff       string
	Proposed   protocol.CandidateProposal
	Caused     protocol.CauseRecord
}

func (s *sentToSpotlight) RecallMemory(_ context.Context, _, handle string) (json.RawMessage, error) {
	s.Memory = handle
	return nil, nil
}

func (s *sentToSpotlight) Trace(_ context.Context, _, taskID string) (json.RawMessage, error) {
	s.Traced = taskID
	return nil, nil
}

func (s *sentToSpotlight) History(_ context.Context, _ string, request protocol.HistoryRequest) (json.RawMessage, error) {
	s.Read = request
	return nil, nil
}

func (s *sentToSpotlight) RecallMemories(_ context.Context, _, words string) (json.RawMessage, error) {
	s.Recalled = words
	return nil, nil
}

func (s *sentToSpotlight) UseTool(_ context.Context, _, _ string, input json.RawMessage) (json.RawMessage, error) {
	s.ToolInput = string(input)
	return nil, nil
}

func (s *sentToSpotlight) GenerateChangeStack(_ context.Context, _, _, diff, _ string) error {
	s.Diff = diff
	return nil
}

func (s *sentToSpotlight) ProposeCandidate(_ context.Context, _ string, proposal protocol.CandidateProposal) (json.RawMessage, error) {
	s.Proposed = proposal
	return nil, nil
}

func (s *sentToSpotlight) RecordCause(_ context.Context, _ string, record protocol.CauseRecord) (json.RawMessage, error) {
	s.Caused = record
	return nil, nil
}

func (s *sentToSpotlight) Complete(_ context.Context, _ string, done protocol.Completion) error {
	s.Completed = done
	return nil
}

func (s *sentToSpotlight) AskPermission(_ context.Context, _ string, asked protocol.PermissionRequest) (protocol.PermissionResponse, error) {
	s.Asked = asked
	return protocol.PermissionResponse{}, nil
}

func (s *sentToSpotlight) Remember(_ context.Context, _ string, remembered protocol.RememberRequest) (json.RawMessage, error) {
	s.Remembered = remembered
	return nil, nil
}

func (s *sentToSpotlight) ReplyToReviewComment(_ context.Context, _ string, reply protocol.ReviewCommentReply) error {
	s.Replied = reply
	return nil
}
