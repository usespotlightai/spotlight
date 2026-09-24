package control

import (
	"context"
	"errors"
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
	Claim(ctx context.Context) (*protocol.Claimed, error)
}

type Work struct {
	Run   func(context.Context, protocol.Run)
	Check func(context.Context, protocol.StackCheck)
}

type Limits struct {
	Once        bool
	MaxRuns     int
	IdleTimeout time.Duration
	RetireAt    time.Time
}

func Poll(
	ctx context.Context,
	claimer Claimer,
	limits Limits,
	log *slog.Logger,
	work Work,
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

		claimed, err := claimer.Claim(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			if errors.Is(err, ErrRefused) {
				return err
			}
			log.Warn("claim failed", "error", err, "retryIn", backoff)
			if !sleep(ctx, jitter(backoff)) {
				return nil
			}
			backoff = min(backoff*2, retryCeiling)
			continue
		}

		backoff = retryFloor

		if claimed == nil {
			continue
		}

		switch {
		case claimed.Kind == protocol.ClaimedRun && claimed.Run != nil:
			log.Info("claimed a run", "run", claimed.Run.ID)
			work.Run(ctx, *claimed.Run)
			served++
		case claimed.Kind == protocol.ClaimedCheck && claimed.Check != nil:
			log.Info("claimed a change stack check",
				"stack", claimed.Check.StackID, "run", claimed.Check.RunID)
			work.Check(ctx, *claimed.Check)
		default:
			log.Warn("claimed something it does not know how to do", "kind", claimed.Kind)
			continue
		}

		if limits.Once {
			log.Info("served its one piece of work")
			return nil
		}

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
		if errors.Is(err, ErrRefused) {
			return err
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
