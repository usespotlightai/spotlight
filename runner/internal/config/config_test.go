package config_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/runner/internal/config"
)

func setRequired(t *testing.T) {
	t.Helper()

	for _, name := range []string{
		"SPOTLIGHT_URL", "SPOTLIGHT_TOKEN", "SPOTLIGHT_WORKSPACE",
		"SPOTLIGHT_MAX_RUNS",
		"SPOTLIGHT_IDLE_TIMEOUT", "SPOTLIGHT_RETIRE_AT", "SPOTLIGHT_AGENT_USER",
		"SPOTLIGHT_RUNNER_OIDC_TOKEN_FILE", "SPOTLIGHT_RUNNER_TRUST", "SPOTLIGHT_RUNNER_NAME",
		"SPOTLIGHT_POOL_TOKEN", "SPOTLIGHT_ONCE",
	} {
		t.Setenv(name, "")
	}

	t.Setenv("SPOTLIGHT_CONFIG", filepath.Join(t.TempDir(), "runner.env"))

	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_TOKEN", "tok")
}

func TestLoadReadsTheWholeSurface(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_WORKSPACE", "/work")
	t.Setenv("SPOTLIGHT_MAX_RUNS", "1")
	t.Setenv("SPOTLIGHT_IDLE_TIMEOUT", "30m")
	t.Setenv("SPOTLIGHT_RETIRE_AT", "1700000000")

	cfg, err := config.Load(nil)
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

	cfg, err := config.Load(nil)
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

	_, err := config.Load(nil)
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

			if _, err := config.Load(nil); err == nil {
				t.Fatalf("expected %s=%q to be rejected", env.key, env.value)
			}
		})
	}
}

func TestLoadDefaultWorkspaceRootIsACleanPath(t *testing.T) {
	setRequired(t)

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.WorkspaceRoot != filepath.Clean(cfg.WorkspaceRoot) {
		t.Errorf("workspace root is not clean: %q", cfg.WorkspaceRoot)
	}
}

func TestLoadFallsBackToThePersistedFile(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_URL", "")
	t.Setenv("SPOTLIGHT_TOKEN", "")
	t.Setenv("SPOTLIGHT_CONFIG", filepath.Join(t.TempDir(), "runner.env"))

	if err := config.Merge(map[string]string{
		"SPOTLIGHT_URL":   "https://saved.test",
		"SPOTLIGHT_TOKEN": "saved-tok",
	}); err != nil {
		t.Fatalf("merge: %v", err)
	}

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.URL != "https://saved.test" || cfg.Token != "saved-tok" {
		t.Errorf("did not read the file: url %q, token %q", cfg.URL, cfg.Token)
	}
}

func TestLoadLetsTheEnvironmentWinOverTheFile(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_CONFIG", filepath.Join(t.TempDir(), "runner.env"))

	if err := config.Merge(map[string]string{"SPOTLIGHT_URL": "https://saved.test"}); err != nil {
		t.Fatalf("merge: %v", err)
	}
	t.Setenv("SPOTLIGHT_URL", "https://env.test")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.URL != "https://env.test" {
		t.Errorf("environment did not win: %q", cfg.URL)
	}
}

func TestMergeKeepsWhatItIsNotChanging(t *testing.T) {
	t.Setenv("SPOTLIGHT_CONFIG", filepath.Join(t.TempDir(), "runner.env"))

	if err := config.Merge(map[string]string{"SPOTLIGHT_URL": "https://saved.test"}); err != nil {
		t.Fatalf("first merge: %v", err)
	}
	if err := config.Merge(map[string]string{"SPOTLIGHT_TOKEN": "saved-tok"}); err != nil {
		t.Fatalf("second merge: %v", err)
	}

	saved, err := config.Read()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if saved["SPOTLIGHT_URL"] != "https://saved.test" || saved["SPOTLIGHT_TOKEN"] != "saved-tok" {
		t.Errorf("merge lost a value: %+v", saved)
	}
}

func TestLoadEnrolsAsAWorkloadWithNoToken(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_TOKEN", "")
	t.Setenv("SPOTLIGHT_RUNNER_OIDC_TOKEN_FILE", "/var/run/secrets/spotlight/token")
	t.Setenv("SPOTLIGHT_RUNNER_TRUST", "trust_1")
	t.Setenv("SPOTLIGHT_RUNNER_NAME", "pod-a")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !cfg.Workload.Enrols() || cfg.Workload.Trust != "trust_1" || cfg.Workload.Name != "pod-a" {
		t.Errorf("workload %+v", cfg.Workload)
	}
}

func TestLoadNamesAWorkloadAfterItsHost(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_TOKEN", "")
	t.Setenv("SPOTLIGHT_RUNNER_OIDC_TOKEN_FILE", "/var/run/secrets/spotlight/token")
	t.Setenv("SPOTLIGHT_RUNNER_TRUST", "trust_1")
	t.Setenv("SPOTLIGHT_RUNNER_NAME", "")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if host, _ := os.Hostname(); cfg.Workload.Name != host {
		t.Errorf("named %q, not %q", cfg.Workload.Name, host)
	}
}

func TestLoadRefusesAWorkloadWithNoTrust(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_TOKEN", "")
	t.Setenv("SPOTLIGHT_RUNNER_OIDC_TOKEN_FILE", "/var/run/secrets/spotlight/token")
	t.Setenv("SPOTLIGHT_RUNNER_TRUST", "")

	if _, err := config.Load(nil); err == nil || !strings.Contains(err.Error(), "SPOTLIGHT_RUNNER_TRUST") {
		t.Fatalf("expected the missing trust named, got %v", err)
	}
}

func TestLoadRefusesBothWaysToEnrol(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_RUNNER_OIDC_TOKEN_FILE", "/var/run/secrets/spotlight/token")
	t.Setenv("SPOTLIGHT_RUNNER_TRUST", "trust_1")

	if _, err := config.Load(nil); err == nil {
		t.Fatal("expected a token and a workload token file together to be refused")
	}
}

func TestLoadServesOnceWhenAskedByFlag(t *testing.T) {
	setRequired(t)

	cfg, err := config.Load([]string{"--once"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !cfg.Once {
		t.Error("expected once mode")
	}
	if cfg.IdleTimeout != 5*time.Minute {
		t.Errorf("idle timeout %v, want five minutes by default when serving once", cfg.IdleTimeout)
	}
}

func TestLoadServesOnceWhenAskedByTheEnvironment(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_ONCE", "true")
	t.Setenv("SPOTLIGHT_IDLE_TIMEOUT", "30s")

	cfg, err := config.Load(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !cfg.Once || cfg.IdleTimeout != 30*time.Second {
		t.Errorf("once %v, idle timeout %v", cfg.Once, cfg.IdleTimeout)
	}
}

func TestLoadRefusesWhatItCannotRead(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_ONCE", "sometimes")

	if _, err := config.Load(nil); err == nil || !strings.Contains(err.Error(), "SPOTLIGHT_ONCE") {
		t.Fatalf("expected SPOTLIGHT_ONCE named, got %v", err)
	}

	t.Setenv("SPOTLIGHT_ONCE", "")
	for _, args := range [][]string{{"--twice"}, {"serve"}} {
		if _, err := config.Load(args); err == nil || !strings.Contains(err.Error(), "--once") {
			t.Errorf("%v: expected usage, got %v", args, err)
		}
	}
}

func TestLoadClaimsFromAPoolOnce(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_TOKEN", "")
	t.Setenv("SPOTLIGHT_POOL_TOKEN", "pool-tok")

	cfg, err := config.Load([]string{"--once"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.PoolToken != "pool-tok" || cfg.Token != "" {
		t.Errorf("pool token %q, token %q", cfg.PoolToken, cfg.Token)
	}
}

func TestLoadRefusesAPoolTokenThatWouldServeForever(t *testing.T) {
	setRequired(t)
	t.Setenv("SPOTLIGHT_TOKEN", "")
	t.Setenv("SPOTLIGHT_POOL_TOKEN", "pool-tok")

	if _, err := config.Load(nil); err == nil || !strings.Contains(err.Error(), "--once") {
		t.Fatalf("expected once mode asked for, got %v", err)
	}
}

func TestLoadRefusesAPoolTokenBesideAnotherCredential(t *testing.T) {
	for name, env := range map[string]struct{ key, value string }{
		"token":    {"SPOTLIGHT_TOKEN", "tok"},
		"workload": {"SPOTLIGHT_RUNNER_OIDC_TOKEN_FILE", "/var/run/secrets/spotlight/token"},
	} {
		t.Run(name, func(t *testing.T) {
			setRequired(t)
			t.Setenv("SPOTLIGHT_TOKEN", "")
			t.Setenv("SPOTLIGHT_RUNNER_TRUST", "trust_1")
			t.Setenv("SPOTLIGHT_POOL_TOKEN", "pool-tok")
			t.Setenv(env.key, env.value)

			_, err := config.Load([]string{"--once"})
			if err == nil {
				t.Fatal("expected two credentials to be refused")
			}
			for _, want := range []string{"SPOTLIGHT_POOL_TOKEN", env.key} {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("error does not name %s: %v", want, err)
				}
			}
		})
	}
}
