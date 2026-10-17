package session

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

type spanRead struct {
	SpanID     string `json:"spanId"`
	Name       string `json:"name"`
	Start      string `json:"startTimeUnixNano"`
	End        string `json:"endTimeUnixNano"`
	Attributes []struct {
		Key   string `json:"key"`
		Value struct {
			StringValue string `json:"stringValue"`
			IntValue    string `json:"intValue"`
		} `json:"value"`
	} `json:"attributes"`
	Status *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"status"`
}

func readSpan(t *testing.T, raw json.RawMessage) (spanRead, map[string]string) {
	t.Helper()

	var span spanRead
	if err := json.Unmarshal(raw, &span); err != nil {
		t.Fatal(err)
	}

	attributes := map[string]string{}
	for _, each := range span.Attributes {
		attributes[each.Key] = each.Value.StringValue + each.Value.IntValue
	}

	return span, attributes
}

func TestARecallIsASpanSayingWhatWasAskedAndHowManyCameBack(t *testing.T) {
	from := time.Date(2026, 9, 27, 10, 0, 0, 0, time.UTC)

	span, attributes := readSpan(t, recalled(
		protocol.RecallRequest{Words: "upload retries"},
		from, from.Add(40*time.Millisecond),
		json.RawMessage(`[{"handle":"M-1"},{"handle":"M-2"}]`), nil,
	))

	if span.Name != "spotlight.recall" || len(span.SpanID) != 16 || span.Status != nil {
		t.Fatalf("span %+v", span)
	}
	if span.Start != "1790503200000000000" || span.End != "1790503200040000000" {
		t.Errorf("timed %s to %s", span.Start, span.End)
	}
	if attributes["spotlight.recall.words"] != "upload retries" || attributes["spotlight.recall.found"] != "2" {
		t.Errorf("attributes %v", attributes)
	}
}

func TestARecallByHandleThatFailedSaysSo(t *testing.T) {
	now := time.Now()

	span, attributes := readSpan(t, recalled(
		protocol.RecallRequest{Handle: "M-12"}, now, now, nil, errors.New("no such memory"),
	))

	if attributes["spotlight.recall.handle"] != "M-12" || span.Status == nil || span.Status.Code != 2 {
		t.Errorf("span %+v, attributes %v", span, attributes)
	}
	if _, counted := attributes["spotlight.recall.found"]; counted {
		t.Error("a failed recall found nothing to count")
	}
}
