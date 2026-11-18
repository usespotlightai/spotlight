package session

import (
	"context"
	"crypto/rand"
	"encoding/json"

	"usespotlight.ai/data-plane/protocol"
)

type step struct {
	journal *journalWriter
	name    string
	id      string
}

func (j *journalWriter) begin(ctx context.Context, name string) step {
	started := step{journal: j, name: name, id: rand.Text()}
	j.record(ctx, stepEvent(protocol.EventStepStarted, name, protocol.StepStart{ID: started.id}))
	return started
}

func (s step) end(ctx context.Context, failed bool, output string) {
	s.journal.record(ctx, stepEvent(protocol.EventStepEnded, s.name, protocol.StepEnd{
		ID:     s.id,
		Failed: failed,
		Output: output,
	}))
}

func (j *journalWriter) note(name string, failed bool, output string) {
	j.append(stepEvent(protocol.EventStepEnded, name, protocol.StepEnd{Failed: failed, Output: output}))
}

func stepEvent(kind protocol.EventType, name string, data any) protocol.Event {
	encoded, _ := json.Marshal(data)
	return protocol.Event{Type: kind, Message: name, Data: encoded}
}
