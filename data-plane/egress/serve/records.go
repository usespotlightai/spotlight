package serve

import (
	"context"
	"log/slog"
	"slices"
	"sync"

	"usespotlight.ai/data-plane/protocol"
)

const maxPending = 10_000

type records struct {
	control ControlPlane
	log     *slog.Logger

	mu      sync.Mutex
	pending []protocol.EgressConnection
	sending sync.Mutex
}

func (r *records) add(record protocol.EgressConnection) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.pending) >= maxPending {
		r.pending = r.pending[1:]
	}
	r.pending = append(r.pending, record)
}

func (r *records) flush(ctx context.Context) {
	r.sending.Lock()
	defer r.sending.Unlock()

	r.mu.Lock()
	batch := r.pending
	r.pending = nil
	r.mu.Unlock()

	for at := 0; at < len(batch); at += protocol.MaxRecordsAtOnce {
		sending := batch[at:min(at+protocol.MaxRecordsAtOnce, len(batch))]

		err := r.control.RecordConnections(ctx, sending)
		if isRejected(err) {
			r.log.Warn("the control plane did not accept connection records", "connections", len(sending), "error", err)
			continue
		}
		if err != nil {
			r.log.Warn("could not record connections, will send them again", "connections", len(batch)-at, "error", err)
			r.again(batch[at:])
			return
		}
	}
}

func (r *records) again(unsent []protocol.EgressConnection) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.pending = append(slices.Clone(unsent), r.pending...)
	if over := len(r.pending) - maxPending; over > 0 {
		r.pending = r.pending[over:]
	}
}
