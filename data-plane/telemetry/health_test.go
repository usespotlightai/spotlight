package telemetry

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthHandlerAnswersLivenessAndReadiness(t *testing.T) {
	var failing error
	server := httptest.NewServer(HealthHandler(func(context.Context) error { return failing }))
	defer server.Close()

	status := func(path string) (int, string) {
		response, err := http.Get(server.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		body, _ := io.ReadAll(response.Body)
		return response.StatusCode, strings.TrimSpace(string(body))
	}

	if code, _ := status("/healthz"); code != http.StatusOK {
		t.Errorf("/healthz = %d", code)
	}
	if code, _ := status("/readyz"); code != http.StatusOK {
		t.Errorf("/readyz when ready = %d", code)
	}

	failing = errors.New("no heartbeat to Spotlight for 2m0s")
	if code, body := status("/readyz"); code != http.StatusServiceUnavailable || body != failing.Error() {
		t.Errorf("/readyz when not ready = %d %q", code, body)
	}
	if code, _ := status("/healthz"); code != http.StatusOK {
		t.Errorf("/healthz when not ready = %d", code)
	}
}

func TestServeHealthOpensNoPortWithoutAnAddress(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := ServeHealth(context.Background(), "", nil, log); err != nil {
		t.Fatal(err)
	}
}
