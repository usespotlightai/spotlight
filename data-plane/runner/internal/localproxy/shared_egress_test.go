package localproxy_test

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
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

	"usespotlight.ai/data-plane/allowlist"
	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/egress/serve"
	"usespotlight.ai/data-plane/egresskit/authority"
	"usespotlight.ai/data-plane/egresskit/seal/sealtest"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/localproxy"
)

const (
	controlPlaneHost = "spotlight.example.com"
	egressToken      = "egress-token"
	linearKey        = "lin_api_real"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

type fakeControlPlane struct {
	t *testing.T

	mu          sync.Mutex
	active      map[string]bool
	grants      map[string]map[string]string
	recorded    []protocol.EgressConnection
	runnerCalls int
}

func (f *fakeControlPlane) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if strings.HasPrefix(r.URL.Path, "/api/runners/") {
		f.runnerCalls++
		_ = json.NewEncoder(w).Encode([]protocol.HarnessProbe{})
		return
	}

	if r.Header.Get("Authorization") != "Bearer "+egressToken {
		http.Error(w, `{"message":"not this egress"}`, http.StatusUnauthorized)
		return
	}

	switch r.URL.Path {
	case "/api/egress/authorize":
		var received protocol.EgressAuthorizeRequest
		_ = json.NewDecoder(r.Body).Decode(&received)
		if _, ok := f.grants[received.ProxyCredential]; !ok {
			http.Error(w, `{"message":"no runner"}`, http.StatusNotFound)
			return
		}
		_ = json.NewEncoder(w).Encode(protocol.EgressAuthorizeResponse{
			RunnerID: "runner_" + received.ProxyCredential, WorkspaceID: "ws_1", ControlPlaneHost: controlPlaneHost, ControlPlanePort: 80,
		})
	case "/api/egress/secrets":
		var received protocol.EgressSecretsRequest
		_ = json.NewDecoder(r.Body).Decode(&received)
		if !f.active[received.ProxyCredential] {
			http.Error(w, `{"message":"no run"}`, http.StatusConflict)
			return
		}
		runID := "run_" + received.ProxyCredential
		fetched := protocol.EgressSecrets{RunID: runID, ExtraAllowedHosts: []string{}, Secrets: []protocol.FetchedSecret{}, Denied: []protocol.DeniedSecret{}}
		for host, value := range f.grants[received.ProxyCredential] {
			sealed, err := sealtest.Seal(received.Recipient, value, runID, "LINEAR_API_KEY")
			if err != nil {
				f.t.Error(err)
			}
			fetched.Secrets = append(fetched.Secrets, protocol.FetchedSecret{
				Secret: "LINEAR_API_KEY", Host: host, Location: protocol.LocationHeader, Name: "Authorization", Prefix: "Bearer ", Sealed: sealed,
			})
			fetched.Bound = append(fetched.Bound, host)
		}
		_ = json.NewEncoder(w).Encode(fetched)
	case "/api/egress/active-runs":
		var received protocol.ActiveRunsRequest
		_ = json.NewDecoder(r.Body).Decode(&received)
		answer := protocol.ActiveRunsResponse{Active: slices.DeleteFunc(received.ProxyCredentials, func(credential string) bool {
			return !f.active[credential]
		})}
		_ = json.NewEncoder(w).Encode(answer)
	case "/api/egress/connections":
		var received protocol.EgressConnections
		_ = json.NewDecoder(r.Body).Decode(&received)
		f.recorded = append(f.recorded, received.Records...)
		w.WriteHeader(http.StatusNoContent)
	default:
		http.NotFound(w, r)
	}
}

func (f *fakeControlPlane) deactivate(credential string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.active[credential] = false
}

func (f *fakeControlPlane) outcomes() map[string][]string {
	f.mu.Lock()
	defer f.mu.Unlock()

	outcomes := map[string][]string{}
	for _, record := range f.recorded {
		outcomes[record.ProxyCredential] = append(outcomes[record.ProxyCredential], record.Outcome+" "+record.Host)
	}
	return outcomes
}

type upstreamSaw struct {
	mu             sync.Mutex
	authorizations []string
}

func (u *upstreamSaw) last() string {
	u.mu.Lock()
	defer u.mu.Unlock()
	if len(u.authorizations) == 0 {
		return ""
	}
	return u.authorizations[len(u.authorizations)-1]
}

type shared struct {
	control   *fakeControlPlane
	upstream  *upstreamSaw
	egressURL string
	egressCAs *x509.CertPool
	targetCAs *x509.CertPool
}

func sharedEgress(t *testing.T) *shared {
	t.Helper()

	upstream := &upstreamSaw{}
	target := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstream.mu.Lock()
		upstream.authorizations = append(upstream.authorizations, r.Header.Get("Authorization"))
		upstream.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{"host":%q,"authorization":%q}`, r.Host, r.Header.Get("Authorization"))
	}))
	t.Cleanup(target.Close)

	plane := &fakeControlPlane{
		t:      t,
		active: map[string]bool{"one": true, "two": true},
		grants: map[string]map[string]string{"one": {"mcp.example.com": linearKey}, "two": {}},
	}
	controlPlane := httptest.NewServer(plane)
	t.Cleanup(controlPlane.Close)

	issuer, err := authority.New(time.Now(), []string{"127.0.0.1"})
	if err != nil {
		t.Fatal(err)
	}
	certificate, err := issuer.For("127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}

	allow, _ := allowlist.Parse(nil)
	client, err := control.New(controlPlane.URL, egressToken)
	if err != nil {
		t.Fatal(err)
	}
	egress, err := serve.New(serve.Settings{
		Certificate: certificate,
		Allow:       allow,
		CheckEvery:  50 * time.Millisecond,
		RecordEvery: 50 * time.Millisecond,
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			host, _, _ := net.SplitHostPort(address)
			if host == controlPlaneHost {
				return (&net.Dialer{}).DialContext(ctx, network, controlPlane.Listener.Addr().String())
			}
			return (&net.Dialer{}).DialContext(ctx, network, target.Listener.Addr().String())
		},
		RootCAs: certificates(target.Certificate()),
	}, client, nil, quiet)
	if err != nil {
		t.Fatal(err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() {
		defer close(stopped)
		_ = egress.Serve(ctx, listener)
	}()
	t.Cleanup(func() {
		cancel()
		<-stopped
	})

	return &shared{
		control:   plane,
		upstream:  upstream,
		egressURL: "https://" + listener.Addr().String(),
		egressCAs: pemPool(t, issuer.PEM()),
		targetCAs: certificates(target.Certificate()),
	}
}

func certificates(each ...*x509.Certificate) *x509.CertPool {
	pool := x509.NewCertPool()
	for _, certificate := range each {
		pool.AddCert(certificate)
	}
	return pool
}

func pemPool(t *testing.T, raw []byte) *x509.CertPool {
	t.Helper()

	block, _ := pem.Decode(raw)
	certificate, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	return certificates(certificate)
}

type sandbox struct {
	egress *localproxy.Egress
	local  *localproxy.LocalProxy
	client *http.Client
}

func (s *shared) sandbox(t *testing.T, credential string) *sandbox {
	t.Helper()

	egress, err := localproxy.To(s.egressURL, credential, s.egressCAs)
	if err != nil {
		t.Fatal(err)
	}
	local, err := localproxy.Open(context.Background(), egress, localproxy.Options{Listen: "127.0.0.1:0", Log: quiet})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = local.Close() })

	proxy, _ := url.Parse(local.Env()["HTTPS_PROXY"])
	trusts := s.targetCAs.Clone()
	trusts.AppendCertsFromPEM(local.PEM())
	client := &http.Client{Transport: &http.Transport{Proxy: http.ProxyURL(proxy), TLSClientConfig: &tls.Config{RootCAs: trusts}}}
	t.Cleanup(client.CloseIdleConnections)

	return &sandbox{egress: egress, local: local, client: client}
}

func (s *sandbox) get(t *testing.T, address string) (int, string) {
	t.Helper()

	request, err := http.NewRequest(http.MethodGet, address, nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer "+protocol.StandInPrefix+"LINEAR_API_KEY")

	response, err := s.client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	return response.StatusCode, string(body)
}

func TestTheSharedEgressInjectsABoundHostsSecretAndTunnelsTheRestUnopened(t *testing.T) {
	s := sharedEgress(t)
	one := s.sandbox(t, "one")

	status, body := one.get(t, "https://mcp.example.com/mcp")
	if status != http.StatusOK || s.upstream.last() != "Bearer "+linearKey {
		t.Fatalf("the bound host got %q (%d: %s)", s.upstream.last(), status, body)
	}
	if strings.Contains(body, linearKey) || !strings.Contains(body, `"host":"mcp.example.com"`) {
		t.Errorf("the sandbox read %s", body)
	}

	status, body = one.get(t, "https://api.example.com/")
	if status != http.StatusOK || s.upstream.last() != "Bearer "+protocol.StandInPrefix+"LINEAR_API_KEY" {
		t.Errorf("the other host got %q (%d: %s)", s.upstream.last(), status, body)
	}

	want := []string{"injected mcp.example.com", "passthrough api.example.com"}
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(20 * time.Millisecond) {
		one.client.CloseIdleConnections()
		if got := s.control.outcomes()["one"]; slices.Equal(slices.Sorted(slices.Values(got)), want) {
			return
		}
	}
	t.Errorf("recorded %v", s.control.outcomes())
}

func TestAProxyCredentialCannotUseTheGrantsOfAnotherRun(t *testing.T) {
	s := sharedEgress(t)
	s.sandbox(t, "one").get(t, "https://mcp.example.com/")
	two := s.sandbox(t, "two")

	status, body := two.get(t, "https://mcp.example.com/")
	if status != http.StatusOK || s.upstream.last() != "Bearer "+protocol.StandInPrefix+"LINEAR_API_KEY" {
		t.Errorf("the other run's request carried %q (%d: %s)", s.upstream.last(), status, body)
	}

	forwarding, err := http.NewRequest(http.MethodGet, s.egressURL+"/", nil)
	if err != nil {
		t.Fatal(err)
	}
	forwarding.SetBasicAuth("sandbox", "two")
	forwarding.Header.Set("Proxy-Authorization", forwarding.Header.Get("Authorization"))
	forwarding.Header.Set("Authorization", "Bearer "+protocol.StandInPrefix+"LINEAR_API_KEY")
	forwarding.Header.Set(protocol.EgressTargetHeader, "mcp.example.com:443")
	direct := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: s.egressCAs}}}
	defer direct.CloseIdleConnections()
	response, err := direct.Do(forwarding)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusForbidden {
		t.Errorf("egress forwarded the other run's request: %s", response.Status)
	}
}

func TestTheRunnersControlClientConnectsToTheControlPlaneThroughTheTunnel(t *testing.T) {
	s := sharedEgress(t)
	egress, err := localproxy.To(s.egressURL, "one", s.egressCAs)
	if err != nil {
		t.Fatal(err)
	}

	client, err := control.New("http://"+controlPlaneHost, "one-run")
	if err != nil {
		t.Fatal(err)
	}
	client.Through(egress.Transport(nil))

	if _, err := client.HarnessProbes(context.Background()); err != nil {
		t.Fatal(err)
	}
	s.control.mu.Lock()
	defer s.control.mu.Unlock()
	if s.control.runnerCalls != 1 {
		t.Errorf("the control plane was called %d times", s.control.runnerCalls)
	}
}

func TestTheSharedEgressEvictsARunThatIsNoLongerActive(t *testing.T) {
	s := sharedEgress(t)
	one := s.sandbox(t, "one")
	if status, _ := one.get(t, "https://mcp.example.com/"); status != http.StatusOK {
		t.Fatalf("answered %d", status)
	}

	s.control.deactivate("one")

	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(100 * time.Millisecond) {
		one.client.CloseIdleConnections()
		status, _ := one.get(t, "https://mcp.example.com/")
		if status == http.StatusForbidden {
			if s.upstream.last() != "Bearer "+linearKey {
				t.Errorf("the host last got %q", s.upstream.last())
			}
			return
		}
	}
	t.Error("still injects the secret of a run that is not active")
}
