package protocol

import (
	"encoding/json"
	"slices"
)

// AssistFolder holds the evidence an assist session reads, relative to the workspace.
const AssistFolder = ".spotlight/assist"

type AssistSpec struct {
	// Purpose names what the session is for, as the control plane ordered it, e.g. insights.judge.
	Purpose string            `json:"purpose"`
	Files   map[string]string `json:"files"`
}

type AssistSubmission struct {
	Result json.RawMessage `json:"result"`
}

type AssistAnswer struct {
	Accepted bool `json:"accepted"`
}

// DecisionKinds are the kinds ProposedDecision.kind allows in the control plane's change review.
var DecisionKinds = []string{"trade-off", "assumption", "limitation", "rejected-approach", "deviation"}

func IsDecisionKind(kind string) bool {
	return slices.Contains(DecisionKinds, kind)
}

const (
	MaxDecisionTitle        = 120
	MaxDecisionWhy          = 2_000
	MaxDecisionAlternatives = 5
	MaxDecisionAlternative  = 300
	MaxDecisionPaths        = 20
)

type ProposedDecision struct {
	Kind         string   `json:"kind"`
	Title        string   `json:"title"`
	Why          string   `json:"why"`
	Alternatives []string `json:"alternatives"`
	Paths        []string `json:"paths"`
}

type DecisionProposals struct {
	Decisions []ProposedDecision `json:"decisions"`
}
