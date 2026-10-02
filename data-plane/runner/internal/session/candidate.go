package session

import (
	"encoding/json"
	"strconv"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const proposedSpanName = "spotlight.candidate"

func proposedSpan(proposal protocol.CandidateProposal, from, to time.Time, answer json.RawMessage, err error) json.RawMessage {
	span := recallSpan{
		TraceID: randomHex(16),
		SpanID:  randomHex(8),
		Name:    proposedSpanName,
		Start:   strconv.FormatInt(from.UnixNano(), 10),
		End:     strconv.FormatInt(to.UnixNano(), 10),
		Attributes: []spanAttribute{
			{Key: "spotlight.candidate.name", Value: spanValue{StringValue: proposal.Name}},
		},
	}

	var proposed protocol.ProposedCandidate
	switch {
	case err != nil:
		span.Status = &spanStatus{Code: spanFailed, Message: err.Error()}
	case json.Unmarshal(answer, &proposed) == nil:
		span.Attributes = append(span.Attributes,
			spanAttribute{Key: "spotlight.candidate.id", Value: spanValue{StringValue: proposed.CandidateID}},
			spanAttribute{Key: "spotlight.candidate.replay", Value: spanValue{StringValue: proposed.ReplayID}},
		)
	}

	written, _ := json.Marshal(span)
	return written
}
