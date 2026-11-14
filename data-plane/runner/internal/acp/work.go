package acp

import (
	"context"
	"sync"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const SettleQuiet = 5 * time.Second

type Work struct {
	Seen       bool
	Gone       bool
	Background []protocol.BackgroundTask
}

type WorkChange struct {
	Reported bool
	Busy     *bool
	Tasks    *[]protocol.BackgroundTask
}

type WorkState struct {
	mu        sync.Mutex
	seen      bool
	busy      bool
	live      []protocol.BackgroundTask
	changedAt time.Time
	changed   chan struct{}
	quiet     time.Duration
}

func NewWorkState(quiet time.Duration) *WorkState {
	return &WorkState{changed: make(chan struct{}), quiet: quiet, changedAt: time.Now()}
}

func (w *WorkState) Touch() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.changedLocked()
}

func (w *WorkState) changedLocked() {
	w.changedAt = time.Now()
	close(w.changed)
	w.changed = make(chan struct{})
}

func (w *WorkState) Apply(change WorkChange) {
	if !change.Reported {
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	w.seen = true
	if change.Busy != nil {
		w.busy = *change.Busy
	}
	if change.Tasks != nil {
		w.live = append(w.live[:0], (*change.Tasks)...)
	}
	w.changedLocked()
}

func (w *WorkState) Now() Work {
	w.mu.Lock()
	defer w.mu.Unlock()
	return Work{Seen: w.seen, Background: append([]protocol.BackgroundTask(nil), w.live...)}
}

func (w *WorkState) Settle(ctx context.Context, done <-chan struct{}) (Work, bool) {
	for {
		if closed(done) {
			gone := w.Now()
			gone.Gone = true
			return gone, false
		}

		w.mu.Lock()
		if !w.seen {
			w.mu.Unlock()
			return Work{}, true
		}
		busy := w.busy || len(w.live) > 0
		left := w.quiet - time.Since(w.changedAt)
		changed := w.changed
		w.mu.Unlock()

		if !busy && left <= 0 {
			return w.Now(), true
		}

		var wait *time.Timer
		var timer <-chan time.Time
		if !busy {
			wait = time.NewTimer(left)
			timer = wait.C
		}

		select {
		case <-ctx.Done():
		case <-done:
		case <-changed:
		case <-timer:
		}
		if wait != nil {
			wait.Stop()
		}
		if ctx.Err() != nil {
			return w.Now(), false
		}
	}
}

func closed(done <-chan struct{}) bool {
	select {
	case <-done:
		return true
	default:
		return false
	}
}
