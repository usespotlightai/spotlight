package localproxy_test

import (
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"

	"usespotlight.ai/data-plane/egresskit/tunnel"
	"usespotlight.ai/data-plane/runner/internal/localproxy"
)

type passwordEgress struct {
	mu        sync.Mutex
	connects  []string
	forwarded []string
}

func (p *passwordEgress) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Proxy-Authorization") != "Basic "+base64.StdEncoding.EncodeToString([]byte("sandbox:s3cret")) {
		http.Error(w, "Egress answers only the sandbox it was started for.", http.StatusProxyAuthRequired)
		return
	}

	switch {
	case r.Method == http.MethodConnect:
		p.mu.Lock()
		p.connects = append(p.connects, r.Host)
		p.mu.Unlock()
		if strings.HasPrefix(r.Host, "blocked.example.com") {
			http.Error(w, "Egress does not allow this sandbox to connect to blocked.example.com.", http.StatusForbidden)
			return
		}
		upstream, err := net.Dial("tcp", r.Host)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		client, buffered, err := tunnel.Hijack(w)
		if err != nil {
			upstream.Close()
			return
		}
		_, _ = client.Write([]byte(tunnel.Established))
		go func() {
			defer upstream.Close()
			defer client.Close()
			tunnel.Relay(client, buffered, upstream)
		}()
	case r.URL.IsAbs():
		p.mu.Lock()
		p.forwarded = append(p.forwarded, r.URL.String())
		p.mu.Unlock()
		_, _ = fmt.Fprintf(w, "egress forwarded %s for %s", r.URL, r.Host)
	default:
		http.NotFound(w, r)
	}
}

func (p *passwordEgress) tunnelled() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]string(nil), p.connects...)
}

func relayed(t *testing.T, trusts ...*tls.Config) (*passwordEgress, *localproxy.Relay, *http.Client) {
	t.Helper()

	egress := &passwordEgress{}
	served := httptest.NewServer(egress)
	t.Cleanup(served.Close)

	upstream, found := localproxy.PasswordProxy(func(name string) string {
		if name == "HTTPS_PROXY" {
			return "http://sandbox:s3cret@" + served.Listener.Addr().String()
		}
		return ""
	})
	if !found {
		t.Fatal("found no proxy with a password")
	}

	relay, err := localproxy.OpenRelay(upstream, localproxy.Options{Listen: "127.0.0.1:0", Log: quiet})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = relay.Close() })

	proxy, _ := url.Parse(relay.Env()["HTTPS_PROXY"])
	transport := &http.Transport{Proxy: http.ProxyURL(proxy)}
	if len(trusts) > 0 {
		transport.TLSClientConfig = trusts[0]
	}
	client := &http.Client{Transport: transport}
	t.Cleanup(client.CloseIdleConnections)

	return egress, relay, client
}

func read(t *testing.T, client *http.Client, address string) (int, string) {
	t.Helper()

	response, err := client.Get(address)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	return response.StatusCode, string(body)
}

func TestTheRelayTunnelsThroughEgressWithItsPassword(t *testing.T) {
	target := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprint(w, "answered over TLS")
	}))
	defer target.Close()

	egress, _, client := relayed(t, &tls.Config{RootCAs: certificates(target.Certificate())})

	status, body := read(t, client, target.URL)

	if status != http.StatusOK || body != "answered over TLS" {
		t.Errorf("answered %d: %s", status, body)
	}
	if tunnelled := egress.tunnelled(); len(tunnelled) != 1 || tunnelled[0] != target.Listener.Addr().String() {
		t.Errorf("tunnelled %v", tunnelled)
	}
}

func TestTheRelayForwardsAPlainRequestToEgressWithItsPassword(t *testing.T) {
	egress, _, client := relayed(t)

	status, body := read(t, client, "http://plain.example.com/path?q=1")

	if status != http.StatusOK || body != "egress forwarded http://plain.example.com/path?q=1 for plain.example.com" {
		t.Errorf("answered %d: %s", status, body)
	}
	if tunnelled := egress.tunnelled(); len(tunnelled) != 0 {
		t.Errorf("tunnelled %v", tunnelled)
	}
}

func TestTheRelayPassesOnWhatEgressRefused(t *testing.T) {
	_, _, client := relayed(t, &tls.Config{})

	_, err := client.Get("https://blocked.example.com/")

	if err == nil || !strings.Contains(err.Error(), "Forbidden") {
		t.Errorf("got %v", err)
	}
}

func TestTheRelayGivesTheAgentAnAddressWithoutThePassword(t *testing.T) {
	_, relay, _ := relayed(t)

	env := relay.Env()

	for _, name := range []string{"HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"} {
		if !strings.HasPrefix(env[name], "http://127.0.0.1:") || strings.Contains(env[name], "s3cret") {
			t.Errorf("%s=%q", name, env[name])
		}
	}
	if len(env) != 4 {
		t.Errorf("env %v", env)
	}
}

func TestFindsAProxyOnlyWhenItsAddressHasAPassword(t *testing.T) {
	cases := map[string]struct {
		env  map[string]string
		want string
	}{
		"password":           {map[string]string{"HTTPS_PROXY": "http://sandbox:s3cret@egress:3128"}, "http://sandbox:s3cret@egress:3128"},
		"lower case":         {map[string]string{"https_proxy": "http://sandbox:s3cret@egress:3128"}, "http://sandbox:s3cret@egress:3128"},
		"plain HTTP only":    {map[string]string{"HTTP_PROXY": "http://sandbox:s3cret@egress:3128"}, "http://sandbox:s3cret@egress:3128"},
		"user only":          {map[string]string{"HTTPS_PROXY": "http://sandbox@egress:3128"}, ""},
		"no credentials":     {map[string]string{"HTTPS_PROXY": "http://127.0.0.1:3128"}, ""},
		"TLS proxy":          {map[string]string{"HTTPS_PROXY": "https://sandbox:s3cret@egress:3128"}, ""},
		"HTTPS_PROXY first":  {map[string]string{"HTTPS_PROXY": "http://127.0.0.1:3128", "HTTP_PROXY": "http://sandbox:s3cret@egress:3128"}, ""},
		"no proxy":           {map[string]string{}, ""},
		"not an address":     {map[string]string{"HTTPS_PROXY": "://"}, ""},
		"path dropped":       {map[string]string{"HTTPS_PROXY": "http://sandbox:s3cret@egress:3128/"}, "http://sandbox:s3cret@egress:3128"},
		"escaped password":   {map[string]string{"HTTPS_PROXY": "http://sandbox:a%40b@egress:3128"}, "http://sandbox:a%40b@egress:3128"},
		"empty password":     {map[string]string{"HTTPS_PROXY": "http://sandbox:@egress:3128"}, ""},
		"hostless with user": {map[string]string{"HTTPS_PROXY": "http://sandbox:s3cret@:3128"}, ""},
	}

	for name, each := range cases {
		t.Run(name, func(t *testing.T) {
			found, ok := localproxy.PasswordProxy(func(key string) string { return each.env[key] })

			got := ""
			if ok {
				got = found.String()
			}
			if got != each.want {
				t.Errorf("found %q, want %q", got, each.want)
			}
		})
	}
}
