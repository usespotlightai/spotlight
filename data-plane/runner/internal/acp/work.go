package acp

import (
	"context"
	"encoding/json"
	"sync"
	"time"
)

const claudeCodeFrame = "_claude/sdkMessage"

const settleQuiet = 5 * time.Second

type BackgroundItem struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"`
	Description string `json:"description"`
}

type Work struct {
	Seen       bool
	Gone       bool
	Background []BackgroundItem
}

type workState struct {
	mu        sync.Mutex
	seen      bool
	state     string
	live      []BackgroundItem
	changedAt time.Time
	changed   chan struct{}
	quiet     time.Duration
}

func newWorkState(quiet time.Duration) *workState {
	return &workState{state: "idle", changed: make(chan struct{}), quiet: quiet, changedAt: time.Now()}
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

func (w *workState) take(params json.RawMessage) {
	var frame struct {
		Message struct {
			Type    string `json:"type"`
			Subtype string `json:"subtype"`
			State   string `json:"state"`
			Tasks   []struct {
				TaskID      string `json:"task_id"`
				TaskType    string `json:"task_type"`
				Description string `json:"description"`
				Ambient     bool   `json:"ambient"`
			} `json:"tasks"`
		} `json:"message"`
	}
	if json.Unmarshal(params, &frame) != nil || frame.Message.Type != "system" {
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	switch frame.Message.Subtype {
	case "session_state_changed":
		w.seen = true
		w.state = frame.Message.State
	case "background_tasks_changed":
		w.seen = true
		w.live = w.live[:0]
		for _, task := range frame.Message.Tasks {
			if task.Ambient {
				continue
			}
			w.live = append(w.live, BackgroundItem{ID: task.TaskID, Kind: task.TaskType, Description: task.Description})
		}
	default:
		return
	}
	w.changedLocked()
}

func (w *workState) now() Work {
	w.mu.Lock()
	defer w.mu.Unlock()
	return Work{Seen: w.seen, Background: append([]BackgroundItem(nil), w.live...)}
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
		busy := w.state != "idle" || len(w.live) > 0
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
