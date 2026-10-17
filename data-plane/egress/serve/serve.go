package serve

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"usespotlight.ai/data-plane/allowlist"
	"usespotlight.ai/data-plane/egressing/guard"
	"usespotlight.ai/data-plane/egressing/inject"
	"usespotlight.ai/data-plane/egressing/seal"
	"usespotlight.ai/data-plane/egressing/tunnel"
	"usespotlight.ai/data-plane/protocol"
)

const (
	shutdownGrace = 5 * time.Second
	idleFor       = 2 * time.Minute
)

type ControlPlane interface {
	AuthorizeEgress(ctx context.Context, proxyCredential string) (protocol.EgressAuthorizeResponse, error)
	FetchRunSecretsFor(ctx context.Context, proxyCredential, recipient string) (protocol.EgressSecrets, error)
	ActiveRuns(ctx context.Context, proxyCredentials []string) ([]string, error)
	RecordConnections(ctx context.Context, records []protocol.EgressConnection) error
}

type Egress struct {
	settings Settings
	control  ControlPlane
	key      *seal.Key
	reader   func() (inject.Reader, error)
	limits   *limits
	records  *records
	log      *slog.Logger
	now      func() time.Time
	dial     func(ctx context.Context, network, address string) (net.Conn, error)

	authorizeLimits *limits

	mu         sync.Mutex
	runs       map[string]*run
	rejections map[string]rejection

	tunnelling sync.Mutex
	tunnels    map[net.Conn]bool
	tunnelled  sync.WaitGroup
}

func New(settings Settings, control ControlPlane, reader func() (inject.Reader, error), log *slog.Logger) (*Egress, error) {
	key, err := seal.NewKey()
	if err != nil {
		return nil, err
	}

	dial := settings.Dial
	if dial == nil {
		dial = guard.Dialer().DialContext
	}

	return &Egress{
		settings:        settings,
		control:         control,
		key:             key,
		reader:          reader,
		limits:          newLimits(settings.Rate, settings.Connections, time.Now),
		records:         &records{control: control, log: log},
		log:             log,
		now:             time.Now,
		dial:            dial,
		authorizeLimits: newLimits(authorizeRate, 0, time.Now),
		runs:            map[string]*run{},
		rejections:      map[string]rejection{},
		tunnels:         map[net.Conn]bool{},
	}, nil
}

func (e *Egress) Serve(ctx context.Context, listener net.Listener) error {
	protocols := new(http.Protocols)
	protocols.SetHTTP1(true)
	protocols.SetHTTP2(true)

	server := &http.Server{
		Handler:           e,
		ReadHeaderTimeout: time.Minute,
		IdleTimeout:       idleFor,
		ErrorLog:          slog.NewLogLogger(e.log.Handler(), slog.LevelDebug),
		Protocols:         protocols,
	}
	if e.settings.Certificate != nil {
		server.TLSConfig = &tls.Config{Certificates: []tls.Certificate{*e.settings.Certificate}, MinVersion: tls.VersionTLS12}
	} else {
		protocols.SetUnencryptedHTTP2(true)
	}

	maintaining, stopMaintaining := context.WithCancel(context.WithoutCancel(ctx))
	maintained := make(chan struct{})
	go func() {
		defer close(maintained)
		e.maintain(maintaining)
	}()

	serving := make(chan error, 1)
	go func() {
		if server.TLSConfig != nil {
			serving <- server.ServeTLS(listener, "", "")
			return
		}
		serving <- server.Serve(listener)
	}()

	var err error
	select {
	case err = <-serving:
	case <-ctx.Done():
		stopping, cancel := context.WithTimeout(context.Background(), shutdownGrace)
		_ = server.Shutdown(stopping)
		cancel()
	}

	stopMaintaining()
	<-maintained
	e.closeTunnels()

	flushing, cancel := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancel()
	e.evict(flushing, e.allRuns(), "egress stopped")
	e.records.flush(flushing)

	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (e *Egress) allRuns() []*run {
	e.mu.Lock()
	defer e.mu.Unlock()

	runs := make([]*run, 0, len(e.runs))
	for _, found := range e.runs {
		runs = append(runs, found)
	}
	return runs
}

func (e *Egress) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	credential, ok := proxyCredential(r)
	if !ok {
		w.Header().Set("Proxy-Authenticate", `Basic realm="spotlight egress"`)
		http.Error(w, "Egress answers only a sandbox that sends its proxy credential.", http.StatusProxyAuthRequired)
		return
	}

	if r.Method == http.MethodConnect && r.ProtoMajor != 1 {
		http.Error(w, "Egress tunnels only over HTTP/1.1. Please CONNECT over HTTP/1.1.", http.StatusHTTPVersionNotSupported)
		return
	}

	found, err := e.authorized(r.Context(), credential, sourceOf(r))
	switch {
	case errors.Is(err, errAuthorizeTooFast):
		http.Error(w, "Sorry, egress authorizes too many sandboxes at once. Please try again in a second.", http.StatusTooManyRequests)
		return
	case isRejected(err):
		w.Header().Set("Proxy-Authenticate", `Basic realm="spotlight egress"`)
		http.Error(w, "Egress does not know this sandbox.", http.StatusProxyAuthRequired)
		return
	case err != nil:
		e.log.Warn("could not authorize a sandbox", "error", err)
		http.Error(w, "Egress could not get an answer from the control plane about this sandbox. Please try again.", http.StatusBadGateway)
		return
	}

	defer e.leave(found)

	if !e.forControlPlane(r, found) {
		release, reason := e.limits.take(found.workspace)
		if reason != "" {
			http.Error(w, reason, http.StatusTooManyRequests)
			return
		}
		defer release()
	}

	switch {
	case r.Method == http.MethodConnect:
		e.connect(w, r, found)
	case r.Header.Get(protocol.EgressTargetHeader) != "":
		e.forward(w, r, found)
	case r.Method == http.MethodGet && r.URL.Path == protocol.EgressBoundPath:
		e.bound(w, r, found)
	default:
		http.Error(w, fmt.Sprintf(
			"Egress takes a CONNECT, a request that names its target in %s, or GET %s.",
			protocol.EgressTargetHeader, protocol.EgressBoundPath,
		), http.StatusBadRequest)
	}
}

func (e *Egress) forControlPlane(r *http.Request, found *run) bool {
	if r.Method != http.MethodConnect {
		return false
	}
	host, port := hostPort(r.Host)
	return found.controlPlaneAt(host, port)
}

func hostPort(target string) (string, string) {
	host, port, err := net.SplitHostPort(target)
	if err != nil {
		host, port = target, "443"
	}
	return allowlist.Normal(host), port
}

func sourceOf(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (e *Egress) track(conn net.Conn) bool {
	e.tunnelling.Lock()
	defer e.tunnelling.Unlock()

	if e.tunnels == nil {
		return false
	}
	e.tunnels[conn] = true
	e.tunnelled.Add(1)
	return true
}

func (e *Egress) untrack(conn net.Conn) {
	e.tunnelling.Lock()
	defer e.tunnelling.Unlock()

	delete(e.tunnels, conn)
	e.tunnelled.Done()
}

func (e *Egress) closeTunnels() {
	e.tunnelling.Lock()
	open := e.tunnels
	e.tunnels = nil
	e.tunnelling.Unlock()

	for conn := range open {
		_ = conn.Close()
	}

	closed := make(chan struct{})
	go func() {
		e.tunnelled.Wait()
		close(closed)
	}()
	select {
	case <-closed:
	case <-time.After(shutdownGrace):
	}
}

func proxyCredential(r *http.Request) (string, bool) {
	scheme, credentials, ok := strings.Cut(r.Header.Get("Proxy-Authorization"), " ")
	if !ok || !strings.EqualFold(scheme, "basic") {
		return "", false
	}

	decoded, err := base64.StdEncoding.DecodeString(credentials)
	if err != nil {
		return "", false
	}
	_, password, _ := strings.Cut(string(decoded), ":")

	return password, password != ""
}

func (e *Egress) bound(w http.ResponseWriter, r *http.Request, found *run) {
	if err := e.fetchSecretsNow(r.Context(), found); err != nil {
		e.couldNotFetchSecrets(w, err)
		return
	}

	hosts, fetched := found.boundList()
	if !fetched {
		http.Error(w, "Egress has no run for this sandbox yet. Please try again after the claim.", http.StatusConflict)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(protocol.EgressBound{Hosts: hosts})
}

func (e *Egress) couldNotFetchSecrets(w http.ResponseWriter, err error) {
	e.log.Warn("could not fetch a run's secrets", "error", err)
	http.Error(w, "Egress could not get the run's secrets from the control plane. Please try again.", http.StatusBadGateway)
}

func (e *Egress) connect(w http.ResponseWriter, r *http.Request, found *run) {
	host, port := hostPort(r.Host)
	target := net.JoinHostPort(host, port)

	if !found.controlPlaneAt(host, port) {
		if err := e.fetchSecrets(r.Context(), found); err != nil {
			e.couldNotFetchSecrets(w, err)
			return
		}
	}

	started := e.now()
	allowed, named := found.allows(host, port)
	if !allowed {
		e.record(found, host, port, started, protocol.EgressConnection{Outcome: protocol.ConnectionBlocked, Reason: protocol.ReasonNotAllowed})
		e.log.Warn("blocked a tunnel to a host the run may not connect to", "host", host)
		http.Error(w, fmt.Sprintf("Egress does not allow this sandbox to connect to %s.", host), http.StatusForbidden)
		return
	}

	upstream, err := e.dial(guard.Naming(r.Context(), named), "tcp", target)
	if err != nil {
		if !errors.Is(err, context.Canceled) {
			e.record(found, host, port, started, unreached(err))
		}
		http.Error(w, fmt.Sprintf("Egress could not reach %s. Error: %v", target, err), http.StatusBadGateway)
		return
	}
	defer upstream.Close()

	client, buffered, err := tunnel.Hijack(w)
	if err != nil {
		http.Error(w, "Egress tunnels only over HTTP/1.1. Please CONNECT over HTTP/1.1.", http.StatusHTTPVersionNotSupported)
		return
	}
	defer client.Close()
	if !e.track(client) {
		return
	}
	defer e.untrack(client)

	if _, err := client.Write([]byte(tunnel.Established)); err != nil {
		return
	}

	out, in := tunnel.Splice(client, buffered, upstream)
	e.record(found, host, port, started, protocol.EgressConnection{BytesOut: out, BytesIn: in, Outcome: protocol.ConnectionPassthrough})
}

func (e *Egress) forward(w http.ResponseWriter, r *http.Request, found *run) {
	target := r.Header.Get(protocol.EgressTargetHeader)
	host, port, err := net.SplitHostPort(target)
	if err != nil || port != "443" {
		http.Error(w, fmt.Sprintf("%s must be a host and port 443, such as api.example.com:443.", protocol.EgressTargetHeader), http.StatusBadRequest)
		return
	}
	host = allowlist.Normal(host)

	if err := e.fetchSecrets(r.Context(), found); err != nil {
		e.couldNotFetchSecrets(w, err)
		return
	}

	started := e.now()
	way, ok := found.bindsFor(host)
	if !ok {
		e.record(found, host, port, started, protocol.EgressConnection{Outcome: protocol.ConnectionBlocked, Reason: protocol.ReasonNotBound})
		http.Error(w, fmt.Sprintf(
			"Egress forwards a request only to a host that a secret of this run is bound to, and %s is not one. Please CONNECT to other hosts.", host,
		), http.StatusForbidden)
		return
	}

	metered := &metered{next: way.transport}
	status := 0
	var failure error
	// Keep: ServeHTTP panics with http.ErrAbortHandler when it cannot copy the body.
	defer func() {
		switch {
		case errors.Is(failure, context.Canceled):
		case failure != nil:
			e.record(found, host, port, started, unreached(failure))
		default:
			e.record(found, host, port, started, protocol.EgressConnection{
				BytesOut: metered.out.Load(), BytesIn: metered.in.Load(), Outcome: protocol.ConnectionInjected, Status: status,
			})
		}
	}()

	(&httputil.ReverseProxy{
		Rewrite: func(out *httputil.ProxyRequest) {
			out.Out = out.Out.WithContext(guard.Naming(out.Out.Context(), way.named))
			out.Out.URL.Scheme = "https"
			out.Out.URL.Host = host + ":443"
			out.Out.Host = host
			out.Out.Header.Del("Proxy-Authorization")
			out.Out.Header.Del(protocol.EgressTargetHeader)
			out.Out.Header.Del("Accept-Encoding")
			way.injector.Inject(host, out.Out)
		},
		ModifyResponse: func(response *http.Response) error {
			status = response.StatusCode
			way.injector.Redact(host, response)
			return nil
		},
		Transport:     metered,
		FlushInterval: -1,
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			failure = err
			e.failedFor(host)(w, r, err)
		},
	}).ServeHTTP(w, r)
}

func (e *Egress) failedFor(host string) func(http.ResponseWriter, *http.Request, error) {
	return func(w http.ResponseWriter, _ *http.Request, err error) {
		if errors.Is(err, context.Canceled) {
			return
		}

		if failure := (*url.Error)(nil); errors.As(err, &failure) {
			err = failure.Err
		}

		e.log.Warn("could not pass a request on", "host", host, "error", err)
		http.Error(w, fmt.Sprintf("Egress could not reach %s.", host), http.StatusBadGateway)
	}
}

func (e *Egress) record(found *run, host, port string, started time.Time, record protocol.EgressConnection) {
	record.ProxyCredential = found.credential
	record.Host = host
	record.Port, _ = strconv.Atoi(port)
	record.Ms = e.now().Sub(started).Milliseconds()
	record.At = started.UTC()
	e.records.add(record)
}

func unreached(err error) protocol.EgressConnection {
	if blocked := (*guard.Blocked)(nil); errors.As(err, &blocked) {
		return protocol.EgressConnection{Outcome: protocol.ConnectionBlocked, Reason: protocol.ReasonPrivateAddress}
	}
	return protocol.EgressConnection{Outcome: protocol.ConnectionFailed, Reason: reasonOf(err)}
}

func reasonOf(err error) string {
	var unknown *net.DNSError
	if errors.As(err, &unknown) && unknown.IsNotFound {
		return protocol.ReasonNoSuchHost
	}

	var late interface{ Timeout() bool }
	if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &late) && late.Timeout()) {
		return protocol.ReasonTimedOut
	}

	var unverified *tls.CertificateVerificationError
	var alert tls.AlertError
	var header tls.RecordHeaderError
	var remote *net.OpError
	if errors.As(err, &unverified) || errors.As(err, &alert) || errors.As(err, &header) ||
		(errors.As(err, &remote) && remote.Op == "remote error") {
		return protocol.ReasonTLSFailed
	}

	return protocol.ReasonUnreachable
}

type metered struct {
	next    http.RoundTripper
	out, in atomic.Int64
}

func (m *metered) RoundTrip(request *http.Request) (*http.Response, error) {
	if request.Body != nil && request.Body != http.NoBody {
		request.Body = &counted{ReadCloser: request.Body, bytes: &m.out}
	}

	response, err := m.next.RoundTrip(request)
	if err != nil {
		return nil, err
	}

	m.out.Add(requestHead(request))
	m.in.Add(responseHead(response))
	if response.Body != nil {
		response.Body = &counted{ReadCloser: response.Body, bytes: &m.in}
	}
	return response, nil
}

func requestHead(request *http.Request) int64 {
	head := &tally{}
	fmt.Fprintf(head, "%s %s HTTP/1.1\r\nHost: %s\r\n", request.Method, request.URL.RequestURI(), request.Host)
	if request.ContentLength > 0 {
		fmt.Fprintf(head, "Content-Length: %d\r\n", request.ContentLength)
	}
	_ = request.Header.Write(head)
	return head.bytes + 2
}

func responseHead(response *http.Response) int64 {
	head := &tally{}
	fmt.Fprintf(head, "HTTP/1.1 %s\r\n", response.Status)
	_ = response.Header.Write(head)
	return head.bytes + 2
}

type tally struct {
	bytes int64
}

func (t *tally) Write(b []byte) (int, error) {
	t.bytes += int64(len(b))
	return len(b), nil
}

type counted struct {
	io.ReadCloser
	bytes *atomic.Int64
}

func (c *counted) Read(b []byte) (int, error) {
	read, err := c.ReadCloser.Read(b)
	c.bytes.Add(int64(read))
	return read, err
}
