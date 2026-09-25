package config_test

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/host/internal/config"
	"usespotlight.ai/data-plane/host/internal/trust"
)

func isolated(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	for _, name := range []string{
		"SPOTLIGHT_URL", "SPOTLIGHT_TOKEN", "SPOTLIGHT_TRUST", "SPOTLIGHT_OIDC_TOKEN_FILE",
		"SPOTLIGHT_CAPACITY", "SPOTLIGHT_RUNNER_IMAGE", "SPOTLIGHT_RUN_TIMEOUT", "SPOTLIGHT_SANDBOX_URL",
		"SPOTLIGHT_SANDBOX_ENV", "SPOTLIGHT_SANDBOX_NETWORK", "SPOTLIGHT_SANDBOX_HOSTS", "SPOTLIGHT_STATE",
		"SPOTLIGHT_HOST_NAME", "DOCKER_HOST", "SPOTLIGHT_SANDBOX_PASS",
	} {
		t.Setenv(name, "")
	}
	t.Setenv(config.EnvConfig, filepath.Join(dir, "host.env"))

	return dir
}

func write(t *testing.T, path, body string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestLoadsWhatTheInstallerWrote(t *testing.T) {
	dir := isolated(t)
	write(t, filepath.Join(dir, "host.env"), "SPOTLIGHT_URL=https://spotlight.test/\nSPOTLIGHT_TOKEN=pool-token\n")

	cfg, err := config.Load("v1.4.0")
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if cfg.URL != "https://spotlight.test" || cfg.SandboxURL != cfg.URL {
		t.Errorf("url %q, sandbox url %q", cfg.URL, cfg.SandboxURL)
	}
	if cfg.Credential() != control.Bearer("pool-token") {
		t.Errorf("credential %v", cfg.Credential())
	}
	if cfg.Capacity != 1 || cfg.RunTimeout != 6*time.Hour {
		t.Errorf("capacity %d, timeout %v", cfg.Capacity, cfg.RunTimeout)
	}
	if cfg.Images.Default != config.Image+":v1.4.0" || !cfg.Images.Admits(config.Image+":v1.4.0") {
		t.Errorf("images %+v: the runner image is pinned to the host's version", cfg.Images)
	}
	if cfg.Images.Admits("ghcr.io/acme/runner:main") {
		t.Error("a host with no allow-list serves only its default")
	}
	if cfg.State == "" || cfg.Name == "" {
		t.Errorf("state %q, name %q", cfg.State, cfg.Name)
	}
}

func TestTheEnvironmentWinsOverTheFile(t *testing.T) {
	dir := isolated(t)
	write(t, filepath.Join(dir, "host.env"), "SPOTLIGHT_URL=https://file.test\nSPOTLIGHT_TOKEN=pool-token\n")
	t.Setenv("SPOTLIGHT_URL", "https://env.test")
	t.Setenv("SPOTLIGHT_CAPACITY", "4")
	t.Setenv("SPOTLIGHT_RUNNER_IMAGE", "ghcr.io/acme/*, runner:claude-2, runner:codex-1")

	cfg, err := config.Load("dev")
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if cfg.URL != "https://env.test" || cfg.Capacity != 4 {
		t.Errorf("url %q, capacity %d", cfg.URL, cfg.Capacity)
	}
	if cfg.Images.Default != "runner:claude-2" {
		t.Errorf("default %q: the first exact image is the default", cfg.Images.Default)
	}
	for _, admitted := range []string{"runner:claude-2", "runner:codex-1", "ghcr.io/acme/api-runner:main"} {
		if !cfg.Images.Admits(admitted) {
			t.Errorf("%s is not admitted", admitted)
		}
	}
	if cfg.Images.Admits("ghcr.io/other/runner:main") {
		t.Error("an image no entry names is admitted")
	}
}

func TestClaimsThroughATrustWithAWorkloadToken(t *testing.T) {
	isolated(t)
	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_TRUST", "trust_1")
	t.Setenv("SPOTLIGHT_OIDC_TOKEN_FILE", "/var/run/secrets/token")

	cfg, err := config.Load("dev")
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if cfg.Credential() != (trust.Workload{Trust: "trust_1", TokenFile: "/var/run/secrets/token"}) {
		t.Errorf("credential %v", cfg.Credential())
	}
}

func TestRefusesAmbiguousOrMissingCredentials(t *testing.T) {
	for name, env := range map[string]map[string]string{
		"none":          {},
		"both":          {"SPOTLIGHT_TOKEN": "pool-token", "SPOTLIGHT_TRUST": "trust_1"},
		"trust no file": {"SPOTLIGHT_TRUST": "trust_1"},
	} {
		t.Run(name, func(t *testing.T) {
			isolated(t)
			t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
			for key, value := range env {
				t.Setenv(key, value)
			}

			if _, err := config.Load("dev"); err == nil {
				t.Fatal("expected a refusal")
			}
		})
	}
}

func TestPassesTheSandboxEnvironmentButNeverTheHostsCredential(t *testing.T) {
	dir := isolated(t)
	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_TOKEN", "pool-token")

	write(t, filepath.Join(dir, "sandbox.env"), "# harness keys\nANTHROPIC_API_KEY=sk-test\n")
	cfg, err := config.Load("dev")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if !slices.Equal(cfg.SandboxEnv, []string{"ANTHROPIC_API_KEY=sk-test"}) {
		t.Errorf("sandbox env %v", cfg.SandboxEnv)
	}

	for _, leaked := range []string{"SPOTLIGHT_TOKEN=anything\n", "SOMETHING=Bearer pool-token\n"} {
		write(t, filepath.Join(dir, "sandbox.env"), leaked)
		if _, err := config.Load("dev"); err == nil || !strings.Contains(err.Error(), "sandbox environment") {
			t.Errorf("%q: expected a refusal, got %v", leaked, err)
		}
	}
}

func TestKeepsOneHostIDForItsLife(t *testing.T) {
	state := filepath.Join(t.TempDir(), "state")

	first, err := config.HostID(state)
	if err != nil || first == "" {
		t.Fatalf("host id %q: %v", first, err)
	}

	again, err := config.HostID(state)
	if err != nil || again != first {
		t.Errorf("host id changed from %q to %q (%v)", first, again, err)
	}
}

func TestPassesNamedVariablesOfItsOwnIntoSandboxes(t *testing.T) {
	isolated(t)
	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_TOKEN", "pool-token")
	t.Setenv("CLAUDE_CODE_OAUTH_TOKEN", "oauth")
	t.Setenv("SPOTLIGHT_SANDBOX_PASS", "CLAUDE_CODE_OAUTH_TOKEN, UNSET_ONE")

	cfg, err := config.Load("dev")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if !slices.Equal(cfg.SandboxEnv, []string{"CLAUDE_CODE_OAUTH_TOKEN=oauth"}) {
		t.Errorf("sandbox env %v", cfg.SandboxEnv)
	}

	t.Setenv("SPOTLIGHT_SANDBOX_PASS", "SPOTLIGHT_TOKEN")
	if _, err := config.Load("dev"); err == nil {
		t.Error("passed the host's own credential into sandboxes")
	}
}

func TestOnlyOneHostServesFromAStateDirectory(t *testing.T) {
	state := filepath.Join(t.TempDir(), "state")

	release, err := config.Hold(state)
	if err != nil {
		t.Fatalf("hold: %v", err)
	}

	if _, err := config.Hold(state); err == nil || !strings.Contains(err.Error(), "another spotlight host") {
		t.Fatalf("a second host was let in: %v", err)
	}

	release()
	again, err := config.Hold(state)
	if err != nil {
		t.Fatalf("hold after release: %v", err)
	}
	again()
}
