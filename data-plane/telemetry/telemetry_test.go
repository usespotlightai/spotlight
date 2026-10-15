package telemetry_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/getsentry/sentry-go"
	"usespotlight.ai/data-plane/telemetry"
)

func sent(t *testing.T) *sentry.MockTransport {
	t.Helper()

	transport := &sentry.MockTransport{}
	client, err := sentry.NewClient(sentry.ClientOptions{
		Dsn:         "https://key@sentry.invalid/1",
		Release:     "v1.2.3",
		Environment: "staging",
		Transport:   transport,
	})
	if err != nil {
		t.Fatal(err)
	}

	previous := sentry.CurrentHub().Client()
	sentry.CurrentHub().BindClient(client)
	t.Cleanup(func() { sentry.CurrentHub().BindClient(previous) })

	return transport
}

func TestReportsAnErrorWithItsTagsReleaseEnvironmentTraceAndCaller(t *testing.T) {
	transport := sent(t)

	telemetry.Report(errors.New("the sandbox did not start"), telemetry.Tags{"run": "run-1", "runner": "", "host": "host-1"})

	events := transport.Events()
	if len(events) != 1 {
		t.Fatalf("sent %d events", len(events))
	}

	event := events[0]
	if got := event.Exception[len(event.Exception)-1].Value; got != "the sandbox did not start" {
		t.Errorf("exception %q", got)
	}
	if event.Tags["run"] != "run-1" || event.Tags["host"] != "host-1" {
		t.Errorf("tags %v", event.Tags)
	}
	if _, ok := event.Tags["runner"]; ok {
		t.Errorf("an empty tag was sent: %v", event.Tags)
	}
	if event.Release != "v1.2.3" || event.Environment != "staging" {
		t.Errorf("release %q, environment %q", event.Release, event.Environment)
	}
	if trace, ok := event.Contexts["trace"]; !ok || trace["trace_id"] == "" {
		t.Errorf("no trace id: %v", event.Contexts["trace"])
	}

	frames := event.Exception[len(event.Exception)-1].Stacktrace.Frames
	if top := frames[len(frames)-1]; !strings.HasPrefix(top.Function, "TestReportsAnError") {
		t.Errorf("top frame %s.%s", top.Module, top.Function)
	}
}

func TestStartsNothingWithoutADSN(t *testing.T) {
	t.Setenv("SENTRY_DSN", "")
	previous := sentry.CurrentHub().Client()
	sentry.CurrentHub().BindClient(nil)
	t.Cleanup(func() { sentry.CurrentHub().BindClient(previous) })

	session := telemetry.Start("runner", "v1")
	defer session.Stop()
	telemetry.Report(errors.New("lost"), nil)

	if sentry.CurrentHub().Client().IsEnabled() {
		t.Fatal("a Sentry client was started without a DSN")
	}
}

func TestReportsAPanicAndPanicsAgain(t *testing.T) {
	transport := sent(t)
	t.Setenv("SENTRY_DSN", "https://key@sentry.invalid/1")

	defer func() {
		if recover() == nil {
			t.Fatal("the panic was swallowed")
		}
		if events := transport.Events(); len(events) != 1 {
			t.Fatalf("sent %d events", len(events))
		}
	}()

	func() {
		defer stopped(t)()
		panic("the runner broke")
	}()
}

func stopped(t *testing.T) func() {
	t.Helper()
	t.Setenv("SPOTLIGHT_SENTRY_DSN", "https://key@sentry.invalid/1")
	client := sentry.CurrentHub().Client()
	session := telemetry.Start("runner", "v1")
	sentry.CurrentHub().BindClient(client)
	return session.Stop
}

func TestOnlyTheHostReadsSentryDSNAndOthersReadWhatTheHostPassed(t *testing.T) {
	previous := sentry.CurrentHub().Client()
	t.Cleanup(func() { sentry.CurrentHub().BindClient(previous) })
	t.Setenv("SENTRY_DSN", "https://customer@sentry.invalid/9")
	t.Setenv("SPOTLIGHT_SENTRY_DSN", "")

	sentry.CurrentHub().BindClient(nil)
	telemetry.Start("runner", "v1")
	if sentry.CurrentHub().Client().IsEnabled() {
		t.Fatal("a runner reported to the DSN of the code it runs")
	}

	telemetry.Start("host", "v1")
	if got := sentry.CurrentHub().Client().Options().Dsn; got != "https://customer@sentry.invalid/9" {
		t.Fatalf("host DSN %q", got)
	}
}
