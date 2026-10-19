package telemetry

import (
	"bytes"
	"log/slog"
	"strings"
	"testing"
)

func TestLevelOf(t *testing.T) {
	cases := map[string]slog.Level{
		"":        slog.LevelInfo,
		"info":    slog.LevelInfo,
		"DEBUG":   slog.LevelDebug,
		"trace":   slog.LevelDebug,
		"warn":    slog.LevelWarn,
		"error":   slog.LevelError,
		"fatal":   slog.LevelError,
		"silent":  levelSilent,
		"verbose": slog.LevelInfo,
	}
	for setting, want := range cases {
		if got := LevelOf(setting); got != want {
			t.Errorf("LevelOf(%q) = %v, want %v", setting, got, want)
		}
	}
}

func TestNewLoggerReadsTheLevelOfItsRole(t *testing.T) {
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("SPOTLIGHT_LOG_LEVEL", "error")

	var host, runner bytes.Buffer
	NewLogger("host", &host).Debug("claimed")
	NewLogger("runner", &runner).Warn("slow")

	if !strings.Contains(host.String(), `"msg":"claimed"`) {
		t.Errorf("host at LOG_LEVEL=debug wrote %q", host.String())
	}
	if runner.Len() != 0 {
		t.Errorf("runner at SPOTLIGHT_LOG_LEVEL=error wrote %q", runner.String())
	}
}
