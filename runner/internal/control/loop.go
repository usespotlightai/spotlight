package control

import (
	"context"
	"log/slog"
	"math/rand/v2"
	"time"

	"usespotlight.ai/runner/internal/protocol"
)

const (
	// retryFloor is the pause after a lost or timed-out poll. Short, because
	// the common case is simply that nothing was queued.
	retryFloor = 2 * time.Second
	// retryCeiling caps the backoff. Past this a runner looks absent.
	retryCeiling = 20 * time.Second
)

// Claimer is the part of the client a loop needs.
type Claimer interface {
	Claim(ctx context.Context) (*protocol.Run, error)
}

// Limits decide when a runner stops asking for work.
type Limits struct {
	// MaxRuns is how many runs to serve before exiting. Zero is unlimited.
	MaxRuns int
	// IdleTimeout exits after this long with nothing to do. Zero never does.
	IdleTimeout time.Duration
	// RetireAt stops taking new work at this time. Zero has no deadline.
	RetireAt time.Time
}

// Poll claims runs and hands them to execute, one at a time, until a limit is
// reached or the context ends. Capacity is deliberately one: parallelism comes
// from running more runners, which keeps this loop free of concurrency.
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

// jitter spreads retries so a fleet that lost the control plane together does
// not come back in lockstep.
func jitter(d time.Duration) time.Duration {
	return d/2 + time.Duration(rand.Int64N(int64(d)))
}

// sleep reports false when the context ended first.
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

// Registrar is the part of the client Register needs.
type Registrar interface {
	Register(ctx context.Context, in protocol.Registration) error
}

// Register keeps trying until the control plane answers or the context ends.
// A runner that starts before the control plane is reachable should wait for
// it rather than die and be restarted in a loop.
func Register(ctx context.Context, registrar Registrar, in protocol.Registration, log *slog.Logger) error {
	backoff := retryFloor

	for {
		err := registrar.Register(ctx, in)
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
