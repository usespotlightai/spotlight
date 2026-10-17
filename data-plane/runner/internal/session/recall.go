package session

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const recallSpanName = "spotlight.recall"

const spanFailed = 2

type spanValue struct {
	StringValue string `json:"stringValue,omitempty"`
	IntValue    string `json:"intValue,omitempty"`
}

type spanAttribute struct {
	Key   string    `json:"key"`
	Value spanValue `json:"value"`
}

type spanStatus struct {
	Code    int    `json:"code"`
	Message string `json:"message,omitempty"`
}

type recallSpan struct {
	TraceID    string          `json:"traceId"`
	SpanID     string          `json:"spanId"`
	Name       string          `json:"name"`
	Start      string          `json:"startTimeUnixNano"`
	End        string          `json:"endTimeUnixNano"`
	Attributes []spanAttribute `json:"attributes"`
	Status     *spanStatus     `json:"status,omitempty"`
}

func recalled(request protocol.RecallRequest, from, to time.Time, answer json.RawMessage, err error) json.RawMessage {
	span := recallSpan{
		TraceID: randomHex(16),
		SpanID:  randomHex(8),
		Name:    recallSpanName,
		Start:   strconv.FormatInt(from.UnixNano(), 10),
		End:     strconv.FormatInt(to.UnixNano(), 10),
	}

	if request.Handle != "" {
		span.Attributes = append(span.Attributes, spanAttribute{Key: "spotlight.recall.handle", Value: spanValue{StringValue: request.Handle}})
	} else {
		span.Attributes = append(span.Attributes, spanAttribute{Key: "spotlight.recall.words", Value: spanValue{StringValue: request.Words}})
	}

	if err != nil {
		span.Status = &spanStatus{Code: spanFailed, Message: err.Error()}
	} else {
		span.Attributes = append(span.Attributes, spanAttribute{
			Key: "spotlight.recall.found", Value: spanValue{IntValue: strconv.Itoa(found(answer))},
		})
	}

	written, _ := json.Marshal(span)
	return written
}

func found(answer json.RawMessage) int {
	var many []json.RawMessage
	if json.Unmarshal(answer, &many) == nil {
		return len(many)
	}

	return 1
}

func randomHex(size int) string {
	raw := make([]byte, size)
	_, _ = rand.Read(raw)
	return hex.EncodeToString(raw)
}
