package telemetry

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

const (
	flushTimeout  = 2 * time.Second
	maxErrorDepth = 10
)

type Session struct {
	on bool
}

func Start(role, version string) Session {
	if os.Getenv("SENTRY_DSN") == "" {
		return Session{}
	}

	err := sentry.Init(sentry.ClientOptions{
		Release:          version,
		AttachStacktrace: true,
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

func Handler(next slog.Handler) slog.Handler {
	return issues{next}
}

type issues struct {
	slog.Handler
}

func (h issues) Handle(ctx context.Context, record slog.Record) error {
	if record.Level >= slog.LevelError {
		report(record)
	}

	return h.Handler.Handle(ctx, record)
}

func (h issues) WithAttrs(attrs []slog.Attr) slog.Handler {
	return issues{h.Handler.WithAttrs(attrs)}
}

func (h issues) WithGroup(name string) slog.Handler {
	return issues{h.Handler.WithGroup(name)}
}

func report(record slog.Record) {
	hub := sentry.CurrentHub()
	if hub.Client() == nil {
		return
	}

	event := sentry.NewEvent()
	event.Level = sentry.LevelError
	event.Message = record.Message
	attrs := map[string]any{}

	var cause error
	record.Attrs(func(attr slog.Attr) bool {
		if err, ok := attr.Value.Any().(error); ok && cause == nil {
			cause = err
		}
		attrs[attr.Key] = attr.Value.String()
		return true
	})

	if cause == nil {
		cause = errors.New(record.Message)
	}

	event.SetException(cause, maxErrorDepth)
	for _, exception := range event.Exception {
		trimLogging(exception.Stacktrace)
	}
	event.Contexts["log"] = attrs

	hub.CaptureEvent(event)
}

func trimLogging(stack *sentry.Stacktrace) {
	if stack == nil {
		return
	}

	frames := stack.Frames
	for len(frames) > 0 && logging(frames[len(frames)-1].Module) {
		frames = frames[:len(frames)-1]
	}
	stack.Frames = frames
}

func logging(module string) bool {
	return module == "log/slog" || module == "usespotlight.ai/data-plane/telemetry"
}
