package wayout_test

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/egressing/tunnel"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/wayout"
)

type fakeEgress struct {
	target string

	mu        sync.Mutex
	connects  []string
	forwarded []string
	hosts     []string
	notYet    int
	busy      int
	reject    int
}

func (f *fakeEgress) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Proxy-Authorization") == "" {
		http.Error(w, "no credential", http.StatusProxyAuthRequired)
		return
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	switch {
	case r.Method == http.MethodConnect:
		f.connects = append(f.connects, r.Host)
		if strings.HasPrefix(r.Host, "blocked.example.com") {
			http.Error(w, "Egress does not allow this sandbox to connect to blocked.example.com.", http.StatusForbidden)
			return
		}
		upstream, err := net.Dial("tcp", f.target)
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
			tunnel.Splice(client, buffered, upstream)
		}()
	case r.Header.Get(protocol.EgressTargetHeader) != "":
		f.forwarded = append(f.forwarded, r.Header.Get(protocol.EgressTargetHeader))
		_, _ = fmt.Fprintf(w, "forwarded to %s%s", r.Header.Get(protocol.EgressTargetHeader), r.URL.Path)
	case r.URL.Path == protocol.EgressBoundPath:
		switch {
		case f.reject != 0:
			http.Error(w, "Egress does not know this sandbox.", f.reject)
		case f.busy > 0:
			f.busy--
			http.Error(w, "Sorry, this workspace sends too many requests.", http.StatusTooManyRequests)
		case f.notYet > 0:
			f.notYet--
			http.Error(w, "Egress has no run for this sandbox yet.", http.StatusConflict)
		default:
			_ = json.NewEncoder(w).Encode(protocol.EgressBound{Hosts: f.hosts})
		}
	default:
		http.NotFound(w, r)
	}
}

func (f *fakeEgress) tunnelled() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.connects...)
}

type rig struct {
	egress *fakeEgress
	target *httptest.Server
	way    *wayout.WayOut
	client *http.Client
}

func rigged(t *testing.T, direct bool) *rig {
	t.Helper()

	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprintf(w, "answered %s", r.Host)
	}))
	t.Cleanup(target.Close)

	fake := &fakeEgress{target: target.Listener.Addr().String(), hosts: []string{"mcp.example.com"}}
	served := httptest.NewTLSServer(fake)
	t.Cleanup(served.Close)

	egress, err := wayout.To(served.URL, "credential", certificates(served.Certificate()))
	if err != nil {
		t.Fatal(err)
	}
	way, err := wayout.Open(context.Background(), egress, wayout.Options{Listen: "127.0.0.1:0", Direct: direct, Log: quiet})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = way.Close() })

	proxy, _ := url.Parse(way.Env()["HTTP_PROXY"])
	trusts := certificates()
	trusts.AppendCertsFromPEM(way.PEM())
	client := &http.Client{Transport: &http.Transport{Proxy: http.ProxyURL(proxy), TLSClientConfig: &tls.Config{RootCAs: trusts}}}
	t.Cleanup(client.CloseIdleConnections)

	return &rig{egress: fake, target: target, way: way, client: client}
}

func (r *rig) get(t *testing.T, address string, host string) (int, string) {
	t.Helper()

	request, err := http.NewRequest(http.MethodGet, address, nil)
	if err != nil {
		t.Fatal(err)
	}
	if host != "" {
		request.Host = host
	}
	response, err := r.client.Do(request)
	if err != nil {
		return 0, err.Error()
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	return response.StatusCode, string(body)
}

func TestForwardsABoundHostToEgressWhateverTheHostHeaderSays(t *testing.T) {
	r := rigged(t, false)

	status, body := r.get(t, "https://mcp.example.com/mcp", "evil.example.com")

	if status != http.StatusOK || body != "forwarded to mcp.example.com:443/mcp" {
		t.Errorf("answered %d: %s", status, body)
	}
	if len(r.egress.tunnelled()) != 0 {
		t.Errorf("tunnelled %v", r.egress.tunnelled())
	}
}

func TestTunnelsAnotherHostThroughEgress(t *testing.T) {
	r := rigged(t, false)

	status, body := r.get(t, "http://"+r.target.Listener.Addr().String()+"/", "")

	if status != http.StatusOK || !strings.HasPrefix(body, "answered") {
		t.Errorf("answered %d: %s", status, body)
	}
	if len(r.egress.tunnelled()) != 1 || r.egress.tunnelled()[0] != r.target.Listener.Addr().String() {
		t.Errorf("tunnelled %v", r.egress.tunnelled())
	}
}

func TestPassesOnWhatEgressBlocked(t *testing.T) {
	r := rigged(t, false)

	status, body := r.get(t, "http://blocked.example.com/", "")

	if status != http.StatusForbidden || !strings.Contains(body, "does not allow this sandbox to connect to blocked.example.com") {
		t.Errorf("answered %d: %s", status, body)
	}
}

func TestGoesDirectWhenTheDefaultIsOff(t *testing.T) {
	r := rigged(t, true)

	status, body := r.get(t, "http://"+r.target.Listener.Addr().String()+"/", "")

	if status != http.StatusOK || !strings.HasPrefix(body, "answered") {
		t.Errorf("answered %d: %s", status, body)
	}
	if len(r.egress.tunnelled()) != 0 {
		t.Errorf("tunnelled %v", r.egress.tunnelled())
	}
	if status, body := r.get(t, "https://mcp.example.com/", ""); status != http.StatusOK || !strings.HasPrefix(body, "forwarded to") {
		t.Errorf("a bound host was answered %d: %s", status, body)
	}
}

func TestHandsTheAgentTheWayOutAndItsAuthority(t *testing.T) {
	r := rigged(t, false)
	env := r.way.Env()

	for _, name := range []string{"HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"} {
		if !strings.HasPrefix(env[name], "http://127.0.0.1:") {
			t.Errorf("%s=%q", name, env[name])
		}
	}
	want := map[string]string{
		"NO_PROXY":            "localhost,127.0.0.1,::1",
		"SSL_CERT_FILE":       protocol.SandboxBundle,
		"GIT_SSL_CAINFO":      protocol.SandboxBundle,
		"NODE_EXTRA_CA_CERTS": protocol.SandboxAuthority,
		"NODE_USE_ENV_PROXY":  "1",
	}
	for name, value := range want {
		if env[name] != value {
			t.Errorf("%s=%q", name, env[name])
		}
	}
	for name, value := range env {
		if strings.Contains(value, "credential") {
			t.Errorf("%s carries the proxy credential", name)
		}
	}
}

func TestTellsWhetherTheSandboxCanGoAroundEgress(t *testing.T) {
	open := httptest.NewServer(http.NotFoundHandler())
	defer open.Close()
	if wayout.Enforced(context.Background(), open.URL) {
		t.Error("said a reachable control plane is out of reach")
	}

	closed, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := closed.Addr().String()
	closed.Close()
	if !wayout.Enforced(context.Background(), "http://"+address) {
		t.Error("said an unreachable control plane is in reach")
	}
}

func TestRejectsAnEgressWithoutAnAddressOrCredential(t *testing.T) {
	for _, input := range [][2]string{{"egress.example.com", "credential"}, {"https://egress.example.com", ""}} {
		if _, err := wayout.To(input[0], input[1], nil); err == nil {
			t.Errorf("accepted %q", input)
		}
	}
}

func egressOf(t *testing.T, fake *fakeEgress) *wayout.Egress {
	t.Helper()

	served := httptest.NewTLSServer(fake)
	t.Cleanup(served.Close)
	egress, err := wayout.To(served.URL, "credential", certificates(served.Certificate()))
	if err != nil {
		t.Fatal(err)
	}
	return egress
}

func TestRequestsBoundHostsAgainUntilEgressHasTheRun(t *testing.T) {
	fake := &fakeEgress{hosts: []string{"mcp.example.com"}, notYet: 2, busy: 1}

	way, err := wayout.Open(context.Background(), egressOf(t, fake), wayout.Options{Listen: "127.0.0.1:0", Log: quiet})
	if err != nil {
		t.Fatal(err)
	}
	defer way.Close()

	fake.mu.Lock()
	defer fake.mu.Unlock()
	if fake.notYet != 0 || fake.busy != 0 {
		t.Errorf("did not request again; %d and %d answers left", fake.notYet, fake.busy)
	}
}

func TestDoesNotOpenWithoutBoundHostsInTime(t *testing.T) {
	fake := &fakeEgress{notYet: 1000}

	_, err := wayout.Open(context.Background(), egressOf(t, fake), wayout.Options{Listen: "127.0.0.1:0", BoundWait: 600 * time.Millisecond, Log: quiet})
	if err == nil || !strings.Contains(err.Error(), "no bound hosts within") {
		t.Errorf("error %v", err)
	}
}

func TestDoesNotRequestAgainWhenEgressRejectsTheSandbox(t *testing.T) {
	fake := &fakeEgress{reject: http.StatusProxyAuthRequired}

	started := time.Now()
	_, err := wayout.Open(context.Background(), egressOf(t, fake), wayout.Options{Listen: "127.0.0.1:0", Log: quiet})
	if err == nil || !strings.Contains(err.Error(), "does not know this sandbox") || time.Since(started) > 5*time.Second {
		t.Errorf("error %v after %s", err, time.Since(started))
	}
}
