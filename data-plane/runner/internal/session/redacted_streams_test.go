package session

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/egresskit/inject"
	"usespotlight.ai/data-plane/protocol"
)

const streamedKey = "-----BEGIN PRIVATE KEY-----MIIEvQIBADAN"

func streamingJournal() (*journalWriter, *flaky) {
	control := &flaky{}
	journal := &journalWriter{runID: "run", journal: control}
	journal.redactWith(inject.RedactorOf(map[string]string{"DEV_GITHUB_APP_KEY": streamedKey}))
	return journal, control
}

func TestNoRawHarnessFrameIsSentWhileTheRunHoldsSecrets(t *testing.T) {
	frame := protocol.HarnessEvent(protocol.EventHarnessFrame, protocol.HarnessFrame{})
	journal, control := streamingJournal()

	journal.append(frame)
	journal.append(said("m1", "done"))
	journal.drain(t.Context())

	for _, batch := range control.sent {
		for _, event := range batch {
			if event.Type == protocol.EventHarnessFrame {
				t.Errorf("sent %s", event.Data)
			}
		}
	}
	if got := (*streamRedaction)(nil).events(frame); len(got) != 1 {
		t.Errorf("without secrets sent %d events", len(got))
	}
}

func said(id, text string) protocol.Event {
	return protocol.HarnessEvent(protocol.EventMessage, protocol.AgentMessage{ID: id, Role: protocol.MessageFromAgent, Text: text})
}

func toolSaid(id, text string) protocol.Event {
	return protocol.HarnessEvent(protocol.EventToolOutput, protocol.ToolOutput{ID: id, Text: text})
}

func textsSent(t *testing.T, control *flaky) (string, []string) {
	t.Helper()
	var all strings.Builder
	var texts []string
	for _, batch := range control.sent {
		for _, event := range batch {
			all.Write(event.Data)
			all.WriteString(event.Message)
			var fields struct {
				Text string `json:"text"`
			}
			if json.Unmarshal(event.Data, &fields) == nil && fields.Text != "" {
				texts = append(texts, fields.Text)
			}
		}
	}
	return all.String(), texts
}

func TestAValueSplitAcrossMessageChunksReachesSpotlightOnlyAsItsStandIn(t *testing.T) {
	journal, control := streamingJournal()

	for at := 0; at < len(streamedKey); at += 5 {
		journal.record(context.Background(), said("m1", streamedKey[at:min(at+5, len(streamedKey))]))
	}
	journal.record(context.Background(), said("m1", " is the key"))
	journal.drain(context.Background())

	sent, texts := textsSent(t, control)
	if strings.Contains(sent, "MIIE") || strings.Contains(sent, "BEGIN") {
		t.Fatalf("a part of the value reached Spotlight: %s", sent)
	}
	if got := strings.Join(texts, ""); got != protocol.StandInPrefix+"DEV_GITHUB_APP_KEY is the key" {
		t.Errorf("the message reads %q", got)
	}
}

func TestTextHeldBackAtTheEndOfAMessageGoesOutWhenTheMessageEnds(t *testing.T) {
	journal, control := streamingJournal()

	journal.record(context.Background(), said("m1", "it starts with -----BEGIN"))
	journal.record(context.Background(), protocol.Event{Type: protocol.EventAgentStopped})
	journal.drain(context.Background())

	_, texts := textsSent(t, control)
	if got := strings.Join(texts, ""); got != "it starts with -----BEGIN" {
		t.Errorf("the message reads %q", got)
	}
	if last := control.sent[len(control.sent)-1]; last[len(last)-1].Type != protocol.EventAgentStopped {
		t.Errorf("the held text went out after the stop: %+v", last)
	}
}

func TestToolOutputChunksOfTwoToolsAreRedactedApart(t *testing.T) {
	journal, control := streamingJournal()

	half := len(streamedKey) / 2
	journal.record(context.Background(), toolSaid("t1", "one "+streamedKey[:half]))
	journal.record(context.Background(), toolSaid("t2", "two"))
	journal.record(context.Background(), toolSaid("t1", streamedKey[half:]+" end"))
	journal.record(context.Background(), protocol.HarnessEvent(protocol.EventToolChanged, protocol.ToolChanged{ID: "t1", Status: protocol.ToolCompleted}))
	journal.drain(context.Background())

	sent, texts := textsSent(t, control)
	if strings.Contains(sent, "MIIE") {
		t.Fatalf("a part of the value reached Spotlight: %s", sent)
	}
	if got := strings.Join(texts, "|"); got != "one |two|"+protocol.StandInPrefix+"DEV_GITHUB_APP_KEY end" {
		t.Errorf("the tool output reads %q", got)
	}
}

func TestAValueSplitAroundOtherEventsReachesSpotlightOnlyAsItsStandIn(t *testing.T) {
	half := len(streamedKey) / 2
	for name, between := range map[string]protocol.Event{
		"a span":           {Type: protocol.EventStepStarted},
		"tool output":      toolSaid("t1", "listing files"),
		"a tool that runs": protocol.HarnessEvent(protocol.EventToolChanged, protocol.ToolChanged{ID: "t1", Status: protocol.ToolRunning}),
	} {
		journal, control := streamingJournal()

		journal.record(context.Background(), said("m1", "key "+streamedKey[:half]))
		journal.record(context.Background(), between)
		journal.record(context.Background(), said("m1", streamedKey[half:]))
		journal.drain(context.Background())

		if sent, _ := textsSent(t, control); strings.Contains(sent, "MIIE") || strings.Contains(sent, "BEGIN") {
			t.Errorf("with %s between the chunks, a part of the value reached Spotlight: %s", name, sent)
		}
	}
}

func TestAValueSplitAroundAThoughtReachesSpotlightOnlyAsItsStandIn(t *testing.T) {
	journal, control := streamingJournal()
	half := len(streamedKey) / 2

	journal.record(context.Background(), said("m1", "key "+streamedKey[:half]))
	journal.record(context.Background(), protocol.HarnessEvent(protocol.EventMessage, protocol.AgentMessage{
		ID: "t1", Role: protocol.MessageThought, Text: "thinking",
	}))
	journal.record(context.Background(), said("m1", streamedKey[half:]))
	journal.drain(context.Background())

	sent, texts := textsSent(t, control)
	if strings.Contains(sent, "MIIE") || strings.Contains(sent, "BEGIN") {
		t.Fatalf("a part of the value reached Spotlight: %s", sent)
	}
	if got := strings.Join(texts, "|"); got != "key |thinking|"+protocol.StandInPrefix+"DEV_GITHUB_APP_KEY" {
		t.Errorf("the messages read %q", got)
	}
}
