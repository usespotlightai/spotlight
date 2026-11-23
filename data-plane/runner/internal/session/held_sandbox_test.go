package session_test

import (
	"context"
	"encoding/json"
	"errors"

	"usespotlight.ai/data-plane/protocol"
)

type heldSandbox struct {
	journal  *journal
	archives *archives
	refuse   bool
	sent     []protocol.Event
	attempts []int
	onGrant  func()
}

func (s *heldSandbox) called(name string) {
	s.journal.mu.Lock()
	defer s.journal.mu.Unlock()
	s.journal.calls = append(s.journal.calls, name)
}

func (s *heldSandbox) HoldArchiveLease(_ context.Context, _ string, attempt int) error {
	s.called("hold")
	s.journal.mu.Lock()
	s.attempts = append(s.attempts, attempt)
	s.journal.mu.Unlock()
	if s.refuse {
		return errors.New("404 Not Found: a run the sandbox does not hold")
	}
	return nil
}

func (s *heldSandbox) ReleaseArchiveLease(context.Context, string, int) error {
	s.called("release")
	return nil
}

func (s *heldSandbox) AppendEvents(_ context.Context, _ string, events []protocol.Event) error {
	s.journal.mu.Lock()
	defer s.journal.mu.Unlock()
	s.sent = append(s.sent, events...)
	s.journal.events = append(s.journal.events, events...)
	return nil
}

func (s *heldSandbox) GrantArchive(_ context.Context, request protocol.ArchiveRequest) (protocol.ArchiveGrant, error) {
	s.called("sandbox archive")
	if s.onGrant != nil {
		s.onGrant()
	}
	if s.archives == nil {
		return protocol.ArchiveGrant{}, errors.New("422 Unprocessable Entity: nowhere to store one")
	}
	return s.archives.grant(request), nil
}

func (s *heldSandbox) CompleteArchive(_ context.Context, archiveID string) error {
	return s.archives.complete(archiveID)
}

func (s *heldSandbox) sentStep(name string) string {
	s.journal.mu.Lock()
	defer s.journal.mu.Unlock()
	for _, event := range s.sent {
		if event.Type == protocol.EventStepEnded && event.Message == name {
			var ended protocol.StepEnd
			if err := json.Unmarshal(event.Data, &ended); err != nil {
				return ""
			}
			return ended.Output
		}
	}
	return ""
}
