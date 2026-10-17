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

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/egress/internal/awssm"
	"usespotlight.ai/data-plane/egress/internal/proxy"
	"usespotlight.ai/data-plane/egress/internal/send"
	"usespotlight.ai/data-plane/egress/serve"
	"usespotlight.ai/data-plane/egressing/authority"
	"usespotlight.ai/data-plane/egressing/inject"
	"usespotlight.ai/data-plane/egressing/seal"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
	"usespotlight.ai/data-plane/telemetry"
)

const Usage = `  spotlight egress            the one way out of a sandbox, which injects its run's secrets for their hosts
  spotlight egress serve      the shared way out for the sandboxes of push pools`

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
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	handed, err := handedTo(protocol.EgressHandedPath)
	if err != nil {
		return err
	}

	allowed, err := reach.Parse(handed.Allow)
	if err != nil {
		return fmt.Errorf("the host's allow-list: %w", err)
	}

	if handed.Send != nil {
		return sent(ctx, *handed.Send, send.New(allowed), protocol.EgressSendPath, log)
	}

	controlPlane, err := url.Parse(handed.URL)
	if err != nil || controlPlane.Hostname() == "" {
		return fmt.Errorf("the control plane %q is not an address", handed.URL)
	}

	key, err := seal.NewKey()
	if err != nil {
		return err
	}

	fetched, err := fetchSecretsFor(ctx, handed, key.Recipient(), func(url, token string) (SecretFetcher, error) {
		return control.New(url, token)
	}, log)
	if err != nil {
		return err
	}

	injector := inject.From(ctx, fetched, handed.HarnessKeys, inject.Limits{Hosts: allowed, SecretAllow: handed.SecretAllow}, key, externalSecretReader(ctx), log)
	defer injector.Forget()

	if err := injector.ForControlPlane(fetched.SpotlightAPI, controlPlane, fetched.RunID, key); err != nil {
		log.Warn("could not keep the run's Spotlight token", "error", err)
	}

	issuer, err := authority.New(time.Now(), injector.Hosts())
	if err != nil {
		return err
	}

	allowed = reachedBy(allowed, controlPlane.Hostname(), fetched)

	listener, err := net.Listen("tcp", ":"+strconv.Itoa(protocol.EgressPort))
	if err != nil {
		return fmt.Errorf("listen for the sandbox: %w", err)
	}

	server := &http.Server{
		Handler:           proxy.New(allowed, injector, issuer, handed.Credential, log),
		ReadHeaderTimeout: time.Minute,
		ErrorLog:          slog.NewLogLogger(log.Handler(), slog.LevelDebug),
	}

	serving := make(chan error, 1)
	go func() { serving <- server.Serve(listener) }()

	if err := publish(issuer.PEM()); err != nil {
		return err
	}
	log.Info("egress is the sandbox's way out", "injects", injector.Hosts(), "port", protocol.EgressPort)

	select {
	case err := <-serving:
		return err
	case <-ctx.Done():
	}

	stopping, cancel := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancel()
	_ = server.Shutdown(stopping)
	log.Info("egress stopped and let go of the run's secrets")

	return nil
}

func serveShared() error {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
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

	shared, err := serve.New(settings, client, externalSecretReader(ctx), log)
	if err != nil {
		return err
	}

	listener, err := net.Listen("tcp", settings.Listen)
	if err != nil {
		return fmt.Errorf("listen for sandboxes: %w", err)
	}
	log.Info("egress is the shared way out for sandboxes", "listen", settings.Listen, "tls", settings.Certificate != nil)

	return shared.Serve(ctx, listener)
}

func handedTo(path string) (protocol.EgressHanded, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return protocol.EgressHanded{}, fmt.Errorf("read what the host handed egress: %w", err)
	}
	if err := os.Remove(path); err != nil {
		return protocol.EgressHanded{}, fmt.Errorf("remove what the host handed egress: %w", err)
	}

	var handed protocol.EgressHanded
	if err := json.Unmarshal(raw, &handed); err != nil {
		return protocol.EgressHanded{}, fmt.Errorf("read what the host handed egress: %w", err)
	}
	if handed.URL == "" || handed.Credential == "" {
		return protocol.EgressHanded{}, errors.New("the host handed egress no control plane or proxy credential")
	}

	return handed, nil
}

func fetchSecretsFor(
	ctx context.Context, handed protocol.EgressHanded, recipient string,
	connect func(url, token string) (SecretFetcher, error), log *slog.Logger,
) (protocol.EgressSecrets, error) {
	if handed.Token == "" {
		return protocol.EgressSecrets{}, nil
	}

	fetcher, err := connect(handed.URL, handed.Token)
	if err != nil {
		return protocol.EgressSecrets{}, err
	}

	return fetchedBy(ctx, fetcher, recipient, log), nil
}

func reachedBy(allowed reach.List, controlPlane string, fetched protocol.EgressSecrets) reach.List {
	return allowed.With(append([]string{controlPlane}, fetched.Reaches...)...)
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

		var rejection *control.Rejection
		if errors.As(err, &rejection) && rejection.Status < http.StatusInternalServerError {
			log.Warn("the control plane gave egress no secrets to inject", "error", err)
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
	Send(ctx context.Context, call protocol.HostCall) protocol.HostCallAnswer
}

func sent(ctx context.Context, call protocol.HostCall, sender Sender, path string, log *slog.Logger) error {
	answer := sender.Send(ctx, call)
	if answer.Error != "" {
		log.Warn("could not send the call", "call", call.ID, "error", answer.Error, "ms", answer.Ms)
	} else {
		log.Info("sent the call", "call", call.ID, "status", answer.Status, "ms", answer.Ms)
	}

	body, err := json.Marshal(answer)
	if err != nil {
		return err
	}
	if err := written(path, body); err != nil {
		return fmt.Errorf("hand the host the call's answer: %w", err)
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
