package wayout

import (
	"bufio"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"usespotlight.ai/data-plane/egressing/tunnel"
	"usespotlight.ai/data-plane/protocol"
)

const dialTimeout = 30 * time.Second

type Egress struct {
	url           *url.URL
	address       string
	authorization string
	tls           *tls.Config
	forward       *http.Transport
	dialer        *net.Dialer
}

type HTTPError struct {
	Status int
	Text   string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("egress answered %d: %s", e.Status, e.Text)
}

func To(address, credential string, roots *x509.CertPool) (*Egress, error) {
	at, err := url.Parse(address)
	if err != nil || (at.Scheme != "https" && at.Scheme != "http") || at.Hostname() == "" {
		return nil, fmt.Errorf("%s %q is not an address such as https://egress.example.com", protocol.EgressURLVar, address)
	}
	if credential == "" {
		return nil, fmt.Errorf("%s is required with %s", protocol.EgressProxyCredentialVar, protocol.EgressURLVar)
	}

	port := at.Port()
	if port == "" {
		port = map[string]string{"https": "443", "http": "80"}[at.Scheme]
	}
	at = &url.URL{Scheme: at.Scheme, Host: net.JoinHostPort(at.Hostname(), port)}

	dialer := &net.Dialer{Timeout: dialTimeout, KeepAlive: 30 * time.Second}
	egress := &Egress{
		url:           at,
		address:       at.Host,
		authorization: "Basic " + base64.StdEncoding.EncodeToString([]byte(protocol.EgressProxyUser+":"+credential)),
		dialer:        dialer,
		forward: &http.Transport{
			Proxy:                 nil,
			DialContext:           dialer.DialContext,
			TLSClientConfig:       &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS12},
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          10,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   15 * time.Second,
			ExpectContinueTimeout: time.Second,
		},
	}
	if at.Scheme == "https" {
		egress.tls = &tls.Config{
			RootCAs:    roots,
			ServerName: at.Hostname(),
			NextProtos: []string{"http/1.1"},
			MinVersion: tls.VersionTLS12,
		}
	}

	return egress, nil
}

func (e *Egress) Dial(ctx context.Context, _, address string) (net.Conn, error) {
	conn, err := e.dialer.DialContext(ctx, "tcp", e.address)
	if err != nil {
		return nil, fmt.Errorf("reach egress: %w", err)
	}

	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	} else {
		_ = conn.SetDeadline(time.Now().Add(dialTimeout))
	}

	if e.tls != nil {
		secured := tls.Client(conn, e.tls)
		if err := secured.HandshakeContext(ctx); err != nil {
			conn.Close()
			return nil, fmt.Errorf("reach egress: %w", err)
		}
		conn = secured
	}

	connect := &http.Request{
		Method: http.MethodConnect,
		URL:    &url.URL{Opaque: address},
		Host:   address,
		Header: http.Header{"Proxy-Authorization": {e.authorization}},
	}
	if err := connect.Write(conn); err != nil {
		conn.Close()
		return nil, fmt.Errorf("request a tunnel from egress: %w", err)
	}

	reader := bufio.NewReader(conn)
	answer, err := http.ReadResponse(reader, connect)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("request a tunnel from egress: %w", err)
	}
	if answer.StatusCode != http.StatusOK {
		text, _ := io.ReadAll(io.LimitReader(answer.Body, 4096))
		answer.Body.Close()
		conn.Close()
		return nil, &HTTPError{Status: answer.StatusCode, Text: strings.TrimSpace(string(text))}
	}

	_ = conn.SetDeadline(time.Time{})
	return tunnel.Buffered(conn, reader), nil
}

func (e *Egress) Transport(target *tls.Config) *http.Transport {
	return &http.Transport{
		Proxy:                 nil,
		DialContext:           e.Dial,
		TLSClientConfig:       target,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          10,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: time.Second,
	}
}

func (e *Egress) Bound(ctx context.Context) ([]string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, e.url.JoinPath(protocol.EgressBoundPath).String(), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Proxy-Authorization", e.authorization)

	answer, err := e.forward.RoundTrip(request)
	if err != nil {
		return nil, fmt.Errorf("read the bound hosts from egress: %w", err)
	}
	defer answer.Body.Close()

	if answer.StatusCode != http.StatusOK {
		text, _ := io.ReadAll(io.LimitReader(answer.Body, 4096))
		return nil, fmt.Errorf("read the bound hosts from egress: %w", &HTTPError{Status: answer.StatusCode, Text: strings.TrimSpace(string(text))})
	}

	var bound protocol.EgressBound
	if err := json.NewDecoder(answer.Body).Decode(&bound); err != nil {
		return nil, fmt.Errorf("read the bound hosts from egress: %w", err)
	}

	return bound.Hosts, nil
}

func (e *Egress) forwarding(host string, failed func(http.ResponseWriter, *http.Request, error)) http.Handler {
	return &httputil.ReverseProxy{
		Rewrite: func(out *httputil.ProxyRequest) {
			out.Out.URL.Scheme = e.url.Scheme
			out.Out.URL.Host = e.url.Host
			out.Out.Host = e.url.Host
			out.Out.Header.Set("Proxy-Authorization", e.authorization)
			out.Out.Header.Set(protocol.EgressTargetHeader, net.JoinHostPort(host, "443"))
		},
		Transport:     e.forward,
		FlushInterval: -1,
		ErrorHandler:  failed,
	}
}

func (e *Egress) close() {
	e.forward.CloseIdleConnections()
}
