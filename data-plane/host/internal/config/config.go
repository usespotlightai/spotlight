package config

import (
	"bufio"
	"crypto/rand"
	"crypto/x509"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"

	"usespotlight.ai/data-plane/allowlist"
	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/host/internal/images"
	"usespotlight.ai/data-plane/host/internal/registry"
	"usespotlight.ai/data-plane/host/internal/trust"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/telemetry"
)

type Config struct {
	URL        string
	SandboxURL string
	PoolToken  string
	Workload   trust.Workload
	Capacity   int
	Images     images.Allowed
	Registry   string
	RunTimeout time.Duration
	AnswerWait time.Duration
	SandboxEnv []string
	Egress     Egress
	Network    string
	ExtraHosts []string
	State      string
	Name       string
	DockerHost string
}

type Egress struct {
	Image       string
	Allow       []string
	SecretAllow []string
	Env         []string
	CABundle    []byte
}

const (
	EnvConfig = "SPOTLIGHT_HOST_CONFIG"

	envURL         = "SPOTLIGHT_URL"
	envToken       = "SPOTLIGHT_TOKEN"
	envTrust       = "SPOTLIGHT_TRUST"
	envTokenFile   = "SPOTLIGHT_OIDC_TOKEN_FILE"
	envCapacity    = "SPOTLIGHT_CAPACITY"
	envImage       = "SPOTLIGHT_RUNNER_IMAGE"
	envRegistry    = "SPOTLIGHT_REGISTRY_CONFIG"
	envRunTimeout  = "SPOTLIGHT_RUN_TIMEOUT"
	envAnswerWait  = protocol.AnswerWaitVar
	envSandboxURL  = "SPOTLIGHT_SANDBOX_URL"
	envSandboxEnv  = "SPOTLIGHT_SANDBOX_ENV"
	envPass        = "SPOTLIGHT_SANDBOX_PASS"
	envNetwork     = "SPOTLIGHT_SANDBOX_NETWORK"
	envHosts       = "SPOTLIGHT_SANDBOX_HOSTS"
	envEgressImg   = "SPOTLIGHT_EGRESS_IMAGE"
	envEgressOK    = "SPOTLIGHT_EGRESS_ALLOW"
	envEgressEnv   = "SPOTLIGHT_EGRESS_ENV"
	envEgressPass  = "SPOTLIGHT_EGRESS_PASS"
	envCABundle    = "SPOTLIGHT_EGRESS_CA_BUNDLE"
	envSecretAllow = "SPOTLIGHT_EGRESS_SECRET_ALLOW"
	envState       = "SPOTLIGHT_STATE"
	envName        = "SPOTLIGHT_HOST_NAME"
	envDocker      = "DOCKER_HOST"
)

const (
	defaultRunTimeout = 6 * time.Hour
	defaultAnswerWait = 5 * time.Minute
	Image             = "ghcr.io/usespotlightai/spotlight-runner"
)

var hostOnly = []string{envURL, envToken, envTrust, envTokenFile, "SPOTLIGHT_ASSIGNMENT_FILE", envAnswerWait}

func Path() string {
	if path := strings.TrimSpace(os.Getenv(EnvConfig)); path != "" {
		return path
	}
	if os.Geteuid() == 0 {
		return "/etc/spotlight/host.env"
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		return filepath.Join(home, ".spotlight", "host.env")
	}
	return "/etc/spotlight/host.env"
}

func Load(version string) (Config, error) {
	saved, err := ReadEnvFile(Path())
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return Config{}, fmt.Errorf("read %s: %w", Path(), err)
	}
	get := func(key string) string {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
		return strings.TrimSpace(saved[key])
	}

	var problems []error
	note := func(err error) {
		if err != nil {
			problems = append(problems, err)
		}
	}

	cfg := Config{
		URL:        strings.TrimSuffix(get(envURL), "/"),
		PoolToken:  get(envToken),
		Workload:   trust.Workload{Trust: get(envTrust), TokenFile: get(envTokenFile)},
		Network:    get(envNetwork),
		ExtraHosts: list(get(envHosts)),
		State:      get(envState),
		Name:       get(envName),
		DockerHost: get(envDocker),
	}

	if cfg.URL == "" {
		note(fmt.Errorf("%s is required", envURL))
	}

	cfg.SandboxURL = strings.TrimSuffix(get(envSandboxURL), "/")
	if cfg.SandboxURL == "" {
		cfg.SandboxURL = cfg.URL
	}

	switch {
	case cfg.PoolToken != "" && (cfg.Workload.Trust != "" || cfg.Workload.TokenFile != ""):
		note(fmt.Errorf("%s and %s are different ways in; set one", envToken, envTrust))
	case cfg.PoolToken == "" && cfg.Workload.Trust == "":
		note(fmt.Errorf("%s (a pull pool's token) is required, or %s and %s to claim through a runner trust",
			envToken, envTrust, envTokenFile))
	case cfg.PoolToken == "" && cfg.Workload.TokenFile == "":
		note(fmt.Errorf("%s names the workload token file, and is required with %s", envTokenFile, envTrust))
	}

	cfg.Capacity = 1
	if raw := get(envCapacity); raw != "" {
		cfg.Capacity, err = strconv.Atoi(raw)
		if err != nil || cfg.Capacity < 1 {
			note(fmt.Errorf("%s: %q is not a count of at least 1", envCapacity, raw))
		}
	}

	cfg.Images, err = images.Parse(list(get(envImage)), DefaultImage(version))
	if err != nil {
		note(fmt.Errorf("%s: %w", envImage, err))
	}

	cfg.Registry = get(envRegistry)
	if cfg.Registry == "" {
		cfg.Registry = registry.DefaultPath()
	}

	cfg.RunTimeout = defaultRunTimeout
	if raw := get(envRunTimeout); raw != "" {
		cfg.RunTimeout, err = time.ParseDuration(raw)
		if err != nil || cfg.RunTimeout <= 0 {
			note(fmt.Errorf("%s: %q is not a duration such as 6h", envRunTimeout, raw))
		}
	}

	cfg.AnswerWait = defaultAnswerWait
	if raw := get(envAnswerWait); raw != "" {
		cfg.AnswerWait, err = time.ParseDuration(raw)
		if err != nil || cfg.AnswerWait < 0 {
			note(fmt.Errorf("%s: %q is not a duration such as 5m, or 0 to suspend at once", envAnswerWait, raw))
		}
	}

	envFile := get(envSandboxEnv)
	if envFile == "" {
		envFile = filepath.Join(filepath.Dir(Path()), "sandbox.env")
	}
	values, err := sandboxEnv(envFile, get(envSandboxEnv) != "")
	note(err)
	for _, name := range list(get(envPass)) {
		if value, ok := os.LookupEnv(name); ok {
			values[name] = value
		}
	}
	reporting(values)
	cfg.SandboxEnv, err = sandboxed(values, cfg.PoolToken)
	note(err)

	cfg.Egress, err = egressOf(get, version, cfg.PoolToken)
	note(err)
	cfg.Egress.Allow = withReporting(cfg.Egress.Allow)

	if cfg.State == "" {
		cfg.State = defaultState()
	}

	if cfg.Name == "" {
		cfg.Name, _ = os.Hostname()
	}

	return cfg, errors.Join(problems...)
}

func (c Config) Credential() control.Credential {
	if c.PoolToken != "" {
		return control.Bearer(c.PoolToken)
	}
	return c.Workload
}

func reporting(values map[string]string) {
	for name, passed := range telemetry.Passed {
		if value := os.Getenv(name); value != "" {
			values[passed] = value
		}
	}
}

func withReporting(allow []string) []string {
	dsn, err := url.Parse(os.Getenv("SENTRY_DSN"))
	if len(allow) == 0 || err != nil || dsn.Hostname() == "" {
		return allow
	}
	return append(allow, dsn.Hostname())
}

func egressOf(get func(string) string, version, poolToken string) (Egress, error) {
	egress := Egress{Image: get(envEgressImg), Allow: list(get(envEgressOK)), SecretAllow: list(get(envSecretAllow))}
	if egress.Image == "" {
		egress.Image = DefaultImage(version)
	}

	var problems []error
	if _, err := allowlist.Parse(egress.Allow); err != nil {
		problems = append(problems, fmt.Errorf("%s: %w", envEgressOK, err))
	}

	envFile := get(envEgressEnv)
	if envFile == "" {
		envFile = filepath.Join(filepath.Dir(Path()), "egress.env")
	}
	values, err := sandboxEnv(envFile, get(envEgressEnv) != "")
	if err != nil {
		problems = append(problems, err)
	}
	for _, name := range list(get(envEgressPass)) {
		if value, ok := os.LookupEnv(name); ok {
			values[name] = value
		}
	}
	reporting(values)
	egress.Env, err = sandboxed(values, poolToken)
	if err != nil {
		problems = append(problems, fmt.Errorf("egress: %w", err))
	}

	if path := get(envCABundle); path != "" {
		egress.CABundle, err = os.ReadFile(path)
		switch {
		case err != nil:
			problems = append(problems, fmt.Errorf("%s: %w", envCABundle, err))
		case !x509.NewCertPool().AppendCertsFromPEM(egress.CABundle):
			problems = append(problems, fmt.Errorf("%s: %s has no PEM certificate", envCABundle, path))
		}
	}

	return egress, errors.Join(problems...)
}

func DefaultImage(version string) string {
	if version == "" || version == "dev" {
		return Image + ":latest"
	}
	return Image + ":" + version
}

func sandboxEnv(path string, named bool) (map[string]string, error) {
	values, err := ReadEnvFile(path)
	if errors.Is(err, os.ErrNotExist) && !named {
		return map[string]string{}, nil
	}
	if err != nil {
		return map[string]string{}, fmt.Errorf("read the environment %s: %w", path, err)
	}

	return values, nil
}

func sandboxed(values map[string]string, poolToken string) ([]string, error) {
	env := make([]string, 0, len(values))
	for key, value := range values {
		if slices.Contains(hostOnly, key) {
			return nil, fmt.Errorf("the sandbox environment sets %s, which only the host has", key)
		}
		if poolToken != "" && strings.Contains(value, poolToken) {
			return nil, fmt.Errorf("the sandbox environment carries the pool token in %s", key)
		}
		env = append(env, key+"="+value)
	}
	slices.Sort(env)

	return env, nil
}

func ReadEnvFile(path string) (map[string]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	values := map[string]string{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		values[strings.TrimSpace(key)] = strings.Trim(strings.TrimSpace(value), `"'`)
	}

	return values, scanner.Err()
}

func list(raw string) []string {
	var items []string
	for _, item := range strings.Split(raw, ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}
	return items
}

func defaultState() string {
	if os.Geteuid() == 0 && runtime.GOOS == "linux" {
		return "/var/lib/spotlight-host"
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		return filepath.Join(home, ".spotlight", "host")
	}
	return filepath.Join(os.TempDir(), "spotlight-host")
}

func HostID(state string) (string, error) {
	path := filepath.Join(state, "host-id")
	raw, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("read the host's id: %w", err)
	}
	if id := strings.TrimSpace(string(raw)); id != "" {
		return id, nil
	}

	if err := os.MkdirAll(state, 0o700); err != nil {
		return "", fmt.Errorf("make the host's state directory: %w", err)
	}

	id := rand.Text()
	if err := os.WriteFile(path, []byte(id+"\n"), 0o600); err != nil {
		return "", fmt.Errorf("store the host's id: %w", err)
	}

	return id, nil
}

func Lock(state string) (func(), error) {
	if err := os.MkdirAll(state, 0o700); err != nil {
		return nil, fmt.Errorf("make the host's state directory: %w", err)
	}

	file, err := os.OpenFile(filepath.Join(state, "host.lock"), os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf("open the host's lock: %w", err)
	}

	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		file.Close()
		return nil, fmt.Errorf("another spotlight host already serves from %s: %w", state, err)
	}

	return func() { file.Close() }, nil
}
