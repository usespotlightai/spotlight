package session

import (
	"context"

	"usespotlight.ai/data-plane/protocol"
)

type TurnEnd int

const (
	TurnEnded TurnEnd = iota
	TurnCutShort
	TurnCancelled
	TurnFailed
)

type Turn struct {
	End    TurnEnd
	Reason string
	Silent bool
}

type Work struct {
	Seen       bool
	Gone       bool
	Background []protocol.BackgroundTask
}

type Harness interface {
	Protocol() string
	Reports() protocol.HarnessReports
	Watch(saw func(protocol.Event))
	NewSession(ctx context.Context) (string, error)
	Resume(ctx context.Context, sessionID string) error
	SetConfigOption(ctx context.Context, id, value string) error
	Prompt(ctx context.Context, text string) (Turn, error)
	Settle(ctx context.Context) (Work, bool)
	Current() Work
	Cancel() error
	Close() error
}
