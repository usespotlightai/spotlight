package telemetry

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	mathrand "math/rand/v2"
	"os"
	"regexp"
	"strconv"
	"strings"
)

// TraceparentVar carries the trace of a claim into its sandbox. The prefix keeps it from the agent.
const TraceparentVar = "SPOTLIGHT_TRACEPARENT"

var traceparent = regexp.MustCompile(`^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$`)

const zeroTraceID = "00000000000000000000000000000000"

// Trace is a W3C trace that the data plane continues on each call to the control plane.
type Trace struct {
	id    string
	flags string
}

// NewTrace samples the trace as OTEL_TRACES_SAMPLER and OTEL_TRACES_SAMPLER_ARG say, like the control plane.
func NewTrace() Trace {
	flags := "00"
	if sampled(os.Getenv("OTEL_TRACES_SAMPLER"), os.Getenv("OTEL_TRACES_SAMPLER_ARG"), mathrand.Float64()) {
		flags = "01"
	}
	return Trace{id: randomHex(16), flags: flags}
}

func sampled(sampler, arg string, draw float64) bool {
	switch strings.TrimSpace(sampler) {
	case "always_off", "parentbased_always_off":
		return false
	case "traceidratio", "parentbased_traceidratio":
		ratio, err := strconv.ParseFloat(strings.TrimSpace(arg), 64)
		if err != nil {
			ratio = 1
		}
		return draw < ratio
	default:
		return true
	}
}

func TraceOf(header string) (Trace, bool) {
	parts := traceparent.FindStringSubmatch(strings.TrimSpace(header))
	if parts == nil || parts[1] == zeroTraceID {
		return Trace{}, false
	}
	return Trace{id: parts[1], flags: parts[3]}, true
}

func (t Trace) ID() string { return t.id }

// Traceparent names a new span on each call, so that the control plane sees each call as its own child.
func (t Trace) Traceparent() string {
	return "00-" + t.id + "-" + randomHex(8) + "-" + t.flags
}

type traceKey struct{}

func WithTrace(ctx context.Context, trace Trace) context.Context {
	return context.WithValue(ctx, traceKey{}, trace)
}

func TraceFrom(ctx context.Context) (Trace, bool) {
	trace, ok := ctx.Value(traceKey{}).(Trace)
	return trace, ok
}

func randomHex(size int) string {
	bytes := make([]byte, size)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
