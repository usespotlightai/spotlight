package session

import (
	"context"
	"errors"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

type flaky struct {
	Journal
	failing int
	sent    [][]protocol.Event
}

func (f *flaky) AppendEvents(_ context.Context, _ string, events []protocol.Event) error {
	if f.failing > 0 {
		f.failing--
		return errors.New("the control plane did not answer")
	}
	f.sent = append(f.sent, events)
	return nil
}

func TestEventsThatCouldNotBeSentGoWithTheNextOnes(t *testing.T) {
	control := &flaky{failing: 1}
	journal := &journalWriter{runID: "run", journal: control}

	journal.record(context.Background(), protocol.Event{Type: protocol.EventHarnessConnected})
	journal.record(context.Background(), protocol.Event{Type: protocol.EventTurnStarted})

	if len(control.sent) != 1 || len(control.sent[0]) != 2 || control.sent[0][0].Type != protocol.EventHarnessConnected {
		t.Fatalf("sent %+v", control.sent)
	}
}

func TestEventsThatNeverGoThroughAreLetGo(t *testing.T) {
	control := &flaky{failing: flushTries}
	journal := &journalWriter{runID: "run", journal: control}

	for range flushTries {
		journal.record(context.Background(), protocol.Event{Type: protocol.EventMessage})
	}
	journal.record(context.Background(), protocol.Event{Type: protocol.EventTurnEnded})

	if len(control.sent) != 1 || len(control.sent[0]) != 1 || control.sent[0][0].Type != protocol.EventTurnEnded {
		t.Fatalf("sent %+v", control.sent)
	}
}

func TestTheLastEventsAreTriedAgainBeforeTheRunEnds(t *testing.T) {
	control := &flaky{failing: 2}
	journal := &journalWriter{runID: "run", journal: control}

	journal.append(protocol.Event{Type: protocol.EventTurnEnded})
	journal.drain(context.Background())

	if len(control.sent) != 1 || control.sent[0][0].Type != protocol.EventTurnEnded {
		t.Fatalf("sent %+v", control.sent)
	}
}
