package serve

import (
	"context"
	"sync"
	"time"

	"usespotlight.ai/data-plane/host/internal/images"
)

// Settings are the options a running host takes on a reload, without stopping its sandboxes.
type Settings struct {
	Name       string
	Images     images.Allowed
	Capacity   int
	RunTimeout time.Duration
	AnswerWait time.Duration
	SandboxURL string
	SandboxEnv []string
	Egress     Egress
	Network    string
	ExtraHosts []string
	AutoUpdate bool
}

func settingsOf(opts Options) Settings {
	return Settings{
		Name: opts.Name, Images: opts.Images, Capacity: opts.Capacity, RunTimeout: opts.RunTimeout,
		AnswerWait: opts.AnswerWait, SandboxURL: opts.SandboxURL, SandboxEnv: opts.SandboxEnv, Egress: opts.Egress,
		Network: opts.Network, ExtraHosts: opts.ExtraHosts, AutoUpdate: opts.AutoUpdate,
	}
}

func (h *Host) now() *Settings {
	return h.live.Load()
}

// Reload applies settings to the sandboxes the host starts from now on. A lower capacity lets running sandboxes finish.
func (h *Host) Reload(settings Settings) {
	h.live.Store(&settings)
	h.slots.resize(settings.Capacity)
	h.log.Info("the host reloaded its settings", "name", settings.Name, "capacity", h.slots.size(),
		"default", settings.Images.Default)

	select {
	case h.reloaded <- struct{}{}:
	default:
	}
}

// Restart stops claiming, lets the running sandboxes finish, and has Serve return ErrRestart.
func (h *Host) Restart() {
	h.mu.Lock()
	h.restarting = true
	stopClaiming := h.stopClaiming
	h.mu.Unlock()

	h.log.Info("the host restarts when its sandboxes finish")
	if stopClaiming != nil {
		stopClaiming()
	}
}

func (h *Host) wasRestarted() bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	return h.restarting
}

type slots struct {
	mu      sync.Mutex
	limit   int
	used    int
	changed chan struct{}
}

func newSlots(limit int) *slots {
	return &slots{limit: max(limit, 1), changed: make(chan struct{})}
}

func (s *slots) take(ctx context.Context) bool {
	for {
		s.mu.Lock()
		if s.used < s.limit {
			s.used++
			s.mu.Unlock()
			return true
		}
		changed := s.changed
		s.mu.Unlock()

		select {
		case <-changed:
		case <-ctx.Done():
			return false
		}
	}
}

func (s *slots) give() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.used--
	s.broadcast()
}

func (s *slots) resize(limit int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.limit = max(limit, 1)
	s.broadcast()
}

func (s *slots) size() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.limit
}

func (s *slots) broadcast() {
	close(s.changed)
	s.changed = make(chan struct{})
}
