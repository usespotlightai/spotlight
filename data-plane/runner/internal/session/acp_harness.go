package session

import (
	"context"
	"errors"
	"fmt"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/acp"
	v1 "usespotlight.ai/data-plane/runner/internal/acp/v1"
	v2 "usespotlight.ai/data-plane/runner/internal/acp/v2"
)

func startHarness(ctx context.Context, named string, opts acp.Options) (Harness, error) {
	switch named {
	case "", v1.Protocol:
		return startV1(ctx, opts)
	case v2.Protocol:
		client, err := v2.Start(ctx, opts)
		if errors.Is(err, v2.ErrOlderProtocol) {
			return startV1(ctx, opts)
		}
		if err != nil {
			return nil, err
		}
		return overV2{client}, nil
	default:
		return nil, errors.Join(errUnknownProtocol, fmt.Errorf("%q", named))
	}
}

func startV1(ctx context.Context, opts acp.Options) (Harness, error) {
	client, err := v1.Start(ctx, opts)
	if err != nil {
		return nil, err
	}
	return overV1{client}, nil
}

var errUnknownProtocol = errors.New("the runner does not speak this harness protocol")

var turnEnds = map[protocol.TurnStop]TurnEnd{
	protocol.TurnStopEnded:     TurnEnded,
	protocol.TurnStopCutShort:  TurnCutShort,
	protocol.TurnStopCancelled: TurnCancelled,
}

func turnOf(stop protocol.TurnStop, reason string, heard int) Turn {
	end, known := turnEnds[stop]
	if !known {
		end = TurnFailed
	}
	return Turn{End: end, Reason: reason, Silent: heard == 0}
}

type overV1 struct {
	*v1.Client
}

func (h overV1) Prompt(ctx context.Context, text string) (Turn, error) {
	result, err := h.Client.Prompt(ctx, text)
	return turnOf(v1.StopOf(result.StopReason), result.StopReason, result.Heard), err
}

func (h overV1) Settle(ctx context.Context) (Work, bool) {
	work, settled := h.Client.Settle(ctx)
	return workOf(work), settled
}

func (h overV1) Current() Work { return workOf(h.Client.Current()) }

type overV2 struct {
	*v2.Client
}

func (h overV2) Prompt(ctx context.Context, text string) (Turn, error) {
	result, err := h.Client.Prompt(ctx, text)
	return turnOf(v2.StopOf(result.StopReason), result.StopReason, result.Heard), err
}

func (h overV2) Settle(ctx context.Context) (Work, bool) {
	work, settled := h.Client.Settle(ctx)
	return workOf(work), settled
}

func (h overV2) Current() Work { return workOf(h.Client.Current()) }

func workOf(work acp.Work) Work {
	return Work{Seen: work.Seen, Gone: work.Gone, Background: work.Background}
}
