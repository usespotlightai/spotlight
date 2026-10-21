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
	"usespotlight.ai/data-plane/host/internal/update"
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
	AutoUpdate bool
	Releases   string
	HealthAddr string
	LogLevel   string
	Sampler    string
	SamplerArg string
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
	envPoolToken   = "SPOTLIGHT_POOL_TOKEN"
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
	envAutoUpdate  = "SPOTLIGHT_AUTO_UPDATE"
	envReleases    = "SPOTLIGHT_RELEASES_URL"
)

const (
	defaultRunTimeout = 6 * time.Hour
	defaultAnswerWait = 5 * time.Minute
	Image             = "ghcr.io/usespotlightai/spotlight-runner"
)

var hostOnly = []string{envURL, envPoolToken, envTrust, envTokenFile, "SPOTLIGHT_ASSIGNMENT_FILE", "SPOTLIGHT_RUN_TOKEN", envAnswerWait}

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
	return Parse(version, saved)
}

// Parse reads saved as the file's values, with the host's environment winning over them.
func Parse(version string, saved map[string]string) (Config, error) {
	return parse(version, saved, true)
}

// Check reads only the file's values, so a command checks what it saves and not the shell it runs in.
func Check(version string, saved map[string]string) (Config, error) {
	return parse(version, saved, false)
}

func parse(version string, saved map[string]string, fromEnv bool) (Config, error) {
	var err error
	get := func(key string) string {
		if value := strings.TrimSpace(os.Getenv(key)); fromEnv && value != "" {
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
		PoolToken:  get(envPoolToken),
		Workload:   trust.Workload{Trust: get(envTrust), TokenFile: get(envTokenFile)},
		Network:    get(envNetwork),
		ExtraHosts: list(get(envHosts)),
		State:      get(envState),
		Name:       get(envName),
		DockerHost: get(envDocker),
		HealthAddr: get(telemetry.HealthVar),
		LogLevel:   get("LOG_LEVEL"),
		Sampler:    get(telemetry.SamplerVar),
		SamplerArg: get(telemetry.SamplerArgVar),
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
		note(fmt.Errorf("%s and %s are two different authentication methods; set one", envPoolToken, envTrust))
	case cfg.PoolToken == "" && cfg.Workload.Trust == "":
		note(fmt.Errorf("%s (a pull pool's token) is required, or %s and %s to claim through a runner trust",
			envPoolToken, envTrust, envTokenFile))
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
	reporting(values, get)
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

	cfg.AutoUpdate = true
	if raw := get(envAutoUpdate); raw != "" {
		cfg.AutoUpdate, err = strconv.ParseBool(raw)
		if err != nil {
			note(fmt.Errorf("%s: %q is not true or false", envAutoUpdate, raw))
		}
	}

	cfg.Releases = strings.TrimSuffix(get(envReleases), "/")
	if cfg.Releases == "" {
		cfg.Releases = update.DefaultReleases
	}

	return cfg, errors.Join(problems...)
}

func (c Config) Credential() control.Credential {
	if c.PoolToken != "" {
		return control.Bearer(c.PoolToken)
	}
	return c.Workload
}

func reporting(values map[string]string, get func(string) string) {
	for name, passed := range telemetry.Passed {
		if value := get(name); value != "" {
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
	reporting(values, get)
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
		if key, value, ok := assignment(scanner.Text()); ok {
			values[key] = value
		}
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

	// Serving takes the lock for a moment to test it, so try a few times before another host is assumed.
	err = syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
	for try := 0; err != nil && try < 10; try++ {
		time.Sleep(20 * time.Millisecond)
		err = syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
	}
	if err != nil {
		file.Close()
		return nil, fmt.Errorf("another spotlight host already serves from %s: %w", state, err)
	}

	if err := errors.Join(file.Truncate(0), write(file, strconv.Itoa(os.Getpid())+"\n")); err != nil {
		file.Close()
		return nil, fmt.Errorf("note the host's process id: %w", err)
	}

	return func() { file.Close() }, nil
}

// Serving names the process of a host that holds the lock on state, or 0 when none does.
func Serving(state string) (int, error) {
	file, err := os.Open(filepath.Join(state, "host.lock"))
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("open the host's lock: %w", err)
	}
	defer file.Close()

	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_SH|syscall.LOCK_NB); err == nil {
		return 0, nil
	}

	// A host that just took the lock writes its id a moment later.
	for try := 0; ; try++ {
		raw := make([]byte, 32)
		n, _ := file.ReadAt(raw, 0)
		if pid, err := strconv.Atoi(strings.TrimSpace(string(raw[:n]))); err == nil && pid > 0 {
			return pid, nil
		}
		if try == 10 {
			return 0, fmt.Errorf("the host's lock in %s names no process", state)
		}
		time.Sleep(20 * time.Millisecond)
	}
}
