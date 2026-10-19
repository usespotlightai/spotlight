package telemetry

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"
)

// HealthVar names where a host or shared egress answers health checks. Without it, nothing listens.
const HealthVar = "SPOTLIGHT_HEALTH_ADDR"

const readyWithin = 2 * time.Second

type ReadyFunc func(ctx context.Context) error

func HealthHandler(ready ReadyFunc) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = fmt.Fprintln(w, "ok")
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		checking, cancel := context.WithTimeout(r.Context(), readyWithin)
		defer cancel()

		if err := ready(checking); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = fmt.Fprintln(w, err.Error())
			return
		}
		_, _ = fmt.Fprintln(w, "ready")
	})
	return mux
}

// ServeHealth answers until ctx ends. It opens no port when addr is empty.
func ServeHealth(ctx context.Context, addr string, ready ReadyFunc, log *slog.Logger) error {
	if addr == "" {
		return nil
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen for health checks: %w", err)
	}

	server := &http.Server{Handler: HealthHandler(ready), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		stopping, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Second)
		defer cancel()
		_ = server.Shutdown(stopping)
	}()
	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Warn("health checks stopped", "error", err)
		}
	}()

	log.Info("answers health checks", "listen", listener.Addr().String())
	return nil
}
