package session

import (
	"context"

	"usespotlight.ai/data-plane/runner/internal/acp"
)

type Harness interface {
	Protocol() string
	Watch(saw func(acp.Update))
	Prompt(ctx context.Context, sessionID, text string) (acp.Result, error)
	Settle(ctx context.Context) (acp.Work, bool)
	Current() acp.Work
	Cancel(sessionID string) error
	Close() error
}
