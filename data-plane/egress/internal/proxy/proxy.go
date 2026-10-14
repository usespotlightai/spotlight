package proxy

import (
	"bufio"
	"context"
	"crypto/subtle"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

	"usespotlight.ai/data-plane/egress/internal/guard"
)

type Allowed interface {
	Admits(host string) bool
	Names(host string) bool
}

type Wearing interface {
	Wears(host string) bool
	Onto(host string, r *http.Request)
	OntoPlain(host, port string, r *http.Request)
	Unwear(host string, response *http.Response)
}

type Certificates interface {
	For(host string) (*tls.Certificate, error)
}

type Proxy struct {
	allowed      Allowed
	wearing      Wearing
	certificates Certificates
	credential   string
	log          *slog.Logger
	dial         func(ctx context.Context, network, address string) (net.Conn, error)
	transport    *http.Transport
}

func New(allowed Allowed, wearing Wearing, certificates Certificates, credential string, log *slog.Logger) *Proxy {
	dialer := guard.Dialer()

	return &Proxy{
		allowed:      allowed,
		wearing:      wearing,
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
	if !p.admitted(r) {
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
		http.Error(w, "Egress is a proxy. Please ask it for an absolute URL, or CONNECT to a host.", http.StatusBadRequest)
	}
}

func (p *Proxy) admitted(r *http.Request) bool {
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

	if !p.allowed.Admits(host) {
		p.refuse(w, r, host)
		return
	}

	if port == "443" && p.wearing.Wears(host) {
		p.intercept(w, r, host, target)
		return
	}

	p.tunnel(w, r, host, target)
}

func (p *Proxy) refuse(w http.ResponseWriter, r *http.Request, host string) {
	p.log.Warn("refused a request to a host the sandbox may not reach", "host", host, "method", r.Method)
	http.Error(w, fmt.Sprintf("Egress doesn't let this sandbox reach %s.", host), http.StatusForbidden)
}

func (p *Proxy) tunnel(w http.ResponseWriter, r *http.Request, host, target string) {
	upstream, err := p.dial(guard.Naming(r.Context(), p.allowed.Names(host)), "tcp", target)
	if err != nil {
		http.Error(w, fmt.Sprintf("Egress couldn't reach %s. Error: %v", target, err), http.StatusBadGateway)
		return
	}
	defer upstream.Close()

	client, buffered, err := hijack(w)
	if err != nil {
		p.log.Warn("could not take over a connection to tunnel it", "error", err)
		return
	}
	defer client.Close()

	if _, err := client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n")); err != nil {
		return
	}

	var copying sync.WaitGroup
	copying.Go(func() {
		_, _ = io.Copy(upstream, buffered)
		closeWrite(upstream)
	})
	_, _ = io.Copy(client, upstream)
	closeWrite(client)
	copying.Wait()
}

func (p *Proxy) intercept(w http.ResponseWriter, r *http.Request, host, target string) {
	certificate, err := p.certificates.For(host)
	if err != nil {
		http.Error(w, fmt.Sprintf("Egress couldn't stand in for %s. Error: %v", host, err), http.StatusBadGateway)
		return
	}

	client, buffered, err := hijack(w)
	if err != nil {
		p.log.Warn("could not take over a connection to wear secrets on it", "error", err)
		return
	}

	if _, err := client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n")); err != nil {
		client.Close()
		return
	}

	secured := tls.Server(&bufferedConn{Conn: client, reader: buffered}, &tls.Config{
		Certificates: []tls.Certificate{*certificate},
		NextProtos:   []string{"http/1.1"},
		MinVersion:   tls.VersionTLS12,
	})

	server := &http.Server{
		Handler:           p.wearingTo(host, target),
		ReadHeaderTimeout: time.Minute,
		ErrorLog:          slog.NewLogLogger(p.log.Handler(), slog.LevelDebug),
	}
	_ = server.Serve(&oneConn{conn: secured})
}

func (p *Proxy) wearingTo(host, target string) http.Handler {
	authority := target
	if strings.HasSuffix(target, ":443") {
		authority = host
	}

	return &httputil.ReverseProxy{
		Rewrite: func(out *httputil.ProxyRequest) {
			out.Out = out.Out.WithContext(guard.Naming(out.Out.Context(), p.allowed.Names(host)))
			out.Out.URL.Scheme = "https"
			out.Out.URL.Host = target
			out.Out.Host = authority
			out.Out.Header.Del("Proxy-Authorization")
			out.Out.Header.Del("Accept-Encoding")
			p.wearing.Onto(host, out.Out)
		},
		ModifyResponse: func(response *http.Response) error {
			p.wearing.Unwear(host, response)
			return nil
		},
		Transport:     p.transport,
		FlushInterval: -1,
		ErrorHandler:  p.failed,
	}
}

func (p *Proxy) forward(w http.ResponseWriter, r *http.Request) {
	host := r.URL.Hostname()
	if !p.allowed.Admits(host) {
		p.refuse(w, r, host)
		return
	}

	(&httputil.ReverseProxy{
		Rewrite: func(out *httputil.ProxyRequest) {
			out.Out = out.Out.WithContext(guard.Naming(out.Out.Context(), p.allowed.Names(host)))
			out.Out.URL = out.In.URL
			out.Out.Host = out.In.URL.Host
			out.Out.Header.Del("Proxy-Authorization")
			out.Out.Header.Del("Proxy-Connection")
			p.wearing.OntoPlain(host, portOf(out.In.URL), out.Out)
		},
		ModifyResponse: func(response *http.Response) error {
			p.wearing.Unwear(host, response)
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

func hijack(w http.ResponseWriter) (net.Conn, *bufio.Reader, error) {
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("the connection cannot be taken over")
	}

	conn, buffered, err := hijacker.Hijack()
	if err != nil {
		return nil, nil, err
	}

	return conn, buffered.Reader, nil
}

func closeWrite(conn net.Conn) {
	if half, ok := conn.(interface{ CloseWrite() error }); ok {
		_ = half.CloseWrite()
	}
}

type bufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (c *bufferedConn) Read(b []byte) (int, error) {
	return c.reader.Read(b)
}

type oneConn struct {
	conn   net.Conn
	once   sync.Once
	closed chan struct{}
}

func (l *oneConn) Accept() (net.Conn, error) {
	var handed net.Conn

	l.once.Do(func() {
		l.closed = make(chan struct{})
		handed = &closingConn{Conn: l.conn, closed: l.closed}
	})
	if handed != nil {
		return handed, nil
	}

	<-l.closed
	return nil, net.ErrClosed
}

func (l *oneConn) Close() error {
	return nil
}

func (l *oneConn) Addr() net.Addr {
	return l.conn.LocalAddr()
}

type closingConn struct {
	net.Conn
	once   sync.Once
	closed chan struct{}
}

func (c *closingConn) Close() error {
	c.once.Do(func() { close(c.closed) })
	return c.Conn.Close()
}
