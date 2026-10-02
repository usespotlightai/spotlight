package protocol

import (
	"encoding/json"
	"regexp"
	"strings"
)

var candidateName = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)

func IsCandidateName(name string) bool {
	return candidateName.MatchString(name)
}

func OneSegment(name string) bool {
	return name != "" && name != "." && name != ".." &&
		!strings.ContainsAny(name, `/\`) && name == strings.TrimSpace(name)
}

type SearchSpec struct{}

type CandidateProposal struct {
	Name       string          `json:"name"`
	Hypothesis string          `json:"hypothesis"`
	Station    json.RawMessage `json:"station"`
}

type ProposedCandidate struct {
	CandidateID string `json:"candidateId"`
	Name        string `json:"name"`
	ReplayID    string `json:"replayId"`
}
