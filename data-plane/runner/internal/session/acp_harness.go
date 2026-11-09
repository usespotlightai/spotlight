package session

import (
	"context"

	"usespotlight.ai/data-plane/runner/internal/acp"
)

type acpHarness struct {
	client *acp.Client
}

func overACP(client *acp.Client) Harness {
	return acpHarness{client: client}
}

var acpTurnEnds = map[string]TurnEnd{
	"end_turn":   TurnEnded,
	"max_tokens": TurnCutShort,
	"cancelled":  TurnCancelled,
}

func (h acpHarness) Protocol() string { return h.client.Protocol() }

func (h acpHarness) Watch(saw func(Update)) {
	h.client.Watch(func(update acp.Update) { saw(Update{Raw: update.Raw}) })
}

func (h acpHarness) Prompt(ctx context.Context, sessionID, text string) (Turn, error) {
	result, err := h.client.Prompt(ctx, sessionID, text)
	end, known := acpTurnEnds[result.StopReason]
	if !known {
		end = TurnFailed
	}
	return Turn{End: end, Reason: result.StopReason, Usage: result.Usage}, err
}

func (h acpHarness) Settle(ctx context.Context) (Work, bool) {
	work, settled := h.client.Settle(ctx)
	return workOf(work), settled
}

func (h acpHarness) Current() Work { return workOf(h.client.Current()) }

func (h acpHarness) Cancel(sessionID string) error { return h.client.Cancel(sessionID) }

func (h acpHarness) Close() error { return h.client.Close() }

func workOf(work acp.Work) Work {
	return Work{Seen: work.Seen, Gone: work.Gone, Background: work.Background}
}
