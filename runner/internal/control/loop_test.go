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
	work  []*protocol.Claimed
	errs  []error
	calls int
}

func (c *claims) Claim(context.Context) (*protocol.Claimed, error) {
	defer func() { c.calls++ }()

	if c.calls < len(c.errs) && c.errs[c.calls] != nil {
		return nil, c.errs[c.calls]
	}
	if c.calls < len(c.work) {
		return c.work[c.calls], nil
	}
	if c.calls < len(c.runs) {
		return &protocol.Claimed{Kind: protocol.ClaimedRun, Run: c.runs[c.calls]}, nil
	}
	return nil, nil
}

func running(served *[]string) control.Work {
	return control.Work{
		Run:   func(_ context.Context, run protocol.Run) { *served = append(*served, run.ID) },
		Check: func(context.Context, protocol.StackCheck) {},
	}
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
		running(&served),
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
			control.Work{
				Run:   func(context.Context, protocol.Run) { t.Error("nothing should have been served") },
				Check: func(context.Context, protocol.StackCheck) { t.Error("nothing should have been served") },
			},
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
		control.Work{
			Run:   func(context.Context, protocol.Run) { t.Error("a retired runner should not serve") },
			Check: func(context.Context, protocol.StackCheck) { t.Error("a retired runner should not serve") },
		},
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
		running(&served),
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
		control.Work{
			Run:   func(context.Context, protocol.Run) { t.Error("a cancelled runner should not serve") },
			Check: func(context.Context, protocol.StackCheck) { t.Error("a cancelled runner should not serve") },
		},
	)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}
}

func TestPollRunsAChangeStackCheckWithoutCountingItAsARun(t *testing.T) {
	claimer := &claims{work: []*protocol.Claimed{
		{Kind: protocol.ClaimedCheck, Check: &protocol.StackCheck{StackID: "s1"}},
		{Kind: protocol.ClaimedRun, Run: &protocol.Run{ID: "a"}},
		{Kind: protocol.ClaimedRun, Run: &protocol.Run{ID: "b"}},
	}}

	var served, checked []string
	err := control.Poll(
		context.Background(),
		claimer,
		control.Limits{MaxRuns: 2},
		quiet(),
		control.Work{
			Run:   func(_ context.Context, run protocol.Run) { served = append(served, run.ID) },
			Check: func(_ context.Context, c protocol.StackCheck) { checked = append(checked, c.StackID) },
		},
	)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}

	if len(checked) != 1 || checked[0] != "s1" {
		t.Errorf("checked %v", checked)
	}
	if len(served) != 2 {
		t.Errorf("served %v, want a check not to use up a run", served)
	}
}

func TestPollPassesOverWorkItDoesNotKnow(t *testing.T) {
	claimer := &claims{work: []*protocol.Claimed{
		{Kind: "something-new"},
		{Kind: protocol.ClaimedRun, Run: &protocol.Run{ID: "a"}},
	}}

	var served []string
	err := control.Poll(
		context.Background(),
		claimer,
		control.Limits{MaxRuns: 1},
		quiet(),
		running(&served),
	)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}

	if len(served) != 1 || served[0] != "a" {
		t.Errorf("served %v", served)
	}
}
