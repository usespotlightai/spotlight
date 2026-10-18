package runner

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"os"
	"time"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/config"
	"usespotlight.ai/data-plane/runner/internal/harness"
	"usespotlight.ai/data-plane/runner/internal/localproxy"
)

const (
	reservationWait = 5 * time.Minute
	retryFloor      = 2 * time.Second
	retryCeiling    = 20 * time.Second
)

func assignment(
	ctx context.Context, cfg config.Config, release string, egress *localproxy.Egress, log *slog.Logger,
) (*protocol.Assignment, error) {
	if cfg.HasAssignmentFile() {
		return readAssignment(cfg.AssignmentFile)
	}

	return reserved(ctx, cfg, release, egress, log)
}

func readAssignment(path string) (*protocol.Assignment, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read its assignment: %w", err)
	}
	// The credential is read one time. Nothing later in the sandbox can find it on disk.
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("remove its assignment: %w", err)
	}

	var assigned protocol.Assignment
	if err := json.Unmarshal(raw, &assigned); err != nil {
		return nil, fmt.Errorf("read its assignment: %w", err)
	}
	if assigned.Token == "" || assigned.RunnerID == "" {
		return nil, fmt.Errorf("its assignment has no one-run credential")
	}

	return &assigned, nil
}

func reserved(
	ctx context.Context, cfg config.Config, release string, egress *localproxy.Egress, log *slog.Logger,
) (*protocol.Assignment, error) {
	client, err := control.New(cfg.URL, cfg.Token)
	if err != nil {
		return nil, err
	}
	if egress != nil {
		client.Through(egress.Transport(nil))
	}

	if err := retried(ctx, log, "could not register, still trying", func() error {
		candidates, err := client.HarnessProbes(ctx)
		if err != nil {
			return err
		}
		return client.Register(ctx, protocol.Registration{Release: release, Harnesses: harness.Installed(ctx, candidates)})
	}); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, reservationWait)
	defer cancel()

	var work *protocol.ClaimResponse
	err = retried(ctx, log, "claim failed", func() error {
		for work == nil {
			claimed, err := client.Claim(ctx)
			if err != nil {
				return err
			}
			work = claimed
		}
		return nil
	})
	if work == nil {
		if ctx.Err() != nil {
			log.Info("nothing was reserved for it in time", "waited", reservationWait)
			return nil, nil
		}
		return nil, err
	}

	return &protocol.Assignment{RunnerID: client.RunnerID(), Token: cfg.Token, Work: *work}, nil
}

func retried(ctx context.Context, log *slog.Logger, failed string, try func() error) error {
	backoff := retryFloor

	for {
		err := try()
		if err == nil || ctx.Err() != nil || errors.Is(err, control.ErrUnauthorized) {
			return err
		}

		log.Warn(failed, "error", err, "retryIn", backoff)

		timer := time.NewTimer(backoff/2 + time.Duration(rand.Int64N(int64(backoff))))
		select {
		case <-timer.C:
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		}
		backoff = min(backoff*2, retryCeiling)
	}
}
