package localproxy

import (
	"cmp"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"time"

	"usespotlight.ai/data-plane/allowlist"
	"usespotlight.ai/data-plane/egresskit/authority"
	"usespotlight.ai/data-plane/egresskit/tunnel"
	"usespotlight.ai/data-plane/protocol"
)

const (
	Listen       = "127.0.0.1:3128"
	checkTimeout = 3 * time.Second
	boundWait    = 30 * time.Second
	boundFloor   = 250 * time.Millisecond
	boundCeiling = 4 * time.Second
)

type Options struct {
	Listen    string
	Direct    bool
	Authority string
	Bundle    string
	BoundWait time.Duration
	Log       *slog.Logger
}

type LocalProxy struct {
	egress    *Egress
	authority *authority.Authority
	bound     map[string]bool
	direct    bool
	paths     Options
	listener  net.Listener
	server    *http.Server
	plain     *http.Transport
	dialer    *net.Dialer
	log       *slog.Logger
}

func Open(ctx context.Context, egress *Egress, opts Options) (*LocalProxy, error) {
	hosts, err := boundSoon(ctx, egress, cmp.Or(opts.BoundWait, boundWait), opts.Log)
	if err != nil {
		return nil, err
	}

	bound := make(map[string]bool, len(hosts))
	for _, host := range hosts {
		bound[allowlist.Normal(host)] = true
	}

	issuer, err := authority.New(time.Now(), hosts)
	if err != nil {
		return nil, err
	}

	opts.Listen = or(opts.Listen, Listen)
	opts.Authority = or(opts.Authority, protocol.SandboxAuthority)
	opts.Bundle = or(opts.Bundle, protocol.SandboxBundle)

	listener, err := net.Listen("tcp", opts.Listen)
	if err != nil {
		return nil, fmt.Errorf("listen for the local proxy: %w", err)
	}

	proxy := &LocalProxy{
		egress:    egress,
		authority: issuer,
		bound:     bound,
		direct:    opts.Direct,
		paths:     opts,
		listener:  listener,
		dialer:    &net.Dialer{Timeout: dialTimeout, KeepAlive: 30 * time.Second},
		log:       opts.Log,
	}
	proxy.plain = &http.Transport{Proxy: nil, DialContext: proxy.dialOut, IdleConnTimeout: 90 * time.Second}
	proxy.server = &http.Server{
		Handler:           proxy,
		ReadHeaderTimeout: time.Minute,
		ErrorLog:          slog.NewLogLogger(opts.Log.Handler(), slog.LevelDebug),
	}

	go func() { _ = proxy.server.Serve(listener) }()
	opts.Log.Info("opened the local proxy", "listen", listener.Addr().String(), "bound", hosts, "direct", opts.Direct)

	return proxy, nil
}

func boundSoon(ctx context.Context, egress *Egress, wait time.Duration, log *slog.Logger) ([]string, error) {
	waiting, cancel := context.WithTimeout(ctx, wait)
	defer cancel()

	backoff := boundFloor
	for {
		hosts, err := egress.Bound(waiting)
		if err == nil || !passing(err) {
			return hosts, err
		}

		log.Info("egress has not fetched the run's secrets yet, tries again", "error", err, "retryIn", backoff)
		select {
		case <-waiting.Done():
			return nil, fmt.Errorf("egress sent no bound hosts within %s: %w", wait, err)
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, boundCeiling)
	}
}

func passing(err error) bool {
	httpError := (*HTTPError)(nil)
	if !errors.As(err, &httpError) {
		return true
	}
	return httpError.Status == http.StatusConflict || httpError.Status == http.StatusTooManyRequests ||
		httpError.Status >= http.StatusInternalServerError
}

func (p *LocalProxy) PEM() []byte {
	return p.authority.PEM()
}

func (p *LocalProxy) Env() map[string]string {
	proxy := "http://" + p.listener.Addr().String()
	local := "localhost,127.0.0.1,::1"

	return map[string]string{
		"HTTP_PROXY":          proxy,
		"HTTPS_PROXY":         proxy,
		"http_proxy":          proxy,
		"https_proxy":         proxy,
		"NO_PROXY":            local,
		"no_proxy":            local,
		"SSL_CERT_FILE":       p.paths.Bundle,
		"REQUESTS_CA_BUNDLE":  p.paths.Bundle,
		"CURL_CA_BUNDLE":      p.paths.Bundle,
		"GIT_SSL_CAINFO":      p.paths.Bundle,
		"NODE_EXTRA_CA_CERTS": p.paths.Authority,
		"NODE_USE_ENV_PROXY":  "1",
	}
}

func (p *LocalProxy) Close() error {
	err := p.server.Close()
	p.plain.CloseIdleConnections()
	p.egress.close()
	return err
}

func (p *LocalProxy) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	switch {
	case r.Method == http.MethodConnect:
		p.connect(rw, r)
	case r.URL.IsAbs():
		p.forwardPlain(rw, r)
	default:
		http.Error(rw, "The local proxy accepts only an absolute URL or CONNECT. Send an absolute URL, or CONNECT to a host.", http.StatusBadRequest)
	}
}

func (p *LocalProxy) connect(rw http.ResponseWriter, r *http.Request) {
	target := r.Host
	host, port, err := net.SplitHostPort(target)
	if err != nil {
		host, port = target, "443"
		target = net.JoinHostPort(host, port)
	}

	if port == "443" && p.bound[allowlist.Normal(host)] {
		p.intercept(rw, allowlist.Normal(host))
		return
	}

	upstream, err := p.dialOut(r.Context(), "tcp", target)
	if err != nil {
		p.fail(rw, target, err)
		return
	}
	defer upstream.Close()

	client, buffered, err := tunnel.Hijack(rw)
	if err != nil {
		p.log.Warn("could not take over a connection to tunnel it", "error", err)
		return
	}
	defer client.Close()

	if _, err := client.Write([]byte(tunnel.Established)); err != nil {
		return
	}
	tunnel.Relay(client, buffered, upstream)
}

func (p *LocalProxy) fail(rw http.ResponseWriter, target string, err error) {
	if httpError := (*HTTPError)(nil); errors.As(err, &httpError) {
		http.Error(rw, httpError.Text, httpError.Status)
		return
	}

	http.Error(rw, fmt.Sprintf("The local proxy could not reach %s. Error: %v", target, err), http.StatusBadGateway)
}

func (p *LocalProxy) intercept(rw http.ResponseWriter, host string) {
	certificate, err := p.authority.For(host)
	if err != nil {
		http.Error(rw, fmt.Sprintf("The local proxy could not intercept TLS for %s. Error: %v", host, err), http.StatusBadGateway)
		return
	}

	client, buffered, err := tunnel.Hijack(rw)
	if err != nil {
		p.log.Warn("could not take over a connection to forward it", "error", err)
		return
	}

	if _, err := client.Write([]byte(tunnel.Established)); err != nil {
		client.Close()
		return
	}

	secured := tls.Server(tunnel.Buffered(client, buffered), &tls.Config{
		Certificates: []tls.Certificate{*certificate},
		NextProtos:   []string{"http/1.1"},
		MinVersion:   tls.VersionTLS12,
	})

	server := &http.Server{
		Handler:           p.egress.forwarding(host, p.failedFor(host)),
		ReadHeaderTimeout: time.Minute,
		ErrorLog:          slog.NewLogLogger(p.log.Handler(), slog.LevelDebug),
	}
	_ = server.Serve(tunnel.One(secured))
}

func (p *LocalProxy) forwardPlain(rw http.ResponseWriter, r *http.Request) {
	host := r.URL.Hostname()

	(&httputil.ReverseProxy{
		Rewrite: func(out *httputil.ProxyRequest) {
			out.Out.URL = out.In.URL
			out.Out.Host = out.In.URL.Host
			out.Out.Header.Del("Proxy-Authorization")
			out.Out.Header.Del("Proxy-Connection")
		},
		Transport:     p.plain,
		FlushInterval: -1,
		ErrorHandler:  p.failedFor(host),
	}).ServeHTTP(rw, r)
}

func (p *LocalProxy) failedFor(host string) func(http.ResponseWriter, *http.Request, error) {
	return func(rw http.ResponseWriter, _ *http.Request, err error) {
		if errors.Is(err, context.Canceled) {
			return
		}

		if failure := (*url.Error)(nil); errors.As(err, &failure) {
			err = failure.Err
		}
		if httpError := (*HTTPError)(nil); errors.As(err, &httpError) {
			http.Error(rw, httpError.Text, httpError.Status)
			return
		}

		p.log.Warn("could not pass a request on", "host", host, "error", err)
		http.Error(rw, fmt.Sprintf("The local proxy could not reach %s.", host), http.StatusBadGateway)
	}
}

func (p *LocalProxy) dialOut(ctx context.Context, network, address string) (net.Conn, error) {
	if p.direct {
		return p.dialer.DialContext(ctx, network, address)
	}
	return p.egress.Dial(ctx, network, address)
}

func Enforced(ctx context.Context, controlPlane string) bool {
	at, err := url.Parse(controlPlane)
	if err != nil || at.Hostname() == "" {
		return false
	}

	port := at.Port()
	if port == "" {
		port = strconv.Itoa(map[string]int{"https": 443, "http": 80}[at.Scheme])
	}

	checking, cancel := context.WithTimeout(ctx, checkTimeout)
	defer cancel()

	conn, err := (&net.Dialer{}).DialContext(checking, "tcp", net.JoinHostPort(at.Hostname(), port))
	if err != nil {
		return true
	}
	_ = conn.Close()

	return false
}

func or(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
