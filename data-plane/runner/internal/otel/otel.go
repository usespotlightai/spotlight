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

const maxPerExport = 8 << 20

type Serving struct {
	URL string

	listener net.Listener
	server   *http.Server
}

type Recorder func(span json.RawMessage)

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

type export struct {
	ResourceSpans []struct {
		ScopeSpans []struct {
			Spans []json.RawMessage `json:"spans"`
		} `json:"scopeSpans"`
	} `json:"resourceSpans"`
}

func taking(record Recorder) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "only POST", http.StatusMethodNotAllowed)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxPerExport))
		if err != nil {
			answer(w)
			return
		}

		var sent export
		if err := json.Unmarshal(body, &sent); err != nil {
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

func answer(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{}`))
}
