package session

import (
	"context"
	"errors"
	"fmt"

	"usespotlight.ai/data-plane/runner/internal/acp"
	v1 "usespotlight.ai/data-plane/runner/internal/acp/v1"
)

func startHarness(ctx context.Context, named string, opts acp.Options) (Harness, error) {
	switch named {
	case "", v1.Protocol:
		client, err := v1.Start(ctx, opts)
		if err != nil {
			return nil, err
		}
		return overV1{client}, nil
	default:
		return nil, errors.Join(errUnknownProtocol, fmt.Errorf("%q", named))
	}
}

var errUnknownProtocol = errors.New("the runner does not speak this harness protocol")

type overV1 struct {
	*v1.Client
}

var v1TurnEnds = map[string]TurnEnd{
	"end_turn":   TurnEnded,
	"max_tokens": TurnCutShort,
	"cancelled":  TurnCancelled,
}

func (h overV1) Prompt(ctx context.Context, text string) (Turn, error) {
	result, err := h.Client.Prompt(ctx, text)
	end, known := v1TurnEnds[result.StopReason]
	if !known {
		end = TurnFailed
	}
	return Turn{End: end, Reason: result.StopReason, Silent: result.Heard == 0}, err
}

func (h overV1) Settle(ctx context.Context) (Work, bool) {
	work, settled := h.Client.Settle(ctx)
	return workOf(work), settled
}

func (h overV1) Current() Work { return workOf(h.Client.Current()) }

func workOf(work acp.Work) Work {
	return Work{Seen: work.Seen, Gone: work.Gone, Background: work.Background}
}
