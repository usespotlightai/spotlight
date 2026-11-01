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
	callers      = 4
	callTimeout  = 10 * time.Second
	responseWait = time.Minute
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

		claimedAt := time.Now()
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
			} else if time.Since(claimedAt) < quickAnswer && !sleep(ctx, jitter(retryFloor)) {
				return nil
			}
			continue
		}

		backoff = retryFloor
		h.responding.Go(func() {
			defer func() { <-slots }()
			h.respond(serving, *call, stop)
		})
	}
}

func (h *Host) respond(ctx context.Context, call protocol.HostCall, stop func(error)) {
	log := h.log.With("call", call.ID)
	response := h.sent(ctx, call, log)

	telling, cancel := context.WithTimeout(context.WithoutCancel(ctx), responseWait)
	defer cancel()

	if err := h.pool.RecordCallResponse(telling, call.ID, response); err != nil {
		if final(err) {
			stop(err)
		}
		log.Error("could not record the response of the call", "error", err)
		return
	}

	if response.Error != "" {
		log.Warn("recorded a call that got no response", "reason", response.Error)
		return
	}
	log.Info("recorded the response of a call", "status", response.Status, "ms", response.Ms)
}

func (h *Host) sent(ctx context.Context, call protocol.HostCall, log *slog.Logger) protocol.HostCallResponse {
	began := time.Now()
	noResponse := func(reason string) protocol.HostCallResponse {
		return protocol.HostCallResponse{Ms: int(time.Since(began).Milliseconds()), Error: reason}
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
		return noResponse(fmt.Sprintf("The host couldn't get its egress image. Error: %v", err))
	}

	config := protocol.EgressConfig{
		URL:         h.now().SandboxURL,
		Credential:  rand.Text(),
		Allow:       h.now().Egress.Allow,
		SecretAllow: h.now().Egress.SecretAllow,
		Send:        &call,
	}
	if call.SecretsToken != "" {
		config.SendSecrets = &protocol.CallSecrets{CallID: call.ID, Host: h.opts.HostID, Token: call.SecretsToken}
	}

	container, err := h.startEgress(sending, image, "call-"+call.ID,
		map[string]string{LabelHost: h.opts.HostID, LabelCall: call.ID}, config, nil)
	defer h.destroy(container)
	if err != nil {
		log.Warn("could not start an egress to send the call", "error", err)
		return noResponse(fmt.Sprintf("The host's egress didn't start. Error: %v", err))
	}

	found, err := h.awaited(sending, container, protocol.EgressSendPath, budget, json.Valid)
	switch {
	case err == nil:
	case ctx.Err() != nil:
		return noResponse("The host stopped before the call got a response.")
	case sending.Err() != nil || errors.Is(err, errLate):
		return noResponse(fmt.Sprintf("The host's egress didn't respond in time. Time limit: %s", budget))
	default:
		return noResponse(fmt.Sprintf("The host can't read its egress's response. Error: %v", err))
	}

	var response protocol.HostCallResponse
	if err := json.Unmarshal(found, &response); err != nil {
		return noResponse(fmt.Sprintf("The host can't read its egress's response. Error: %v", err))
	}

	return response
}
