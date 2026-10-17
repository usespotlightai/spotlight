package serve

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const (
	callers     = 4
	callTimeout = 10 * time.Second
	answerWait  = time.Minute
)

func (h *Host) calls(ctx, serving context.Context, stop func(error)) error {
	slots := make(chan struct{}, callers)
	backoff := retryFloor

	for {
		select {
		case slots <- struct{}{}:
		case <-ctx.Done():
			return nil
		}

		asked := time.Now()
		call, err := h.pool.ClaimCall(ctx)
		if err != nil || call == nil {
			<-slots

			if ctx.Err() != nil {
				return nil
			}
			if final(err) {
				return err
			}
			if err != nil {
				h.log.Warn("could not claim a call", "error", err, "retryIn", backoff)
				if !sleep(ctx, jitter(backoff)) {
					return nil
				}
				backoff = min(backoff*2, retryCeiling)
			} else if time.Since(asked) < quickAnswer && !sleep(ctx, jitter(retryFloor)) {
				return nil
			}
			continue
		}

		backoff = retryFloor
		h.answering.Go(func() {
			defer func() { <-slots }()
			h.answer(serving, *call, stop)
		})
	}
}

func (h *Host) answer(ctx context.Context, call protocol.HostCall, stop func(error)) {
	log := h.log.With("call", call.ID)
	answer := h.sent(ctx, call, log)

	telling, cancel := context.WithTimeout(context.WithoutCancel(ctx), answerWait)
	defer cancel()

	if err := h.pool.AnswerCall(telling, call.ID, answer); err != nil {
		if final(err) {
			stop(err)
		}
		log.Error("could not answer the call", "error", err)
		return
	}

	if answer.Error != "" {
		log.Warn("answered a call that went unanswered", "reason", answer.Error)
		return
	}
	log.Info("answered a call", "status", answer.Status, "ms", answer.Ms)
}

func (h *Host) sent(ctx context.Context, call protocol.HostCall, log *slog.Logger) protocol.HostCallAnswer {
	began := time.Now()
	unanswered := func(reason string) protocol.HostCallAnswer {
		return protocol.HostCallAnswer{Ms: int(time.Since(began).Milliseconds()), Error: reason}
	}

	timeout := time.Duration(call.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = callTimeout
	}
	wait := h.opts.EgressWait
	if wait <= 0 {
		wait = egressWait
	}
	budget := timeout + wait

	sending, cancel := context.WithTimeout(ctx, budget)
	defer cancel()

	image, err := h.egressImage(sending)
	if err != nil {
		return unanswered(fmt.Sprintf("The host couldn't get its egress image. Error: %v", err))
	}

	container, err := h.startEgress(sending, image, "call-"+call.ID,
		map[string]string{LabelHost: h.opts.HostID, LabelCall: call.ID},
		protocol.EgressConfig{
			URL:         h.opts.SandboxURL,
			Credential:  rand.Text(),
			Allow:       h.opts.Egress.Allow,
			SecretAllow: h.opts.Egress.SecretAllow,
			Send:        &call,
		}, nil)
	defer h.destroy(container)
	if err != nil {
		log.Warn("could not start an egress to send the call", "error", err)
		return unanswered(fmt.Sprintf("The host's egress didn't start. Error: %v", err))
	}

	found, err := h.awaited(sending, container, protocol.EgressSendPath, budget, json.Valid)
	switch {
	case err == nil:
	case ctx.Err() != nil:
		return unanswered("The host stopped before the call was answered.")
	case sending.Err() != nil || errors.Is(err, errLate):
		return unanswered(fmt.Sprintf("The host's egress didn't answer in time. Time limit: %s", budget))
	default:
		return unanswered(fmt.Sprintf("The host can't read its egress's answer. Error: %v", err))
	}

	var answer protocol.HostCallAnswer
	if err := json.Unmarshal(found, &answer); err != nil {
		return unanswered(fmt.Sprintf("The host can't read its egress's answer. Error: %v", err))
	}

	return answer
}
