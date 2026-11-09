package session

import (
	"context"
	"encoding/json"

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
	Usage  json.RawMessage
}

func (t Turn) Used() bool {
	return len(t.Usage) > 0 && string(t.Usage) != "null"
}

type Update struct {
	Raw json.RawMessage
}

type Work struct {
	Seen       bool
	Gone       bool
	Background []protocol.BackgroundTask
}

type Harness interface {
	Protocol() string
	Watch(saw func(Update))
	Prompt(ctx context.Context, sessionID, text string) (Turn, error)
	Settle(ctx context.Context) (Work, bool)
	Current() Work
	Cancel(sessionID string) error
	Close() error
}
