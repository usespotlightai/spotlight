package telemetry_test

import (
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/getsentry/sentry-go"
	"usespotlight.ai/data-plane/telemetry"
)

func sent(t *testing.T) *sentry.MockTransport {
	t.Helper()

	transport := &sentry.MockTransport{}
	client, err := sentry.NewClient(sentry.ClientOptions{Dsn: "https://key@sentry.invalid/1", Transport: transport})
	if err != nil {
		t.Fatal(err)
	}

	previous := sentry.CurrentHub().Client()
	sentry.CurrentHub().BindClient(client)
	t.Cleanup(func() { sentry.CurrentHub().BindClient(previous) })

	return transport
}

func TestReportsAnErrorRecordWithItsCauseAndCaller(t *testing.T) {
	transport := sent(t)
	log := slog.New(telemetry.Handler(slog.NewJSONHandler(io.Discard, nil)))

	log.Error("could not start a sandbox", "image", "abc", "error", errors.New("pull refused"))

	events := transport.Events()
	if len(events) != 1 {
		t.Fatalf("sent %d events", len(events))
	}

	event := events[0]
	if event.Message != "could not start a sandbox" {
		t.Errorf("message %q", event.Message)
	}
	if got := event.Exception[len(event.Exception)-1].Value; got != "pull refused" {
		t.Errorf("exception %q", got)
	}
	if got := event.Contexts["log"]["image"]; got != "abc" {
		t.Errorf("image attribute %v", got)
	}

	frames := event.Exception[len(event.Exception)-1].Stacktrace.Frames
	if top := frames[len(frames)-1]; !strings.HasPrefix(top.Function, "TestReportsAnErrorRecord") {
		t.Errorf("top frame %s.%s", top.Module, top.Function)
	}
}

func TestReportsNothingBelowTheErrorLevel(t *testing.T) {
	transport := sent(t)
	log := slog.New(telemetry.Handler(slog.NewJSONHandler(io.Discard, nil)))

	log.Warn("the claim was slow", "error", errors.New("timeout"))

	if events := transport.Events(); len(events) != 0 {
		t.Fatalf("sent %d events", len(events))
	}
}
