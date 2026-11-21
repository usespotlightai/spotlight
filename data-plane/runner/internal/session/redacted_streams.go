package session

import (
	"bytes"
	"encoding/json"
	"slices"

	"usespotlight.ai/data-plane/egresskit/inject"
	"usespotlight.ai/data-plane/protocol"
)

type streamKey struct {
	kind    protocol.EventType
	session string
	id      string
}

type heldTail struct {
	fields map[string]any
	text   string
}

type streamRedaction struct {
	redactor *inject.Redactor
	held     map[streamKey]heldTail
	order    []streamKey
}

func redactingStreams(redactor *inject.Redactor) *streamRedaction {
	return &streamRedaction{redactor: redactor, held: map[streamKey]heldTail{}}
}

type streamed struct {
	key      streamKey
	fields   map[string]any
	chunk    bool
	replaces bool
}

func streamOf(event protocol.Event) (streamed, bool) {
	if event.Type != protocol.EventMessage && event.Type != protocol.EventToolOutput && event.Type != protocol.EventToolChanged {
		return streamed{}, false
	}

	decoder := json.NewDecoder(bytes.NewReader(event.Data))
	decoder.UseNumber()
	var fields map[string]any
	if decoder.Decode(&fields) != nil || fields == nil {
		return streamed{}, false
	}

	session, _ := fields["session"].(string)
	id, _ := fields["id"].(string)
	_, text := fields["text"].(string)
	replaces, _ := fields["replace"].(bool)

	return streamed{
		key:      streamKey{kind: event.Type, session: session, id: id},
		fields:   fields,
		chunk:    event.Type != protocol.EventToolChanged && text && !replaces,
		replaces: replaces,
	}, true
}

func (s *streamRedaction) events(event protocol.Event) []protocol.Event {
	if s == nil {
		return []protocol.Event{event}
	}

	if event.Type == protocol.EventHarnessFrame {
		return nil
	}

	stream, harness := streamOf(event)
	var out []protocol.Event
	for _, key := range slices.Clone(s.order) {
		if endsTurn(event) || (harness && key != stream.key && ends(key, stream)) {
			out = append(out, s.release(key))
		}
	}

	if !harness || !stream.chunk {
		if harness && stream.replaces {
			s.drop(stream.key)
		}
		return append(out, redactedEvent(s.redactor, event))
	}

	text, _ := stream.fields["text"].(string)
	redacted, held := s.redactor.Partial(s.held[stream.key].text + text)
	s.drop(stream.key)
	if held != "" {
		s.held[stream.key] = heldTail{fields: stream.fields, text: held}
		s.order = append(s.order, stream.key)
	}
	if redacted == "" {
		return out
	}

	event.Message = s.redactor.Text(event.Message)
	event.Data = s.encoded(stream.fields, redacted)
	return append(out, event)
}

func endsTurn(event protocol.Event) bool {
	return event.Type == protocol.EventTurnEnded || event.Type == protocol.EventAgentStopped
}

func ends(held streamKey, next streamed) bool {
	return held.kind == protocol.EventToolOutput && next.key.kind == protocol.EventToolChanged && next.key.session == held.session && next.key.id == held.id &&
		(next.fields["status"] == string(protocol.ToolCompleted) || next.fields["status"] == string(protocol.ToolFailed))
}

func (s *streamRedaction) rest() []protocol.Event {
	if s == nil {
		return nil
	}

	var out []protocol.Event
	for _, key := range slices.Clone(s.order) {
		out = append(out, s.release(key))
	}
	return out
}

func (s *streamRedaction) release(key streamKey) protocol.Event {
	tail := s.held[key]
	s.drop(key)
	return protocol.Event{Type: key.kind, Data: s.encoded(tail.fields, s.redactor.Text(tail.text))}
}

func (s *streamRedaction) drop(key streamKey) {
	delete(s.held, key)
	s.order = slices.DeleteFunc(s.order, func(each streamKey) bool { return each == key })
}

func (s *streamRedaction) encoded(fields map[string]any, text string) json.RawMessage {
	others := make(map[string]any, len(fields))
	for name, value := range fields {
		if name != "text" {
			others[name] = value
		}
	}
	redacted, _ := redactedValue(s.redactor, others).(map[string]any)
	redacted["text"] = text

	var written bytes.Buffer
	encoder := json.NewEncoder(&written)
	encoder.SetEscapeHTML(false)
	_ = encoder.Encode(redacted)
	return bytes.TrimSuffix(written.Bytes(), []byte("\n"))
}

func (s *streamRedaction) redactorOrNil() *inject.Redactor {
	if s == nil {
		return nil
	}
	return s.redactor
}
