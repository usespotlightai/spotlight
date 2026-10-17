package telemetry

import (
	"testing"

	"github.com/getsentry/sentry-go"
)

func TestReportsNoCredentialsOrQueryStringsOfURLs(t *testing.T) {
	event := scrubbed(&sentry.Event{
		Message: "GET https://egress.test/secrets?token=secret failed",
		Exception: []sentry.Exception{{
			Value: "clone https://x-access-token:ghs_secret@github.com/acme/app.git?ref=main: refused",
		}},
	}, nil)

	if event.Message != "GET https://egress.test/secrets failed" {
		t.Errorf("message %q", event.Message)
	}
	if got := event.Exception[0].Value; got != "clone https://github.com/acme/app.git refused" {
		t.Errorf("exception %q", got)
	}
}
