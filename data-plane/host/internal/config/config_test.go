package config_test

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
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
		"SPOTLIGHT_CAPACITY", "SPOTLIGHT_RUNNER_IMAGE", "SPOTLIGHT_RUN_TIMEOUT", "SPOTLIGHT_ANSWER_WAIT", "SPOTLIGHT_SANDBOX_URL",
		"SPOTLIGHT_SANDBOX_ENV", "SPOTLIGHT_SANDBOX_NETWORK", "SPOTLIGHT_SANDBOX_HOSTS", "SPOTLIGHT_STATE",
		"SPOTLIGHT_HOST_NAME", "DOCKER_HOST", "SPOTLIGHT_SANDBOX_PASS",
		"SPOTLIGHT_EGRESS_IMAGE", "SPOTLIGHT_EGRESS_ALLOW", "SPOTLIGHT_EGRESS_ENV", "SPOTLIGHT_EGRESS_PASS",
		"SPOTLIGHT_EGRESS_CA_BUNDLE", "SPOTLIGHT_EGRESS_SECRET_ALLOW", "SENTRY_DSN", "SENTRY_ENVIRONMENT",
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
	if cfg.Capacity != 1 || cfg.RunTimeout != 6*time.Hour || cfg.AnswerWait != 5*time.Minute {
		t.Errorf("capacity %d, timeout %v, answer wait %v", cfg.Capacity, cfg.RunTimeout, cfg.AnswerWait)
	}
	if cfg.Images.Default != config.Image+":v1.4.0" || !cfg.Images.Allows(config.Image+":v1.4.0") {
		t.Errorf("images %+v: the runner image is pinned to the host's version", cfg.Images)
	}
	if cfg.Images.Allows("ghcr.io/acme/runner:main") {
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
	for _, image := range []string{"runner:claude-2", "runner:codex-1", "ghcr.io/acme/api-runner:main"} {
		if !cfg.Images.Allows(image) {
			t.Errorf("%s is not allowed", image)
		}
	}
	if cfg.Images.Allows("ghcr.io/other/runner:main") {
		t.Error("an image no entry names is allowed")
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

func TestRejectsAmbiguousOrMissingCredentials(t *testing.T) {
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
				t.Fatal("expected an error")
			}
		})
	}
}

func TestReadsHowLongARunWaitsWarmForAnAnswer(t *testing.T) {
	for raw, want := range map[string]time.Duration{"0": 0, "90s": 90 * time.Second, "1h": time.Hour} {
		isolated(t)
		t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
		t.Setenv("SPOTLIGHT_TOKEN", "pool-token")
		t.Setenv("SPOTLIGHT_ANSWER_WAIT", raw)

		cfg, err := config.Load("dev")
		if err != nil {
			t.Fatalf("%s: load: %v", raw, err)
		}
		if cfg.AnswerWait != want {
			t.Errorf("%s: answer wait %v, want %v", raw, cfg.AnswerWait, want)
		}
	}
}

func TestRejectsAnAnswerWaitThatIsNoDurationOrIsNegative(t *testing.T) {
	for _, raw := range []string{"soon", "5", "-1m"} {
		isolated(t)
		t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
		t.Setenv("SPOTLIGHT_TOKEN", "pool-token")
		t.Setenv("SPOTLIGHT_ANSWER_WAIT", raw)

		if _, err := config.Load("dev"); err == nil || !strings.Contains(err.Error(), "SPOTLIGHT_ANSWER_WAIT") {
			t.Errorf("%q: expected an error, got %v", raw, err)
		}
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

	for _, leaked := range []string{"SPOTLIGHT_TOKEN=anything\n", "SOMETHING=Bearer pool-token\n", "SPOTLIGHT_ANSWER_WAIT=1h\n"} {
		write(t, filepath.Join(dir, "sandbox.env"), leaked)
		if _, err := config.Load("dev"); err == nil || !strings.Contains(err.Error(), "sandbox environment") {
			t.Errorf("%q: expected an error, got %v", leaked, err)
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

func TestPassesSentryToSandboxesAndEgressOnlyWhenTheHostReports(t *testing.T) {
	isolated(t)
	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_TOKEN", "pool-token")

	cfg, err := config.Load("dev")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(cfg.SandboxEnv) != 0 || len(cfg.Egress.Env) != 0 {
		t.Fatalf("passed variables to a host that does not report: %v, %v", cfg.SandboxEnv, cfg.Egress.Env)
	}

	t.Setenv("SENTRY_DSN", "https://key@sentry.test/1")
	t.Setenv("SENTRY_ENVIRONMENT", "staging")

	cfg, err = config.Load("dev")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	want := []string{"SPOTLIGHT_SENTRY_DSN=https://key@sentry.test/1", "SPOTLIGHT_SENTRY_ENVIRONMENT=staging"}
	if !slices.Equal(cfg.SandboxEnv, want) {
		t.Errorf("sandbox env %v", cfg.SandboxEnv)
	}
	if !slices.Equal(cfg.Egress.Env, want) {
		t.Errorf("egress env %v", cfg.Egress.Env)
	}
	if len(cfg.Egress.Allow) != 0 {
		t.Errorf("an egress that allows any host was narrowed to %v", cfg.Egress.Allow)
	}

	t.Setenv("SPOTLIGHT_EGRESS_ALLOW", "api.anthropic.com")
	cfg, err = config.Load("dev")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if !slices.Equal(cfg.Egress.Allow, []string{"api.anthropic.com", "sentry.test"}) {
		t.Errorf("egress allows %v, not the Sentry host too", cfg.Egress.Allow)
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

	release, err := config.Lock(state)
	if err != nil {
		t.Fatalf("lock: %v", err)
	}

	if _, err := config.Lock(state); err == nil || !strings.Contains(err.Error(), "another spotlight host") {
		t.Fatalf("a second host was let in: %v", err)
	}

	release()
	again, err := config.Lock(state)
	if err != nil {
		t.Fatalf("lock after release: %v", err)
	}
	again()
}

func TestRunsEgressFromTheHostsOwnReleaseAndAllowsSandboxesAnyHostByDefault(t *testing.T) {
	isolated(t)
	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_TOKEN", "pool-token")

	cfg, err := config.Load("v1.4.0")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Egress.Image != config.Image+":v1.4.0" || len(cfg.Egress.Allow) != 0 || len(cfg.Egress.Env) != 0 {
		t.Errorf("egress %+v", cfg.Egress)
	}
}

func TestReadsWhatHostsSandboxesMayConnectToAndWhatEgressRunsWith(t *testing.T) {
	dir := isolated(t)
	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_TOKEN", "pool-token")
	t.Setenv("SPOTLIGHT_EGRESS_IMAGE", "spotlight-runner:dev")
	t.Setenv("SPOTLIGHT_EGRESS_ALLOW", "api.anthropic.com, *.internal.acme.com")
	t.Setenv("SPOTLIGHT_EGRESS_SECRET_ALLOW", "arn:aws:secretsmanager:eu-west-1:123456789012:secret:spotlight/*")
	t.Setenv("AWS_PROFILE", "egress")
	t.Setenv("SPOTLIGHT_EGRESS_PASS", "AWS_PROFILE")
	write(t, filepath.Join(dir, "egress.env"), "AWS_REGION=eu-west-1\n")

	cfg, err := config.Load("dev")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Egress.Image != "spotlight-runner:dev" ||
		!slices.Equal(cfg.Egress.Allow, []string{"api.anthropic.com", "*.internal.acme.com"}) ||
		!slices.Equal(cfg.Egress.SecretAllow, []string{"arn:aws:secretsmanager:eu-west-1:123456789012:secret:spotlight/*"}) ||
		!slices.Equal(cfg.Egress.Env, []string{"AWS_PROFILE=egress", "AWS_REGION=eu-west-1"}) {
		t.Errorf("egress %+v", cfg.Egress)
	}
	if slices.Contains(cfg.SandboxEnv, "AWS_REGION=eu-west-1") {
		t.Error("sent the sandbox what only egress has")
	}
}

func TestRejectsAnAllowListThatNamesNoHostAndAnEgressWithTheHostsCredential(t *testing.T) {
	dir := isolated(t)
	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_TOKEN", "pool-token")

	t.Setenv("SPOTLIGHT_EGRESS_ALLOW", "https://api.anthropic.com")
	if _, err := config.Load("dev"); err == nil || !strings.Contains(err.Error(), "SPOTLIGHT_EGRESS_ALLOW") {
		t.Errorf("accepted an allow-list of URLs: %v", err)
	}

	t.Setenv("SPOTLIGHT_EGRESS_ALLOW", "")
	write(t, filepath.Join(dir, "egress.env"), "SPOTLIGHT_TOKEN=pool-token\n")
	if _, err := config.Load("dev"); err == nil {
		t.Error("sent egress the host's own credential")
	}
}

func TestReadsTheAuthoritiesEgressTrustsForPrivateHosts(t *testing.T) {
	dir := isolated(t)
	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("SPOTLIGHT_TOKEN", "pool-token")
	trust := filepath.Join(dir, "acme-ca.pem")
	t.Setenv("SPOTLIGHT_EGRESS_CA_BUNDLE", trust)

	write(t, trust, "not a certificate")
	if _, err := config.Load("dev"); err == nil || !strings.Contains(err.Error(), "no PEM certificate") {
		t.Errorf("accepted what has no certificate: %v", err)
	}

	authority := authorityPEM(t)
	write(t, trust, authority)
	cfg, err := config.Load("dev")
	if err != nil || string(cfg.Egress.CABundle) != authority {
		t.Errorf("trust %q: %v", cfg.Egress.CABundle, err)
	}
}

func authorityPEM(t *testing.T) string {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "Acme Test"},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign,
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}

	return string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))
}
