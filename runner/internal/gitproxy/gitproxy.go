// Package gitproxy: the workspace remote carries no credential; this loopback listener adds the runner's token.
package gitproxy

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Serving struct {
	Remote string

	listener net.Listener
	server   *http.Server
}

func Serve(controlPlane, token, runID string) (*Serving, error) {
	base, err := url.Parse(controlPlane)
	if err != nil || !base.IsAbs() {
		return nil, fmt.Errorf("control plane url %q is not absolute", controlPlane)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("listen for git on loopback: %w", err)
	}

	// Scoped to this run: never carry another run's path.
	prefix := "/" + runID + "/"

	served := &Serving{
		Remote:   fmt.Sprintf("http://%s/%s", listener.Addr().String(), runID),
		listener: listener,
		server: &http.Server{
			Handler:           forwarding(base, token, prefix),
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

func forwarding(base *url.URL, token, prefix string) http.Handler {
	client := &http.Client{}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, prefix) {
			http.NotFound(w, r)
			return
		}

		upstream := *base
		upstream.Path = strings.TrimSuffix(base.Path, "/") + "/api/git" + r.URL.Path
		upstream.RawQuery = r.URL.RawQuery

		forwarded, err := http.NewRequestWithContext(
			r.Context(), r.Method, upstream.String(), r.Body,
		)
		if err != nil {
			http.Error(w, "cannot reach the control plane", http.StatusBadGateway)
			return
		}

		for _, name := range carried {
			if value := r.Header.Get(name); value != "" {
				forwarded.Header.Set(name, value)
			}
		}
		forwarded.Header.Set("Authorization", "Bearer "+token)

		answered, err := client.Do(forwarded)
		if err != nil {
			http.Error(w, "cannot reach the control plane", http.StatusBadGateway)
			return
		}
		defer func() { _ = answered.Body.Close() }()

		for _, name := range answeredBack {
			if value := answered.Header.Get(name); value != "" {
				w.Header().Set(name, value)
			}
		}
		w.WriteHeader(answered.StatusCode)

		// Flushed as it streams: git talks both ways while a pack is still being written.
		_, _ = io.Copy(flushing{w}, answered.Body)
	})
}

var carried = []string{
	"Content-Type",
	"Content-Encoding",
	"Accept",
	"Accept-Encoding",
	"Git-Protocol",
	"User-Agent",
}

var answeredBack = []string{"Content-Type", "Content-Encoding", "Cache-Control"}

type flushing struct{ w http.ResponseWriter }

func (f flushing) Write(p []byte) (int, error) {
	written, err := f.w.Write(p)
	if flusher, ok := f.w.(http.Flusher); ok {
		flusher.Flush()
	}
	return written, err
}
