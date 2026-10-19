package telemetry

import (
	"io"
	"log/slog"
	"os"
	"strings"
)

const levelSilent = slog.Level(16)

// NewLogger writes JSON lines at the level that LOG_LEVEL names, as the control plane does.
func NewLogger(role string, out io.Writer) *slog.Logger {
	return NewLoggerAt(levelSetting(role), out)
}

func NewLoggerAt(setting string, out io.Writer) *slog.Logger {
	return slog.New(slog.NewJSONHandler(out, &slog.HandlerOptions{Level: LevelOf(setting)}))
}

func levelSetting(role string) string {
	if role == "host" {
		return os.Getenv("LOG_LEVEL")
	}
	return os.Getenv(Passed["LOG_LEVEL"])
}

func LevelOf(setting string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(setting)) {
	case "trace", "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error", "fatal":
		return slog.LevelError
	case "silent":
		return levelSilent
	default:
		return slog.LevelInfo
	}
}
