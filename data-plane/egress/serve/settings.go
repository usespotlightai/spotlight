package serve

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"usespotlight.ai/data-plane/allowlist"
)

const (
	envListen         = "SPOTLIGHT_EGRESS_LISTEN"
	envCertificate    = "SPOTLIGHT_EGRESS_TLS_CERT"
	envKey            = "SPOTLIGHT_EGRESS_TLS_KEY"
	envURL            = "SPOTLIGHT_URL"
	envToken          = "SPOTLIGHT_EGRESS_TOKEN"
	envAllow          = "SPOTLIGHT_EGRESS_ALLOW"
	envSecretAllow    = "SPOTLIGHT_EGRESS_SECRET_ALLOW"
	envRateLimit      = "SPOTLIGHT_EGRESS_RATE_LIMIT"
	envMaxConnections = "SPOTLIGHT_EGRESS_MAX_CONNECTIONS"
	envCABundle       = "SPOTLIGHT_EGRESS_CA_BUNDLE"
)

const (
	defaultListen      = ":3128"
	defaultRate        = 50
	defaultConnections = 200
)

type Settings struct {
	Listen      string
	Certificate *tls.Certificate
	URL         string
	Token       string
	Allow       allowlist.List
	SecretAllow []string
	Rate        float64
	Connections int

	CheckEvery  time.Duration
	RecordEvery time.Duration
	Dial        func(ctx context.Context, network, address string) (net.Conn, error)
	RootCAs     *x509.CertPool
}

func Load() (Settings, error) {
	get := func(key string) string { return strings.TrimSpace(os.Getenv(key)) }

	var problems []error
	note := func(err error) {
		if err != nil {
			problems = append(problems, err)
		}
	}

	settings := Settings{
		Listen:      or(get(envListen), defaultListen),
		URL:         get(envURL),
		Token:       get(envToken),
		SecretAllow: list(get(envSecretAllow)),
		Rate:        defaultRate,
		Connections: defaultConnections,
	}

	if base, err := url.Parse(settings.URL); err != nil || !base.IsAbs() || base.Hostname() == "" {
		note(fmt.Errorf("%s must be the address of the control plane, such as https://spotlight.example.com", envURL))
	}
	if settings.Token == "" {
		note(fmt.Errorf("%s is required; it is the token the control plane issued for this egress", envToken))
	}

	allow, err := allowlist.Parse(list(get(envAllow)))
	if err != nil {
		note(fmt.Errorf("%s: %w", envAllow, err))
	}
	settings.Allow = allow

	certificate, key := get(envCertificate), get(envKey)
	switch {
	case certificate != "" && key != "":
		pair, err := tls.LoadX509KeyPair(certificate, key)
		if err != nil {
			note(fmt.Errorf("%s and %s: %w", envCertificate, envKey, err))
		}
		settings.Certificate = &pair
	case certificate != "" || key != "":
		note(fmt.Errorf("%s and %s go together; set both or neither", envCertificate, envKey))
	}

	if path := get(envCABundle); path != "" {
		roots, err := trusting(path)
		note(err)
		settings.RootCAs = roots
	}

	if raw := get(envRateLimit); raw != "" {
		rate, err := strconv.ParseFloat(raw, 64)
		if err != nil || rate < 0 {
			note(fmt.Errorf("%s: %q is not a number of requests each second, or 0 for no limit", envRateLimit, raw))
		}
		settings.Rate = rate
	}

	if raw := get(envMaxConnections); raw != "" {
		most, err := strconv.Atoi(raw)
		if err != nil || most < 0 {
			note(fmt.Errorf("%s: %q is not a number of open connections, or 0 for no limit", envMaxConnections, raw))
		}
		settings.Connections = most
	}

	return settings, errors.Join(problems...)
}

func trusting(path string) (*x509.CertPool, error) {
	trusted, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", envCABundle, err)
	}

	roots, err := x509.SystemCertPool()
	if err != nil {
		roots = x509.NewCertPool()
	}
	if !roots.AppendCertsFromPEM(trusted) {
		return nil, fmt.Errorf("%s: %s has no PEM certificate", envCABundle, path)
	}

	return roots, nil
}

func (s Settings) Transport() *http.Transport {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{RootCAs: s.RootCAs, MinVersion: tls.VersionTLS12}
	return transport
}

func list(raw string) []string {
	var items []string
	for item := range strings.SplitSeq(raw, ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}
	return items
}

func or(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
