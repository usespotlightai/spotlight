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
	"usespotlight.ai/data-plane/egress/internal/authority"
	"usespotlight.ai/data-plane/egress/internal/awssm"
	"usespotlight.ai/data-plane/egress/internal/proxy"
	"usespotlight.ai/data-plane/egress/internal/seal"
	"usespotlight.ai/data-plane/egress/internal/wear"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
)

const Usage = `  spotlight egress            the one way out of a sandbox, wearing its run's secrets toward their hosts`

const (
	redeemBudget  = time.Minute
	redeemFloor   = time.Second
	redeemCeiling = 10 * time.Second
	shutdownGrace = 5 * time.Second
)

type Redeemer interface {
	RedeemEgress(ctx context.Context, recipient string) (protocol.EgressRedemption, error)
}

func Main(args []string, _ string) int {
	if len(args) != 0 {
		fmt.Fprintf(os.Stderr, "usage:\n%s\n", Usage)
		return 1
	}

	if err := run(); err != nil {
		slog.Error("egress stopped", "error", err)
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

	controlPlane, err := url.Parse(handed.URL)
	if err != nil || controlPlane.Hostname() == "" {
		return fmt.Errorf("the control plane %q is not an address", handed.URL)
	}

	key, err := seal.NewKey()
	if err != nil {
		return err
	}

	redeemed, err := redemptionFor(ctx, handed, key.Recipient(), func(url, token string) (Redeemer, error) {
		return control.New(url, token)
	}, log)
	if err != nil {
		return err
	}

	wearing := wear.From(ctx, redeemed, handed.Held, wear.Limits{Hosts: allowed, Reads: handed.Reads}, key, readerInNetwork(ctx), log)
	defer wearing.Forget()

	issuer, err := authority.New(time.Now(), wearing.Hosts())
	if err != nil {
		return err
	}

	allowed = reachedBy(allowed, controlPlane.Hostname(), redeemed)

	listener, err := net.Listen("tcp", ":"+strconv.Itoa(protocol.EgressPort))
	if err != nil {
		return fmt.Errorf("listen for the sandbox: %w", err)
	}

	server := &http.Server{
		Handler:           proxy.New(allowed, wearing, issuer, handed.Credential, log),
		ReadHeaderTimeout: time.Minute,
		ErrorLog:          slog.NewLogLogger(log.Handler(), slog.LevelDebug),
	}

	serving := make(chan error, 1)
	go func() { serving <- server.Serve(listener) }()

	if err := publish(issuer.PEM()); err != nil {
		return err
	}
	log.Info("egress is the sandbox's way out", "wears", wearing.Hosts(), "port", protocol.EgressPort)

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

func redemptionFor(
	ctx context.Context, handed protocol.EgressHanded, recipient string,
	connect func(url, token string) (Redeemer, error), log *slog.Logger,
) (protocol.EgressRedemption, error) {
	if handed.Token == "" {
		return protocol.EgressRedemption{}, nil
	}

	redeemer, err := connect(handed.URL, handed.Token)
	if err != nil {
		return protocol.EgressRedemption{}, err
	}

	return redeemedBy(ctx, redeemer, recipient, log), nil
}

func reachedBy(allowed reach.List, controlPlane string, redeemed protocol.EgressRedemption) reach.List {
	return allowed.With(append([]string{controlPlane}, redeemed.Reaches...)...)
}

func redeemedBy(ctx context.Context, redeemer Redeemer, recipient string, log *slog.Logger) protocol.EgressRedemption {
	budget, cancel := context.WithTimeout(ctx, redeemBudget)
	defer cancel()

	backoff := redeemFloor
	for {
		redeemed, err := redeemer.RedeemEgress(budget, recipient)
		if err == nil {
			return redeemed
		}

		var rejection *control.Rejection
		if errors.As(err, &rejection) && rejection.Status < http.StatusInternalServerError {
			log.Warn("the control plane gave egress nothing to wear", "error", err)
			return protocol.EgressRedemption{}
		}

		log.Warn("could not redeem the run's secrets, still trying", "error", err, "retryIn", backoff)
		select {
		case <-budget.Done():
			log.Error("gave up redeeming the run's secrets; the sandbox goes out wearing none", "error", err)
			return protocol.EgressRedemption{}
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, redeemCeiling)
	}
}

func readerInNetwork(ctx context.Context) func() (wear.Reader, error) {
	var (
		once   sync.Once
		reader wear.Reader
		err    error
	)

	return func() (wear.Reader, error) {
		once.Do(func() { reader, err = awssm.Connect(ctx) })
		return reader, err
	}
}

func publish(authorityPEM []byte) error {
	if err := os.MkdirAll(filepath.Dir(protocol.EgressAuthority), 0o755); err != nil {
		return fmt.Errorf("publish the run's authority: %w", err)
	}

	written := protocol.EgressAuthority + ".writing"
	if err := os.WriteFile(written, authorityPEM, 0o644); err != nil {
		return fmt.Errorf("publish the run's authority: %w", err)
	}

	return os.Rename(written, protocol.EgressAuthority)
}
