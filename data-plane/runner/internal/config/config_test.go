package config_test

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/runner/internal/config"
)

func setRequired(t *testing.T) {
	t.Helper()

	for _, name := range []string{
		"SPOTLIGHT_URL", "SPOTLIGHT_TOKEN", "SPOTLIGHT_HANDED", "SPOTLIGHT_WORKSPACE",
		"SPOTLIGHT_AGENT_USER", "SPOTLIGHT_PREPARE_HOOK", "SPOTLIGHT_PUBLISH_HOOK",
		"SPOTLIGHT_HOOK_TIMEOUT",
	} {
		t.Setenv(name, "")
	}

	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_HANDED", "/run/spotlight/handed.json")
}

func TestLoadReadsTheWholeSurface(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_WORKSPACE", "/work")
	t.Setenv("SPOTLIGHT_AGENT_USER", "agent")
	t.Setenv("SPOTLIGHT_HOOK_TIMEOUT", "30m")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !cfg.WasHanded() || cfg.Handed != "/run/spotlight/handed.json" {
		t.Errorf("handed %q", cfg.Handed)
	}
	if cfg.WorkspaceRoot != "/work" || cfg.AgentUser != "agent" {
		t.Errorf("workspace %q, agent %q", cfg.WorkspaceRoot, cfg.AgentUser)
	}
	if cfg.HookTimeout != 30*time.Minute {
		t.Errorf("hook timeout %v", cfg.HookTimeout)
	}
}

func TestLoadTakesAPushPoolsOneRunCredential(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_HANDED", "")
	t.Setenv("SPOTLIGHT_TOKEN", "one-run")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.WasHanded() || cfg.Token != "one-run" {
		t.Errorf("got %+v", cfg)
	}
}

func TestLoadRefusesBothWaysToBeGivenWork(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_TOKEN", "one-run")

	_, err := config.Load(nil)
	if err == nil || !strings.Contains(err.Error(), "give one") {
		t.Fatalf("expected both named, got %v", err)
	}
}

func TestLoadReportsEveryProblemAtOnce(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_URL", "")
	t.Setenv("SPOTLIGHT_HANDED", "")

	_, err := config.Load(nil)
	if err == nil {
		t.Fatal("expected an error")
	}

	for _, want := range []string{"SPOTLIGHT_URL", "SPOTLIGHT_HANDED", "SPOTLIGHT_TOKEN"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error does not mention %s: %v", want, err)
		}
	}
}

func TestLoadRefusesAMalformedHookTimeout(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_HOOK_TIMEOUT", "soon")

	if _, err := config.Load(nil); err == nil || !strings.Contains(err.Error(), "SPOTLIGHT_HOOK_TIMEOUT") {
		t.Fatalf("expected SPOTLIGHT_HOOK_TIMEOUT named, got %v", err)
	}
}

func TestLoadRefusesAHookThatIsNotAFile(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_PREPARE_HOOK", t.TempDir())

	if _, err := config.Load(nil); err == nil || !strings.Contains(err.Error(), "SPOTLIGHT_PREPARE_HOOK") {
		t.Fatalf("expected SPOTLIGHT_PREPARE_HOOK named, got %v", err)
	}
}

func TestLoadDefaultWorkspaceRootIsACleanPath(t *testing.T) {
	setRequired(t)

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.WorkspaceRoot == "" || cfg.WorkspaceRoot != filepath.Clean(cfg.WorkspaceRoot) {
		t.Errorf("workspace root is not clean: %q", cfg.WorkspaceRoot)
	}
}

func TestLoadRefusesArguments(t *testing.T) {
	setRequired(t)

	for _, args := range [][]string{{"--once"}, {"serve"}} {
		if _, err := config.Load(args); err == nil || !strings.Contains(err.Error(), "usage") {
			t.Errorf("%v: expected usage, got %v", args, err)
		}
	}
}
