// Package otel takes what a harness reports about its own workings.
//
// A harness that speaks OpenTelemetry knows things the Agent Client Protocol
// has no way to say: which model answered a turn, what each call to it cost,
// and how long the agent waited on a person. It exports over HTTP, so the
// runner listens on a loopback port of its own and carries what arrives into
// the run's journal, the way it already does for git and for handovers. There
// is no inbound route to the runner and none is wanted: the harness is a child
// process on the same machine.
package otel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"
)

// Most of a payload worth reading. A harness batches spans, and one wedged
// export should not be able to spend the runner's memory.
const mostPerExport = 8 << 20

// Serving is one run's collector, listening for as long as the run is worked.
type Serving struct {
	URL string

	listener net.Listener
	server   *http.Server
}

// Recorder is handed each span as the harness reported it, whole. What a span
// means is not the runner's business: the journal records what was said.
type Recorder func(span json.RawMessage)

// Serve listens on a loopback port the operating system chooses.
func Serve(record Recorder) (*Serving, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("listen for telemetry: %w", err)
	}

	served := &Serving{
		URL:      fmt.Sprintf("http://%s", listener.Addr().String()),
		listener: listener,
		server: &http.Server{
			Handler:           taking(record),
			ReadHeaderTimeout: 30 * time.Second,
		},
	}

	go func() {
		_ = served.server.Serve(listener)
	}()

	return served, nil
}

// Close stops answering: the run is over, so the collector is too.
func (s *Serving) Close() error {
	if s == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.server.Shutdown(ctx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	return nil
}

// export is the shape of an OTLP payload, of the part that carries spans. The
// envelope is walked and thrown away; each span inside it is kept as it came.
type export struct {
	ResourceSpans []struct {
		ScopeSpans []struct {
			Spans []json.RawMessage `json:"spans"`
		} `json:"scopeSpans"`
	} `json:"resourceSpans"`
}

// taking answers the harness. Everything is accepted, including what cannot be
// read: an exporter that is refused may drop what it was holding, and a run is
// worth more than its telemetry.
func taking(record Recorder) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "only POST", http.StatusMethodNotAllowed)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, mostPerExport))
		if err != nil {
			answer(w)
			return
		}

		var sent export
		if err := json.Unmarshal(body, &sent); err != nil {
			// Protobuf, most likely, which this collector does not read. Saying
			// so once is the exporter's only clue; refusing it is not.
			answer(w)
			return
		}

		for _, resource := range sent.ResourceSpans {
			for _, scope := range resource.ScopeSpans {
				for _, span := range scope.Spans {
					record(span)
				}
			}
		}

		answer(w)
	})
}

// An OTLP exporter wants a body it can decode, and treats anything else as a
// failure worth retrying.
func answer(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{}`))
}
