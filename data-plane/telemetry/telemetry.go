package telemetry

import (
	"os"
	"regexp"
	"time"

	"github.com/getsentry/sentry-go"
)

const (
	flushTimeout  = 2 * time.Second
	maxErrorDepth = 10
	module        = "usespotlight.ai/data-plane/telemetry"
)

// Passed maps each variable of the host to the variable it is passed as.
// The SPOTLIGHT_ prefix keeps it from the agent and from customer code.
var Passed = map[string]string{
	"LOG_LEVEL":          "SPOTLIGHT_LOG_LEVEL",
	"SENTRY_DSN":         "SPOTLIGHT_SENTRY_DSN",
	"SENTRY_ENVIRONMENT": "SPOTLIGHT_SENTRY_ENVIRONMENT",
}

var (
	credentials = regexp.MustCompile(`://[^/\s@]+@`)
	queries     = regexp.MustCompile(`(https?://[^\s?#]+)[?#][^\s]*`)
)

type Session struct {
	on bool
}

func Start(role, version string) Session {
	dsn, environment := settings(role)
	if dsn == "" {
		return Session{}
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:            dsn,
		Environment:    environment,
		Release:        version,
		SendDefaultPII: false,
		BeforeSend:     scrubbed,
	})
	if err != nil {
		return Session{}
	}

	sentry.ConfigureScope(func(scope *sentry.Scope) {
		scope.SetTag("role", role)
	})

	return Session{on: true}
}

// Stop must be deferred directly, because it recovers a panic to report it.
func (s Session) Stop() {
	if !s.on {
		return
	}

	if r := recover(); r != nil {
		sentry.CurrentHub().Recover(r)
		sentry.Flush(flushTimeout)
		panic(r)
	}

	sentry.Flush(flushTimeout)
}

func settings(role string) (dsn, environment string) {
	if role == "host" {
		return os.Getenv("SENTRY_DSN"), os.Getenv("SENTRY_ENVIRONMENT")
	}
	return os.Getenv(Passed["SENTRY_DSN"]), os.Getenv(Passed["SENTRY_ENVIRONMENT"])
}

func scrubbed(event *sentry.Event, _ *sentry.EventHint) *sentry.Event {
	event.Message = scrub(event.Message)
	for i := range event.Exception {
		event.Exception[i].Value = scrub(event.Exception[i].Value)
	}
	return event
}

func scrub(text string) string {
	return queries.ReplaceAllString(credentials.ReplaceAllString(text, "://"), "$1")
}

type Tags map[string]string

func Report(err error, tags Tags) {
	hub := sentry.CurrentHub()
	if err == nil || !hub.Client().IsEnabled() {
		return
	}

	event := sentry.NewEvent()
	event.Level = sentry.LevelError
	event.SetException(err, maxErrorDepth)
	for _, exception := range event.Exception {
		trimOwn(exception.Stacktrace)
	}

	hub.WithScope(func(scope *sentry.Scope) {
		for key, value := range tags {
			if value != "" {
				scope.SetTag(key, value)
			}
		}
		hub.CaptureEvent(event)
	})
}

func trimOwn(stack *sentry.Stacktrace) {
	if stack == nil {
		return
	}

	frames := stack.Frames
	for len(frames) > 0 && frames[len(frames)-1].Module == module {
		frames = frames[:len(frames)-1]
	}
	stack.Frames = frames
}
