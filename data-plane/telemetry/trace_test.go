package telemetry

import (
	"context"
	"strings"
	"testing"
)

func TestTraceKeepsItsIDAcrossCalls(t *testing.T) {
	trace := NewTrace()
	first, second := trace.Traceparent(), trace.Traceparent()

	if first == second {
		t.Fatalf("two calls share the span of %q", first)
	}
	for _, header := range []string{first, second} {
		read, ok := TraceOf(header)
		if !ok || read.ID() != trace.ID() {
			t.Errorf("TraceOf(%q) = %v, %v, want trace %s", header, read, ok, trace.ID())
		}
	}
}

func TestTraceOfRejectsWhatIsNoTraceparent(t *testing.T) {
	for _, header := range []string{
		"",
		"not-a-traceparent",
		"00-" + zeroTraceID + "-00f067aa0ba902b7-01",
		"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01 rogue",
	} {
		if _, ok := TraceOf(header); ok {
			t.Errorf("TraceOf(%q) took it as a trace", header)
		}
	}
}

func TestTraceOfContinuesTheTraceItIsGiven(t *testing.T) {
	trace, ok := TraceOf("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00")
	if !ok || trace.ID() != "4bf92f3577b34da6a3ce929d0e0e4736" {
		t.Fatalf("TraceOf = %v, %v", trace, ok)
	}
	if !strings.HasSuffix(trace.Traceparent(), "-00") {
		t.Errorf("Traceparent() = %q, want the flags it was given", trace.Traceparent())
	}
}

func TestTraceTravelsInTheContext(t *testing.T) {
	trace := NewTrace()

	if _, ok := TraceFrom(context.Background()); ok {
		t.Fatal("found a trace in an empty context")
	}
	if got, ok := TraceFrom(WithTrace(context.Background(), trace)); !ok || got != trace {
		t.Errorf("TraceFrom = %v, %v, want %v", got, ok, trace)
	}
}

func TestSampledFollowsTheStandardSampler(t *testing.T) {
	cases := []struct {
		sampler, arg string
		draw         float64
		want         bool
	}{
		{"", "", 0.9, true},
		{"parentbased_always_on", "", 0.9, true},
		{"always_off", "", 0.1, false},
		{"parentbased_always_off", "", 0.1, false},
		{"parentbased_traceidratio", "0.1", 0.05, true},
		{"parentbased_traceidratio", "0.1", 0.5, false},
		{"traceidratio", "not-a-number", 0.99, true},
	}
	for _, c := range cases {
		if got := sampled(c.sampler, c.arg, c.draw); got != c.want {
			t.Errorf("sampled(%q, %q, %v) = %v, want %v", c.sampler, c.arg, c.draw, got, c.want)
		}
	}
}

func TestNewTraceIsNotSampledWhenTheSamplerIsOff(t *testing.T) {
	SampleAs("always_off", "")
	t.Cleanup(func() { SampleAs("", "") })

	if header := NewTrace().Traceparent(); !strings.HasSuffix(header, "-00") {
		t.Errorf("Traceparent() = %q, want the unsampled flags", header)
	}
}
