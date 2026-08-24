package config_test

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/runner/internal/config"
)

// setRequired clears every SPOTLIGHT_ var first, so the tests do not pick up
// whatever the surrounding environment happens to set.
func setRequired(t *testing.T) {
	t.Helper()

	for _, name := range []string{
		"SPOTLIGHT_URL", "SPOTLIGHT_TOKEN", "SPOTLIGHT_WORKSPACE",
		"SPOTLIGHT_MAX_RUNS",
		"SPOTLIGHT_IDLE_TIMEOUT", "SPOTLIGHT_RETIRE_AT", "SPOTLIGHT_AGENT_USER",
	} {
		t.Setenv(name, "")
	}

	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_TOKEN", "tok")
}

func TestLoadReadsTheWholeSurface(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_WORKSPACE", "/work")
	t.Setenv("SPOTLIGHT_MAX_RUNS", "1")
	t.Setenv("SPOTLIGHT_IDLE_TIMEOUT", "30m")
	t.Setenv("SPOTLIGHT_RETIRE_AT", "1700000000")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.WorkspaceRoot != "/work" || cfg.MaxRuns != 1 {
		t.Errorf("workspace %q, maxRuns %d", cfg.WorkspaceRoot, cfg.MaxRuns)
	}
	if cfg.IdleTimeout != 30*time.Minute {
		t.Errorf("idle timeout %v", cfg.IdleTimeout)
	}
	if got := cfg.RetireAt.Unix(); got != 1700000000 {
		t.Errorf("retire at %d", got)
	}
}

func TestLoadDefaultsToServingForever(t *testing.T) {
	setRequired(t)

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.MaxRuns != 0 || cfg.IdleTimeout != 0 || !cfg.RetireAt.IsZero() {
		t.Errorf("expected no limits, got %+v", cfg)
	}
	if cfg.WorkspaceRoot == "" {
		t.Error("expected a default workspace root")
	}
}

func TestLoadReportsEveryProblemAtOnce(t *testing.T) {
	t.Setenv("SPOTLIGHT_URL", "")
	t.Setenv("SPOTLIGHT_TOKEN", "")

	_, err := config.Load()
	if err == nil {
		t.Fatal("expected an error")
	}

	for _, want := range []string{"SPOTLIGHT_URL", "SPOTLIGHT_TOKEN"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error does not mention %s: %v", want, err)
		}
	}
}

func TestLoadRejectsMalformedValues(t *testing.T) {
	for name, env := range map[string]struct{ key, value string }{
		"runs":   {"SPOTLIGHT_MAX_RUNS", "-1"},
		"idle":   {"SPOTLIGHT_IDLE_TIMEOUT", "soon"},
		"retire": {"SPOTLIGHT_RETIRE_AT", "tomorrow"},
	} {
		t.Run(name, func(t *testing.T) {
			setRequired(t)
			t.Setenv(env.key, env.value)

			if _, err := config.Load(); err == nil {
				t.Fatalf("expected %s=%q to be rejected", env.key, env.value)
			}
		})
	}
}

func TestLoadDefaultWorkspaceRootIsACleanPath(t *testing.T) {
	setRequired(t)

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.WorkspaceRoot != filepath.Clean(cfg.WorkspaceRoot) {
		t.Errorf("workspace root is not clean: %q", cfg.WorkspaceRoot)
	}
}
