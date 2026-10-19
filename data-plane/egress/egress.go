package egress

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"sync"
	"syscall"
	"time"

	"usespotlight.ai/data-plane/allowlist"
	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/egress/internal/awssm"
	"usespotlight.ai/data-plane/egress/internal/proxy"
	"usespotlight.ai/data-plane/egress/internal/send"
	"usespotlight.ai/data-plane/egress/serve"
	"usespotlight.ai/data-plane/egresskit/authority"
	"usespotlight.ai/data-plane/egresskit/inject"
	"usespotlight.ai/data-plane/egresskit/seal"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/telemetry"
)

const Usage = `  spotlight egress            egress sidecar for one sandbox, which injects its run's secrets for their hosts
  spotlight egress serve      shared egress for push pools`

const (
	fetchBudget   = time.Minute
	fetchFloor    = time.Second
	fetchCeiling  = 10 * time.Second
	shutdownGrace = 5 * time.Second
)

type SecretFetcher interface {
	FetchRunSecrets(ctx context.Context, recipient string) (protocol.EgressSecrets, error)
}

func Main(args []string, _ string) int {
	started := run
	switch {
	case len(args) == 1 && args[0] == "serve":
		started = serveShared
	case len(args) != 0:
		fmt.Fprintf(os.Stderr, "usage:\n%s\n", Usage)
		return 1
	}

	if err := started(); err != nil {
		slog.Error("egress stopped", "error", err)
		telemetry.Report(err, nil)
		return 1
	}

	return 0
}

func run() error {
	log := telemetry.NewLogger("egress", os.Stdout)
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	config, err := readConfig(protocol.EgressConfigPath)
	if err != nil {
		return err
	}

	allowed, err := allowlist.Parse(config.Allow)
	if err != nil {
		return fmt.Errorf("the host's allow-list: %w", err)
	}

	if config.Send != nil {
		return sent(ctx, *config.Send, send.New(allowed), protocol.EgressSendPath, log)
	}

	controlPlane, err := url.Parse(config.URL)
	if err != nil || controlPlane.Hostname() == "" {
		return fmt.Errorf("the control plane %q is not an address", config.URL)
	}

	key, err := seal.NewKey()
	if err != nil {
		return err
	}

	fetched, err := fetchSecretsFor(ctx, config, key.Recipient(), func(url, token string) (SecretFetcher, error) {
		return control.New(url, token)
	}, log)
	if err != nil {
		return err
	}

	injector := inject.From(ctx, fetched, config.HarnessKeys, inject.Limits{Hosts: allowed, SecretAllow: config.SecretAllow}, key, externalSecretReader(ctx), log)
	defer injector.Wipe()

	if err := injector.ForControlPlane(fetched.SpotlightAPI, controlPlane, fetched.RunID, key); err != nil {
		log.Warn("could not store the run's Spotlight token", "error", err)
	}

	issuer, err := authority.New(time.Now(), injector.Hosts())
	if err != nil {
		return err
	}

	allowed = withRunHosts(allowed, controlPlane.Hostname(), fetched)

	listener, err := net.Listen("tcp", ":"+strconv.Itoa(protocol.EgressPort))
	if err != nil {
		return fmt.Errorf("listen for the sandbox: %w", err)
	}

	server := &http.Server{
		Handler:           proxy.New(allowed, injector, issuer, config.Credential, log),
		ReadHeaderTimeout: time.Minute,
		ErrorLog:          slog.NewLogLogger(log.Handler(), slog.LevelDebug),
	}

	serving := make(chan error, 1)
	go func() { serving <- server.Serve(listener) }()

	if err := publish(issuer.PEM()); err != nil {
		return err
	}
	log.Info("egress is the sidecar of the sandbox", "injects", injector.Hosts(), "port", protocol.EgressPort)

	select {
	case err := <-serving:
		return err
	case <-ctx.Done():
	}

	stopping, cancel := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancel()
	_ = server.Shutdown(stopping)
	log.Info("egress stopped and released the run's secrets")

	return nil
}

func serveShared() error {
	log := telemetry.NewLogger("egress", os.Stdout)
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	settings, err := serve.Load()
	if err != nil {
		return err
	}

	client, err := control.New(settings.URL, settings.Token)
	if err != nil {
		return err
	}
	client.Through(settings.Transport())

	reachesSpotlight := func(ctx context.Context) error {
		_, err := client.Request(ctx, http.MethodGet, "/api/health", nil, nil)
		return err
	}
	if err := telemetry.ServeHealth(ctx, os.Getenv(telemetry.HealthVar), reachesSpotlight, log); err != nil {
		return err
	}

	shared, err := serve.New(settings, client, externalSecretReader(ctx), log)
	if err != nil {
		return err
	}

	listener, err := net.Listen("tcp", settings.Listen)
	if err != nil {
		return fmt.Errorf("listen for sandboxes: %w", err)
	}
	log.Info("egress is the shared egress for sandboxes", "listen", settings.Listen, "tls", settings.Certificate != nil)

	return shared.Serve(ctx, listener)
}

func readConfig(path string) (protocol.EgressConfig, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return protocol.EgressConfig{}, fmt.Errorf("read the egress config: %w", err)
	}
	if err := os.Remove(path); err != nil {
		return protocol.EgressConfig{}, fmt.Errorf("remove the egress config: %w", err)
	}

	var config protocol.EgressConfig
	if err := json.Unmarshal(raw, &config); err != nil {
		return protocol.EgressConfig{}, fmt.Errorf("read the egress config: %w", err)
	}
	if config.URL == "" || config.Credential == "" {
		return protocol.EgressConfig{}, errors.New("the egress config has no control plane or proxy credential")
	}

	return config, nil
}

func fetchSecretsFor(
	ctx context.Context, config protocol.EgressConfig, recipient string,
	connect func(url, token string) (SecretFetcher, error), log *slog.Logger,
) (protocol.EgressSecrets, error) {
	if config.Token == "" {
		return protocol.EgressSecrets{}, nil
	}

	fetcher, err := connect(config.URL, config.Token)
	if err != nil {
		return protocol.EgressSecrets{}, err
	}

	return fetchedBy(ctx, fetcher, recipient, log), nil
}

func withRunHosts(allowed allowlist.List, controlPlane string, fetched protocol.EgressSecrets) allowlist.List {
	return allowed.With(append([]string{controlPlane}, fetched.ExtraAllowedHosts...)...)
}

func fetchedBy(ctx context.Context, fetcher SecretFetcher, recipient string, log *slog.Logger) protocol.EgressSecrets {
	budget, cancel := context.WithTimeout(ctx, fetchBudget)
	defer cancel()

	backoff := fetchFloor
	for {
		fetched, err := fetcher.FetchRunSecrets(budget, recipient)
		if err == nil {
			return fetched
		}

		var rejection *control.ResponseError
		if errors.As(err, &rejection) && rejection.Status < http.StatusInternalServerError {
			log.Warn("the control plane sent egress no secrets to inject", "error", err)
			return protocol.EgressSecrets{}
		}

		log.Warn("could not fetch the run's secrets, still trying", "error", err, "retryIn", backoff)
		select {
		case <-budget.Done():
			log.Error("gave up fetching the run's secrets; the sandbox goes out with no injected secrets", "error", err)
			return protocol.EgressSecrets{}
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, fetchCeiling)
	}
}

func externalSecretReader(ctx context.Context) func() (inject.Reader, error) {
	var (
		once   sync.Once
		reader inject.Reader
		err    error
	)

	return func() (inject.Reader, error) {
		once.Do(func() { reader, err = awssm.Connect(ctx) })
		return reader, err
	}
}

type Sender interface {
	Send(ctx context.Context, call protocol.HostCall) protocol.HostCallResponse
}

func sent(ctx context.Context, call protocol.HostCall, sender Sender, path string, log *slog.Logger) error {
	response := sender.Send(ctx, call)
	if response.Error != "" {
		log.Warn("could not send the call", "call", call.ID, "error", response.Error, "ms", response.Ms)
	} else {
		log.Info("sent the call", "call", call.ID, "status", response.Status, "ms", response.Ms)
	}

	body, err := json.Marshal(response)
	if err != nil {
		return err
	}
	if err := written(path, body); err != nil {
		return fmt.Errorf("hand the host the call's response: %w", err)
	}

	<-ctx.Done()
	return nil
}

func publish(authorityPEM []byte) error {
	if err := written(protocol.EgressAuthority, authorityPEM); err != nil {
		return fmt.Errorf("publish the run's authority: %w", err)
	}

	return nil
}

func written(path string, body []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	writing := path + ".writing"
	if err := os.WriteFile(writing, body, 0o644); err != nil {
		return err
	}

	return os.Rename(writing, path)
}
