package proxy

import (
	"context"
	"crypto/subtle"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"usespotlight.ai/data-plane/egresskit/guard"
	"usespotlight.ai/data-plane/egresskit/tunnel"
)

type Allowed interface {
	Allows(host string) bool
	ExplicitlyListed(host string) bool
}

type Injector interface {
	InjectsFor(host string) bool
	Inject(host string, r *http.Request)
	InjectPlain(host, port string, r *http.Request)
	Redact(host string, response *http.Response)
}

type Certificates interface {
	For(host string) (*tls.Certificate, error)
}

type Proxy struct {
	allowed      Allowed
	injector     Injector
	certificates Certificates
	credential   string
	log          *slog.Logger
	dial         func(ctx context.Context, network, address string) (net.Conn, error)
	transport    *http.Transport
}

func New(allowed Allowed, injector Injector, certificates Certificates, credential string, log *slog.Logger) *Proxy {
	dialer := guard.Dialer()

	return &Proxy{
		allowed:      allowed,
		injector:     injector,
		certificates: certificates,
		credential:   credential,
		log:          log,
		dial:         dialer.DialContext,
		transport: &http.Transport{
			Proxy:                 nil,
			DialContext:           dialer.DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   15 * time.Second,
			ExpectContinueTimeout: time.Second,
		},
	}
}

func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !p.authenticated(r) {
		w.Header().Set("Proxy-Authenticate", `Basic realm="spotlight egress"`)
		http.Error(w, "Egress answers only the sandbox it was started for.", http.StatusProxyAuthRequired)
		return
	}

	switch {
	case r.Method == http.MethodConnect:
		p.connect(w, r)
	case r.URL.IsAbs():
		p.forward(w, r)
	default:
		http.Error(w, "Egress is a proxy. Please send it an absolute URL, or CONNECT to a host.", http.StatusBadRequest)
	}
}

func (p *Proxy) authenticated(r *http.Request) bool {
	scheme, credentials, ok := strings.Cut(r.Header.Get("Proxy-Authorization"), " ")
	if !ok || !strings.EqualFold(scheme, "basic") {
		return false
	}

	decoded, err := base64.StdEncoding.DecodeString(credentials)
	if err != nil {
		return false
	}
	_, password, _ := strings.Cut(string(decoded), ":")

	return subtle.ConstantTimeCompare([]byte(password), []byte(p.credential)) == 1
}

func (p *Proxy) connect(w http.ResponseWriter, r *http.Request) {
	target := r.Host
	host, port, err := net.SplitHostPort(target)
	if err != nil {
		host, port = target, "443"
		target = net.JoinHostPort(host, port)
	}

	if !p.allowed.Allows(host) {
		p.block(w, r, host)
		return
	}

	if port == "443" && p.injector.InjectsFor(host) {
		p.intercept(w, r, host, target)
		return
	}

	p.tunnel(w, r, host, target)
}

func (p *Proxy) block(w http.ResponseWriter, r *http.Request, host string) {
	p.log.Warn("blocked a request to a host the sandbox may not connect to", "host", host, "method", r.Method)
	http.Error(w, fmt.Sprintf("Egress doesn't allow this sandbox to connect to %s.", host), http.StatusForbidden)
}

func (p *Proxy) tunnel(w http.ResponseWriter, r *http.Request, host, target string) {
	upstream, err := p.dial(guard.WithListed(r.Context(), p.allowed.ExplicitlyListed(host)), "tcp", target)
	if err != nil {
		http.Error(w, fmt.Sprintf("Egress couldn't reach %s. Error: %v", target, err), http.StatusBadGateway)
		return
	}
	defer upstream.Close()

	client, buffered, err := tunnel.Hijack(w)
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

func (p *Proxy) intercept(w http.ResponseWriter, r *http.Request, host, target string) {
	certificate, err := p.certificates.For(host)
	if err != nil {
		http.Error(w, fmt.Sprintf("Egress could not intercept TLS for %s. Error: %v", host, err), http.StatusBadGateway)
		return
	}

	client, buffered, err := tunnel.Hijack(w)
	if err != nil {
		p.log.Warn("could not take over a connection to inject secrets into it", "error", err)
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
		Handler:           p.injectingTo(host, target),
		ReadHeaderTimeout: time.Minute,
		ErrorLog:          slog.NewLogLogger(p.log.Handler(), slog.LevelDebug),
	}
	_ = server.Serve(tunnel.One(secured))
}

func (p *Proxy) injectingTo(host, target string) http.Handler {
	authority := target
	if strings.HasSuffix(target, ":443") {
		authority = host
	}

	return &httputil.ReverseProxy{
		Rewrite: func(out *httputil.ProxyRequest) {
			out.Out = out.Out.WithContext(guard.WithListed(out.Out.Context(), p.allowed.ExplicitlyListed(host)))
			out.Out.URL.Scheme = "https"
			out.Out.URL.Host = target
			out.Out.Host = authority
			out.Out.Header.Del("Proxy-Authorization")
			out.Out.Header.Del("Accept-Encoding")
			p.injector.Inject(host, out.Out)
		},
		ModifyResponse: func(response *http.Response) error {
			p.injector.Redact(host, response)
			return nil
		},
		Transport:     p.transport,
		FlushInterval: -1,
		ErrorHandler:  p.failed,
	}
}

func (p *Proxy) forward(w http.ResponseWriter, r *http.Request) {
	host := r.URL.Hostname()
	if !p.allowed.Allows(host) {
		p.block(w, r, host)
		return
	}

	(&httputil.ReverseProxy{
		Rewrite: func(out *httputil.ProxyRequest) {
			out.Out = out.Out.WithContext(guard.WithListed(out.Out.Context(), p.allowed.ExplicitlyListed(host)))
			out.Out.URL = out.In.URL
			out.Out.Host = out.In.URL.Host
			out.Out.Header.Del("Proxy-Authorization")
			out.Out.Header.Del("Proxy-Connection")
			p.injector.InjectPlain(host, portOf(out.In.URL), out.Out)
		},
		ModifyResponse: func(response *http.Response) error {
			p.injector.Redact(host, response)
			return nil
		},
		Transport:     p.transport,
		FlushInterval: -1,
		ErrorHandler:  p.failed,
	}).ServeHTTP(w, r)
}

func portOf(target *url.URL) string {
	if port := target.Port(); port != "" {
		return port
	}
	return "80"
}

func (p *Proxy) failed(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, context.Canceled) {
		return
	}

	if failure := (*url.Error)(nil); errors.As(err, &failure) {
		err = failure.Err
	}

	p.log.Warn("could not pass a request on", "host", r.URL.Hostname(), "error", err)
	http.Error(w, fmt.Sprintf("Egress couldn't reach %s.", r.URL.Host), http.StatusBadGateway)
}
