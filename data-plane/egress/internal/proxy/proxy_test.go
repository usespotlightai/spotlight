package proxy

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/egress/internal/authority"
	"usespotlight.ai/data-plane/egress/internal/guard"
	"usespotlight.ai/data-plane/egress/internal/wear"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
)

type wearing map[string]http.Header

func (w wearing) Wears(host string) bool { return w[host] != nil }

func (w wearing) Onto(host string, header http.Header) {
	for name, values := range w[host] {
		header.Del(name)
		for _, value := range values {
			header.Add(name, value)
		}
	}
}

const credential = "run-credential"

type seen struct {
	mu       sync.Mutex
	requests []*http.Request
}

func (s *seen) last() *http.Request {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.requests) == 0 {
		return nil
	}
	return s.requests[len(s.requests)-1]
}

type rig struct {
	proxy     *Proxy
	client    *http.Client
	upstream  *seen
	authority *authority.Authority
	upstreams *x509.CertPool
}

func rigged(t *testing.T, allowed []string, worn wearing) *rig {
	t.Helper()

	hosts := make([]string, 0, len(worn))
	for host := range worn {
		hosts = append(hosts, host)
	}

	return riggedWith(t, allowed, worn, hosts)
}

func riggedWith(t *testing.T, allowed []string, worn Wearing, wornToward []string) *rig {
	t.Helper()

	upstream := &seen{}
	answer := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstream.mu.Lock()
		upstream.requests = append(upstream.requests, r.Clone(context.Background()))
		upstream.mu.Unlock()
		_, _ = io.WriteString(w, "answered "+r.Host)
	})
	secure := httptest.NewTLSServer(answer)
	plain := httptest.NewServer(answer)
	t.Cleanup(secure.Close)
	t.Cleanup(plain.Close)

	issuer, err := authority.New(time.Now(), wornToward)
	if err != nil {
		t.Fatal(err)
	}

	list, err := reach.Parse(allowed)
	if err != nil {
		t.Fatal(err)
	}

	proxy := New(list, worn, issuer, credential, slog.New(slog.NewTextHandler(io.Discard, nil)))
	toUpstream := func(ctx context.Context, network, address string) (net.Conn, error) {
		_, port, _ := net.SplitHostPort(address)
		target := secure.Listener.Addr().String()
		if port == "80" {
			target = plain.Listener.Addr().String()
		}
		return (&net.Dialer{}).DialContext(ctx, network, target)
	}
	proxy.dial = toUpstream
	proxy.transport.DialContext = toUpstream
	proxy.transport.TLSClientConfig = &tls.Config{RootCAs: pool(secure.Certificate())}

	listening := httptest.NewServer(proxy)
	t.Cleanup(listening.Close)
	through, _ := url.Parse(listening.URL)
	through.User = url.UserPassword("sandbox", credential)

	trusts := x509.NewCertPool()
	block, _ := pem.Decode(issuer.PEM())
	run, _ := x509.ParseCertificate(block.Bytes)
	trusts.AddCert(run)
	trusts.AddCert(secure.Certificate())

	return &rig{
		proxy: proxy,
		client: &http.Client{Transport: &http.Transport{
			Proxy:           http.ProxyURL(through),
			TLSClientConfig: &tls.Config{RootCAs: trusts},
		}},
		upstream:  upstream,
		authority: issuer,
		upstreams: pool(secure.Certificate()),
	}
}

func pool(certificates ...*x509.Certificate) *x509.CertPool {
	pool := x509.NewCertPool()
	for _, each := range certificates {
		pool.AddCert(each)
	}
	return pool
}

func (r *rig) get(t *testing.T, address string, header http.Header) (*http.Response, string) {
	t.Helper()

	request, err := http.NewRequest(http.MethodGet, address, nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header = header
	response, err := r.client.Do(request)
	if err != nil {
		return nil, err.Error()
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	return response, string(body)
}

func TestWearsTheRealCredentialTowardABoundHost(t *testing.T) {
	r := rigged(t, nil, wearing{"mcp.example.com": {"Authorization": {"Bearer lin_api_1"}}})

	response, body := r.get(t, "https://mcp.example.com/sse", http.Header{
		"Authorization": {"Bearer spotlight-egress:LINEAR_API_KEY"},
		"Accept":        {"text/event-stream"},
	})
	if response == nil || response.StatusCode != http.StatusOK {
		t.Fatalf("answered %v: %s", response, body)
	}

	got := r.upstream.last()
	if got.Header.Get("Authorization") != "Bearer lin_api_1" || len(got.Header.Values("Authorization")) != 1 {
		t.Errorf("the host saw %v", got.Header)
	}
	if got.Header.Get("Accept") != "text/event-stream" || got.Host != "mcp.example.com" {
		t.Errorf("the request was changed beyond its credential: host %q, %v", got.Host, got.Header)
	}
	if response.TLS == nil || response.TLS.PeerCertificates[0].Issuer.CommonName != "Spotlight egress" {
		t.Errorf("the sandbox did not speak to the run's authority: %+v", response.TLS)
	}
}

func TestGivesAnUnboundHostNoCredentialAndDoesNotOpenItsTraffic(t *testing.T) {
	r := rigged(t, nil, wearing{"mcp.example.com": {"Authorization": {"Bearer lin_api_1"}}})

	response, body := r.get(t, "https://api.example.com/user", http.Header{"Authorization": {"Bearer agents-own"}})
	if response == nil || response.StatusCode != http.StatusOK {
		t.Fatalf("answered %v: %s", response, body)
	}

	if got := r.upstream.last().Header.Get("Authorization"); got != "Bearer agents-own" {
		t.Errorf("an unbound host saw %q", got)
	}
	if issuer := response.TLS.PeerCertificates[0].Issuer.CommonName; issuer == "Spotlight egress" {
		t.Error("egress opened traffic to a host it wears nothing toward")
	}
}

func TestTheRequestGoesWhereTheSandboxConnectedWhateverItsHostHeaderSays(t *testing.T) {
	r := rigged(t, nil, wearing{"mcp.example.com": {"Authorization": {"Bearer lin_api_1"}}})

	request, _ := http.NewRequest(http.MethodGet, "https://mcp.example.com/", nil)
	request.Host = "evil.example.com"
	response, err := r.client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()

	if got := r.upstream.last().Host; got != "mcp.example.com" {
		t.Errorf("the credential went toward %q", got)
	}
}

func TestRefusesAHostTheListLeavesOut(t *testing.T) {
	r := rigged(t, []string{"anthropic.example.com"}, wearing{})

	if response, body := r.get(t, "https://anthropic.example.com/v1/messages", nil); response == nil || response.StatusCode != http.StatusOK {
		t.Errorf("refused a listed host: %v %s", response, body)
	}

	_, said := r.get(t, "https://exfiltrate.example.com/", nil)
	if !strings.Contains(said, "Forbidden") {
		t.Errorf("reached a host the list leaves out: %s", said)
	}

	response, body := r.get(t, "http://exfiltrate.example.com/", nil)
	if response == nil || response.StatusCode != http.StatusForbidden || !strings.Contains(body, "exfiltrate.example.com") {
		t.Errorf("forwarded plain HTTP to a host the list leaves out: %v %s", response, body)
	}
	if r.upstream.last().Host != "anthropic.example.com" {
		t.Errorf("a refused request reached %q", r.upstream.last().Host)
	}
}

func TestForwardsPlainHTTPToAnAllowedHostAsItWas(t *testing.T) {
	r := rigged(t, []string{"control-plane"}, wearing{"control-plane": {"Authorization": {"Bearer never"}}})

	response, body := r.get(t, "http://control-plane/api/runs/claim", http.Header{"Authorization": {"Bearer one-run"}})
	if response == nil || response.StatusCode != http.StatusOK {
		t.Fatalf("answered %v: %s", response, body)
	}

	got := r.upstream.last()
	if got.URL.Path != "/api/runs/claim" || got.Header.Get("Authorization") != "Bearer one-run" || got.Host != "control-plane" {
		t.Errorf("forwarded %s %v to %q", got.URL, got.Header, got.Host)
	}
}

func TestIsNeverAWebServerOfItsOwn(t *testing.T) {
	r := rigged(t, nil, wearing{})
	proxy := httptest.NewServer(New(reach.List{}, wearing{}, r.authority, credential, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer proxy.Close()

	request, _ := http.NewRequest(http.MethodGet, proxy.URL+"/", nil)
	request.SetBasicAuth("sandbox", credential)
	request.Header.Set("Proxy-Authorization", request.Header.Get("Authorization"))
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusBadRequest {
		t.Errorf("answered %d to a request for itself", response.StatusCode)
	}
}

func TestAnswersOnlyTheSandboxItWasStartedFor(t *testing.T) {
	r := rigged(t, nil, wearing{"mcp.example.com": {"Authorization": {"Bearer lin_api_1"}}})

	for name, user := range map[string]*url.Userinfo{
		"no credential":     nil,
		"another run's one": url.UserPassword("sandbox", "another-run"),
	} {
		transport := r.client.Transport.(*http.Transport).Clone()
		proxied, _ := transport.Proxy(&http.Request{URL: &url.URL{Scheme: "https", Host: "mcp.example.com"}})
		proxied.User = user
		transport.Proxy = http.ProxyURL(proxied)

		response, err := (&http.Client{Transport: transport}).Get("https://mcp.example.com/")
		if err == nil {
			response.Body.Close()
		}
		if err == nil || !strings.Contains(err.Error(), "Proxy Authentication Required") {
			t.Errorf("%s: answered %v, %v", name, response, err)
		}
	}
	if r.upstream.last() != nil {
		t.Error("a request with no run's credential went out")
	}
}

type opener struct{}

func (opener) Open(sealed, _, _ string) (string, error) {
	return strings.TrimPrefix(sealed, "sealed:"), nil
}

func TestWearsWhatEgressRedeemedInPlaceOfWhatTheSandboxSent(t *testing.T) {
	quiet := slog.New(slog.NewTextHandler(io.Discard, nil))
	list, _ := reach.Parse(nil)
	held := wear.From(context.Background(), protocol.EgressRedemption{
		RunID: "run_1",
		Secrets: []protocol.RedeemedSecret{
			{Secret: "LINEAR_API_KEY", Host: "mcp.example.com", Header: "authorization", Prefix: "Bearer ", Sealed: "sealed:lin_api_1"},
			{Secret: "LINEAR_ORG", Host: "mcp.example.com", Header: "x-org", Sealed: "sealed:acme"},
		},
	}, nil, wear.Limits{Hosts: list}, opener{}, func() (wear.Reader, error) { return nil, nil }, quiet)
	r := riggedWith(t, nil, held, held.Hosts())

	response, body := r.get(t, "https://mcp.example.com/", http.Header{
		"Authorization": {"Bearer spotlight-egress:LINEAR_API_KEY"},
		"X-Org":         {"spotlight-egress:LINEAR_ORG"},
	})
	if response == nil || response.StatusCode != http.StatusOK {
		t.Fatalf("answered %v: %s", response, body)
	}

	got := r.upstream.last().Header
	if got.Get("Authorization") != "Bearer lin_api_1" || !slices.Equal(got.Values("X-Org"), []string{"acme"}) {
		t.Errorf("the host saw %v", got)
	}

	r.get(t, "https://mcp.example.com/", http.Header{"Authorization": {"Bearer mine"}, "X-Org": {"forged", "twice"}})
	if got := r.upstream.last().Header; got.Get("Authorization") != "Bearer mine" || !slices.Equal(got.Values("X-Org"), []string{"forged", "twice"}) {
		t.Errorf("wore a secret over what the sandbox sent without its stand-in: %v", got)
	}

	r.get(t, "https://mcp.example.com/", http.Header{"X-Api-Key": {"spotlight-egress:UNKNOWN"}})
	if got := r.upstream.last().Header; got.Get("X-Api-Key") != "" || got.Get("Authorization") != "" {
		t.Errorf("sent on a stand-in it does not hold, or wore a secret nobody asked for: %v", got)
	}

	held.Forget()
	r.get(t, "https://mcp.example.com/", http.Header{"Authorization": {"Bearer spotlight-egress:LINEAR_API_KEY"}})
	if got := r.upstream.last().Header.Get("Authorization"); got != "" && got != "Bearer spotlight-egress:LINEAR_API_KEY" {
		t.Errorf("wore %q after forgetting", got)
	}
}

func TestTellsTheDialWhetherTheListNamesTheHostOnEveryPath(t *testing.T) {
	r := rigged(t, []string{"*.acme.example.com", "mcp.example.com"}, wearing{"mcp.example.com": {"Authorization": {"Bearer lin_api_1"}}})
	proxy := r.proxy
	var mu sync.Mutex
	seen := map[string]bool{}
	for _, dial := range []*func(context.Context, string, string) (net.Conn, error){&proxy.dial, &proxy.transport.DialContext} {
		through := *dial
		*dial = func(ctx context.Context, network, address string) (net.Conn, error) {
			listed := guard.Named(ctx)
			mu.Lock()
			seen[address] = listed
			mu.Unlock()
			return through(ctx, network, address)
		}
	}

	r.get(t, "https://mcp.example.com/", nil)
	r.get(t, "https://tunnel.acme.example.com/", nil)
	r.get(t, "http://plain.acme.example.com/", nil)

	mu.Lock()
	defer mu.Unlock()
	for _, address := range []string{"mcp.example.com:443", "tunnel.acme.example.com:443", "plain.acme.example.com:80"} {
		if !seen[address] {
			t.Errorf("the dial to %s did not know the list names it: %v", address, seen)
		}
	}
}
