package localproxy

import (
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"usespotlight.ai/data-plane/egresskit/tunnel"
)

var proxyVars = []string{"HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"}

type Relay struct {
	egress   *Egress
	listener net.Listener
	server   *http.Server
	plain    *http.Transport
	log      *slog.Logger
}

func PasswordProxy(getenv func(string) string) (*url.URL, bool) {
	for _, name := range proxyVars {
		value := getenv(name)
		if value == "" {
			continue
		}

		at, err := url.Parse(value)
		if err != nil || at.Scheme != "http" || at.Hostname() == "" {
			return nil, false
		}
		if password, set := at.User.Password(); !set || password == "" {
			return nil, false
		}

		return &url.URL{Scheme: at.Scheme, User: at.User, Host: at.Host}, true
	}

	return nil, false
}

func OpenRelay(upstream *url.URL, opts Options) (*Relay, error) {
	password, _ := upstream.User.Password()
	egress, err := To((&url.URL{Scheme: upstream.Scheme, Host: upstream.Host}).String(), password, nil)
	if err != nil {
		return nil, err
	}
	egress.authorization = "Basic " + base64.StdEncoding.EncodeToString([]byte(upstream.User.Username()+":"+password))

	listener, err := net.Listen("tcp", or(opts.Listen, Listen))
	if err != nil {
		return nil, fmt.Errorf("listen for the proxy relay: %w", err)
	}

	relay := &Relay{
		egress:   egress,
		listener: listener,
		plain: &http.Transport{
			Proxy:           http.ProxyURL(upstream),
			DialContext:     egress.dialer.DialContext,
			IdleConnTimeout: 90 * time.Second,
		},
		log: opts.Log,
	}
	relay.server = &http.Server{
		Handler:           relay,
		ReadHeaderTimeout: time.Minute,
		ErrorLog:          slog.NewLogLogger(opts.Log.Handler(), slog.LevelDebug),
	}

	go func() { _ = relay.server.Serve(listener) }()
	opts.Log.Info("opened the proxy relay to egress", "listen", listener.Addr().String(), "egress", egress.address)

	return relay, nil
}

func (r *Relay) Env() map[string]string {
	proxy := "http://" + r.listener.Addr().String()

	env := make(map[string]string, len(proxyVars))
	for _, name := range proxyVars {
		env[name] = proxy
	}
	return env
}

func (r *Relay) Close() error {
	err := r.server.Close()
	r.plain.CloseIdleConnections()
	return err
}

func (r *Relay) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	switch {
	case req.Method == http.MethodConnect:
		r.connect(rw, req)
	case req.URL.IsAbs():
		r.forward(rw, req)
	default:
		http.Error(rw, "The proxy relay accepts only an absolute URL or CONNECT. Send an absolute URL, or CONNECT to a host.", http.StatusBadRequest)
	}
}

func (r *Relay) connect(rw http.ResponseWriter, req *http.Request) {
	upstream, err := r.egress.Dial(req.Context(), "tcp", req.Host)
	if err != nil {
		if httpError := (*HTTPError)(nil); errors.As(err, &httpError) {
			http.Error(rw, httpError.Text, httpError.Status)
			return
		}
		http.Error(rw, fmt.Sprintf("The proxy relay could not reach egress for %s. Error: %v", req.Host, err), http.StatusBadGateway)
		return
	}
	defer upstream.Close()

	client, buffered, err := tunnel.Hijack(rw)
	if err != nil {
		r.log.Warn("could not take over a connection to relay it", "error", err)
		return
	}
	defer client.Close()

	if _, err := client.Write([]byte(tunnel.Established)); err != nil {
		return
	}
	tunnel.Relay(client, buffered, upstream)
}

func (r *Relay) forward(rw http.ResponseWriter, req *http.Request) {
	host := req.URL.Host

	(&httputil.ReverseProxy{
		Rewrite: func(out *httputil.ProxyRequest) {
			out.Out.URL = out.In.URL
			out.Out.Host = out.In.Host
			out.Out.Header.Del("Proxy-Authorization")
			out.Out.Header.Del("Proxy-Connection")
		},
		Transport:     r.plain,
		FlushInterval: -1,
		ErrorHandler: func(rw http.ResponseWriter, _ *http.Request, err error) {
			r.log.Warn("could not relay a request to egress", "host", host, "error", err)
			http.Error(rw, fmt.Sprintf("The proxy relay could not reach egress for %s.", host), http.StatusBadGateway)
		},
	}).ServeHTTP(rw, req)
}
