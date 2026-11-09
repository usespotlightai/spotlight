package acp

import (
	"context"
	"sync"
	"time"

	"usespotlight.ai/data-plane/protocol"
)

const settleQuiet = 5 * time.Second

type Work struct {
	Seen       bool
	Gone       bool
	Background []protocol.BackgroundTask
}

type workChange struct {
	reported bool
	busy     *bool
	tasks    *[]protocol.BackgroundTask
}

type workState struct {
	mu        sync.Mutex
	seen      bool
	busy      bool
	live      []protocol.BackgroundTask
	changedAt time.Time
	changed   chan struct{}
	quiet     time.Duration
}

func newWorkState(quiet time.Duration) *workState {
	return &workState{changed: make(chan struct{}), quiet: quiet, changedAt: time.Now()}
}

func (w *workState) touch() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.changedLocked()
}

func (w *workState) changedLocked() {
	w.changedAt = time.Now()
	close(w.changed)
	w.changed = make(chan struct{})
}

func (w *workState) apply(change workChange) {
	if !change.reported {
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	w.seen = true
	if change.busy != nil {
		w.busy = *change.busy
	}
	if change.tasks != nil {
		w.live = append(w.live[:0], (*change.tasks)...)
	}
	w.changedLocked()
}

func (w *workState) now() Work {
	w.mu.Lock()
	defer w.mu.Unlock()
	return Work{Seen: w.seen, Background: append([]protocol.BackgroundTask(nil), w.live...)}
}

func (w *workState) settle(ctx context.Context, done <-chan struct{}) (Work, bool) {
	for {
		if closed(done) {
			gone := w.now()
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
			return w.now(), true
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
			return w.now(), false
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
