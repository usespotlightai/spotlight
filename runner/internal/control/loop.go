package control

import (
	"context"
	"log/slog"
	"math/rand/v2"
	"time"

	"usespotlight.ai/runner/internal/harness"
	"usespotlight.ai/runner/internal/protocol"
)

const (
	retryFloor   = 2 * time.Second
	retryCeiling = 20 * time.Second
)

type Claimer interface {
	Claim(ctx context.Context) (*protocol.Run, error)
}

type Limits struct {
	MaxRuns     int
	IdleTimeout time.Duration
	RetireAt    time.Time
}

func Poll(
	ctx context.Context,
	claimer Claimer,
	limits Limits,
	log *slog.Logger,
	execute func(context.Context, protocol.Run),
) error {
	served := 0
	idleSince := time.Now()
	backoff := retryFloor

	for {
		if err := ctx.Err(); err != nil {
			return nil
		}
		if limits.MaxRuns > 0 && served >= limits.MaxRuns {
			log.Info("served every run asked of it", "runs", served)
			return nil
		}
		if !limits.RetireAt.IsZero() && !time.Now().Before(limits.RetireAt) {
			log.Info("retiring, taking no more work")
			return nil
		}
		if limits.IdleTimeout > 0 && time.Since(idleSince) >= limits.IdleTimeout {
			log.Info("idle for long enough", "idle", limits.IdleTimeout)
			return nil
		}

		run, err := claimer.Claim(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			log.Warn("claim failed", "error", err, "retryIn", backoff)
			if !sleep(ctx, jitter(backoff)) {
				return nil
			}
			backoff = min(backoff*2, retryCeiling)
			continue
		}

		backoff = retryFloor

		if run == nil {
			continue
		}

		log.Info("claimed a run", "run", run.ID)
		execute(ctx, *run)

		served++
		idleSince = time.Now()
	}
}

func jitter(d time.Duration) time.Duration {
	return d/2 + time.Duration(rand.Int64N(int64(d)))
}

func sleep(ctx context.Context, d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}

type Registrar interface {
	Installable(ctx context.Context) ([]protocol.Installable, error)
	Register(ctx context.Context, in protocol.Registration) error
}

func Register(ctx context.Context, registrar Registrar, log *slog.Logger) error {
	backoff := retryFloor

	for {
		err := checkIn(ctx, registrar)
		if err == nil {
			return nil
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}

		log.Warn("could not register, still trying", "error", err, "retryIn", backoff)

		if !sleep(ctx, jitter(backoff)) {
			return ctx.Err()
		}
		backoff = min(backoff*2, retryCeiling)
	}
}

func checkIn(ctx context.Context, registrar Registrar) error {
	candidates, err := registrar.Installable(ctx)
	if err != nil {
		return err
	}

	return registrar.Register(ctx, protocol.Registration{
		Harnesses: harness.Installed(ctx, candidates),
	})
}
