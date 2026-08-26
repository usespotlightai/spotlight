package control_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"usespotlight.ai/runner/internal/control"
	"usespotlight.ai/runner/internal/protocol"
)

type claims struct {
	runs  []*protocol.Run
	errs  []error
	calls int
}

func (c *claims) Claim(context.Context) (*protocol.Run, error) {
	defer func() { c.calls++ }()

	if c.calls < len(c.errs) && c.errs[c.calls] != nil {
		return nil, c.errs[c.calls]
	}
	if c.calls < len(c.runs) {
		return c.runs[c.calls], nil
	}
	return nil, nil
}

func quiet() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestPollStopsAfterTheRunsItWasAskedFor(t *testing.T) {
	claimer := &claims{runs: []*protocol.Run{{ID: "a"}, {ID: "b"}, {ID: "c"}}}

	var served []string
	err := control.Poll(
		context.Background(),
		claimer,
		control.Limits{MaxRuns: 2},
		quiet(),
		func(_ context.Context, run protocol.Run) { served = append(served, run.ID) },
	)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}

	if len(served) != 2 || served[0] != "a" || served[1] != "b" {
		t.Errorf("served %v", served)
	}
}

func TestPollStopsWhenIdleForLongEnough(t *testing.T) {
	done := make(chan error, 1)
	go func() {
		done <- control.Poll(
			context.Background(),
			&claims{},
			control.Limits{IdleTimeout: 50 * time.Millisecond},
			quiet(),
			func(context.Context, protocol.Run) { t.Error("nothing should have been served") },
		)
	}()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("poll: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("poll did not give up when idle")
	}
}

func TestPollTakesNoWorkPastItsRetirement(t *testing.T) {
	claimer := &claims{runs: []*protocol.Run{{ID: "a"}}}

	err := control.Poll(
		context.Background(),
		claimer,
		control.Limits{RetireAt: time.Now().Add(-time.Second)},
		quiet(),
		func(context.Context, protocol.Run) { t.Error("a retired runner should not serve") },
	)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}
	if claimer.calls != 0 {
		t.Errorf("a retired runner should not even ask, asked %d times", claimer.calls)
	}
}

func TestPollKeepsGoingAfterTheControlPlaneFails(t *testing.T) {
	claimer := &claims{
		errs: []error{errors.New("connection refused"), nil},
		runs: []*protocol.Run{nil, {ID: "a"}},
	}

	var served []string
	err := control.Poll(
		context.Background(),
		claimer,
		control.Limits{MaxRuns: 1},
		quiet(),
		func(_ context.Context, run protocol.Run) { served = append(served, run.ID) },
	)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}

	if len(served) != 1 || served[0] != "a" {
		t.Errorf("served %v after recovering", served)
	}
}

func TestPollStopsWhenToldTo(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := control.Poll(
		ctx,
		&claims{runs: []*protocol.Run{{ID: "a"}}},
		control.Limits{},
		quiet(),
		func(context.Context, protocol.Run) { t.Error("a cancelled runner should not serve") },
	)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}
}
