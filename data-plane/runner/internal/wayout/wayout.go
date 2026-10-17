package wayout

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

	"usespotlight.ai/data-plane/egressing/authority"
	"usespotlight.ai/data-plane/egressing/tunnel"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
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

type WayOut struct {
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

func Open(ctx context.Context, egress *Egress, opts Options) (*WayOut, error) {
	hosts, err := boundSoon(ctx, egress, cmp.Or(opts.BoundWait, boundWait), opts.Log)
	if err != nil {
		return nil, err
	}

	bound := make(map[string]bool, len(hosts))
	for _, host := range hosts {
		bound[reach.Normal(host)] = true
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
		return nil, fmt.Errorf("listen for the way out: %w", err)
	}

	way := &WayOut{
		egress:    egress,
		authority: issuer,
		bound:     bound,
		direct:    opts.Direct,
		paths:     opts,
		listener:  listener,
		dialer:    &net.Dialer{Timeout: dialTimeout, KeepAlive: 30 * time.Second},
		log:       opts.Log,
	}
	way.plain = &http.Transport{Proxy: nil, DialContext: way.dialOut, IdleConnTimeout: 90 * time.Second}
	way.server = &http.Server{
		Handler:           way,
		ReadHeaderTimeout: time.Minute,
		ErrorLog:          slog.NewLogLogger(opts.Log.Handler(), slog.LevelDebug),
	}

	go func() { _ = way.server.Serve(listener) }()
	opts.Log.Info("opened the way out", "listen", listener.Addr().String(), "bound", hosts, "direct", opts.Direct)

	return way, nil
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

		log.Info("egress has not fetched the run's secrets yet, asks again", "error", err, "retryIn", backoff)
		select {
		case <-waiting.Done():
			return nil, fmt.Errorf("egress gave no bound hosts within %s: %w", wait, err)
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, boundCeiling)
	}
}

func passing(err error) bool {
	refused := (*Refused)(nil)
	if !errors.As(err, &refused) {
		return true
	}
	return refused.Status == http.StatusConflict || refused.Status == http.StatusTooManyRequests ||
		refused.Status >= http.StatusInternalServerError
}

func (w *WayOut) PEM() []byte {
	return w.authority.PEM()
}

func (w *WayOut) Env() map[string]string {
	proxy := "http://" + w.listener.Addr().String()
	local := "localhost,127.0.0.1,::1"

	return map[string]string{
		"HTTP_PROXY":          proxy,
		"HTTPS_PROXY":         proxy,
		"http_proxy":          proxy,
		"https_proxy":         proxy,
		"NO_PROXY":            local,
		"no_proxy":            local,
		"SSL_CERT_FILE":       w.paths.Bundle,
		"REQUESTS_CA_BUNDLE":  w.paths.Bundle,
		"CURL_CA_BUNDLE":      w.paths.Bundle,
		"GIT_SSL_CAINFO":      w.paths.Bundle,
		"NODE_EXTRA_CA_CERTS": w.paths.Authority,
		"NODE_USE_ENV_PROXY":  "1",
	}
}

func (w *WayOut) Close() error {
	err := w.server.Close()
	w.plain.CloseIdleConnections()
	w.egress.close()
	return err
}

func (w *WayOut) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	switch {
	case r.Method == http.MethodConnect:
		w.connect(rw, r)
	case r.URL.IsAbs():
		w.forwardPlain(rw, r)
	default:
		http.Error(rw, "The way out is a proxy. Please ask it for an absolute URL, or CONNECT to a host.", http.StatusBadRequest)
	}
}

func (w *WayOut) connect(rw http.ResponseWriter, r *http.Request) {
	target := r.Host
	host, port, err := net.SplitHostPort(target)
	if err != nil {
		host, port = target, "443"
		target = net.JoinHostPort(host, port)
	}

	if port == "443" && w.bound[reach.Normal(host)] {
		w.intercept(rw, reach.Normal(host))
		return
	}

	upstream, err := w.dialOut(r.Context(), "tcp", target)
	if err != nil {
		w.refuse(rw, target, err)
		return
	}
	defer upstream.Close()

	client, buffered, err := tunnel.Hijack(rw)
	if err != nil {
		w.log.Warn("could not take over a connection to tunnel it", "error", err)
		return
	}
	defer client.Close()

	if _, err := client.Write([]byte(tunnel.Established)); err != nil {
		return
	}
	tunnel.Splice(client, buffered, upstream)
}

func (w *WayOut) refuse(rw http.ResponseWriter, target string, err error) {
	if refused := (*Refused)(nil); errors.As(err, &refused) {
		http.Error(rw, refused.Text, refused.Status)
		return
	}

	http.Error(rw, fmt.Sprintf("The way out could not reach %s. Error: %v", target, err), http.StatusBadGateway)
}

func (w *WayOut) intercept(rw http.ResponseWriter, host string) {
	certificate, err := w.authority.For(host)
	if err != nil {
		http.Error(rw, fmt.Sprintf("The way out could not intercept TLS for %s. Error: %v", host, err), http.StatusBadGateway)
		return
	}

	client, buffered, err := tunnel.Hijack(rw)
	if err != nil {
		w.log.Warn("could not take over a connection to forward it", "error", err)
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
		Handler:           w.egress.forwarding(host, w.failedFor(host)),
		ReadHeaderTimeout: time.Minute,
		ErrorLog:          slog.NewLogLogger(w.log.Handler(), slog.LevelDebug),
	}
	_ = server.Serve(tunnel.One(secured))
}

func (w *WayOut) forwardPlain(rw http.ResponseWriter, r *http.Request) {
	host := r.URL.Hostname()

	(&httputil.ReverseProxy{
		Rewrite: func(out *httputil.ProxyRequest) {
			out.Out.URL = out.In.URL
			out.Out.Host = out.In.URL.Host
			out.Out.Header.Del("Proxy-Authorization")
			out.Out.Header.Del("Proxy-Connection")
		},
		Transport:     w.plain,
		FlushInterval: -1,
		ErrorHandler:  w.failedFor(host),
	}).ServeHTTP(rw, r)
}

func (w *WayOut) failedFor(host string) func(http.ResponseWriter, *http.Request, error) {
	return func(rw http.ResponseWriter, _ *http.Request, err error) {
		if errors.Is(err, context.Canceled) {
			return
		}

		if failure := (*url.Error)(nil); errors.As(err, &failure) {
			err = failure.Err
		}
		if refused := (*Refused)(nil); errors.As(err, &refused) {
			http.Error(rw, refused.Text, refused.Status)
			return
		}

		w.log.Warn("could not pass a request on", "host", host, "error", err)
		http.Error(rw, fmt.Sprintf("The way out could not reach %s.", host), http.StatusBadGateway)
	}
}

func (w *WayOut) dialOut(ctx context.Context, network, address string) (net.Conn, error) {
	if w.direct {
		return w.dialer.DialContext(ctx, network, address)
	}
	return w.egress.Dial(ctx, network, address)
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
