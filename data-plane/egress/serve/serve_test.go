package serve

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"slices"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/egressing/authority"
	"usespotlight.ai/data-plane/egressing/guard"
	"usespotlight.ai/data-plane/egressing/seal/sealtest"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
)

const (
	controlPlaneHost = "spotlight.example.com"
	linearKey        = "lin_api_real"
)

type granted struct {
	workspace string
	runID     string
	noRun     bool
	secrets   map[string]string
	bound     []string
}

type controlPlane struct {
	t *testing.T

	mu       sync.Mutex
	runs     map[string]*granted
	active   map[string]bool
	recorded []protocol.EgressConnection
	fetches  int
	asked    []int
	sent     []int
	admits   int
	port     int
	failSend int
	reaches  []string
}

func (c *controlPlane) AdmitEgress(_ context.Context, credential string) (protocol.EgressAdmitted, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.admits++
	run, ok := c.runs[credential]
	if !ok {
		return protocol.EgressAdmitted{}, &control.Rejection{Status: http.StatusNotFound, Err: fmt.Errorf("no runner")}
	}
	return protocol.EgressAdmitted{
		RunnerID: "runner_" + credential, WorkspaceID: run.workspace, ControlPlaneHost: controlPlaneHost, ControlPlanePort: c.port,
		Reaches: c.reaches,
	}, nil
}

func (c *controlPlane) FetchRunSecretsFor(_ context.Context, credential, recipient string) (protocol.EgressSecrets, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.fetches++
	run, ok := c.runs[credential]
	if !ok || run.noRun {
		return protocol.EgressSecrets{}, &control.Rejection{Status: http.StatusConflict, Err: fmt.Errorf("no run")}
	}

	fetched := protocol.EgressSecrets{RunID: run.runID, Bound: run.bound}
	for host, value := range run.secrets {
		sealed, err := sealtest.Seal(recipient, value, run.runID, "LINEAR_API_KEY")
		if err != nil {
			c.t.Fatal(err)
		}
		fetched.Secrets = append(fetched.Secrets, protocol.FetchedSecret{
			Secret: "LINEAR_API_KEY", Host: host, Location: protocol.LocationHeader, Name: "Authorization", Prefix: "Bearer ", Sealed: sealed,
		})
	}
	return fetched, nil
}

func (c *controlPlane) ActiveRuns(_ context.Context, credentials []string) ([]string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.asked = append(c.asked, len(credentials))
	if len(credentials) > protocol.MaxRunsAtOnce {
		return nil, &control.Rejection{Status: http.StatusUnprocessableEntity, Err: fmt.Errorf("too many")}
	}
	return slices.DeleteFunc(slices.Clone(credentials), func(credential string) bool { return !c.active[credential] }), nil
}

func (c *controlPlane) RecordConnections(_ context.Context, records []protocol.EgressConnection) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.sent = append(c.sent, len(records))
	if c.failSend > 0 {
		c.failSend--
		return &control.Rejection{Status: http.StatusServiceUnavailable, Err: fmt.Errorf("busy")}
	}
	if len(records) > protocol.MaxRecordsAtOnce {
		return &control.Rejection{Status: http.StatusUnprocessableEntity, Err: fmt.Errorf("too many")}
	}
	c.recorded = append(c.recorded, records...)
	return nil
}

type seen struct {
	mu      sync.Mutex
	headers []http.Header
}

func (s *seen) last() http.Header {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.headers) == 0 {
		return nil
	}
	return s.headers[len(s.headers)-1]
}

type rig struct {
	egress   *Egress
	control  *controlPlane
	upstream *seen
	address  string
	trusts   *x509.CertPool
	arrived  chan struct{}
	answer   chan struct{}
}

func rigged(t *testing.T, settings Settings) *rig {
	t.Helper()
	return riggedAllowing(t, settings, nil)
}

func riggedAllowing(t *testing.T, settings Settings, allow []string) *rig {
	t.Helper()

	upstream := &seen{}
	arrived, answer := make(chan struct{}, 1), make(chan struct{})
	secure := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstream.mu.Lock()
		upstream.headers = append(upstream.headers, r.Header.Clone())
		upstream.mu.Unlock()
		if r.URL.Path == "/slow" {
			arrived <- struct{}{}
			<-answer
		}
		if r.URL.Path == "/refused" {
			w.WriteHeader(http.StatusUnauthorized)
		}
		if r.URL.Path == "/cut" {
			w.Header().Set("Content-Length", "1000")
			_, _ = w.Write([]byte("part"))
			w.(http.Flusher).Flush()
			conn, _, _ := w.(http.Hijacker).Hijack()
			_ = conn.Close()
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{"host":%q,"authorization":%q}`, r.Host, r.Header.Get("Authorization"))
	}))
	t.Cleanup(secure.Close)

	plane := &controlPlane{
		t: t,
		runs: map[string]*granted{
			"one": {workspace: "ws_1", runID: "run_1", secrets: map[string]string{"mcp.example.com": linearKey}, bound: []string{"mcp.example.com"}},
			"two": {workspace: "ws_2", runID: "run_2"},
		},
		active: map[string]bool{"one": true, "two": true},
		port:   443,
	}

	settings.Allow, _ = reach.Parse(allow)
	if settings.Dial == nil {
		settings.Dial = func(ctx context.Context, network, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, network, secure.Listener.Addr().String())
		}
	}
	settings.RootCAs = pool(secure.Certificate())

	issuer, err := authority.New(time.Now(), []string{"127.0.0.1"})
	if err != nil {
		t.Fatal(err)
	}
	settings.Certificate, err = issuer.For("127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}

	egress, err := New(settings, plane, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
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

	trusts := pool(secure.Certificate())
	block, _ := pem.Decode(issuer.PEM())
	own, _ := x509.ParseCertificate(block.Bytes)
	trusts.AddCert(own)

	return &rig{
		egress: egress, control: plane, upstream: upstream, address: listener.Addr().String(), trusts: trusts,
		arrived: arrived, answer: answer,
	}
}

func pool(certificates ...*x509.Certificate) *x509.CertPool {
	pool := x509.NewCertPool()
	for _, each := range certificates {
		pool.AddCert(each)
	}
	return pool
}

func proxyAuthorization(credential string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte("sandbox:"+credential))
}

func (r *rig) forward(t *testing.T, credential, target, path string, header http.Header) (*http.Response, string) {
	t.Helper()

	client := &http.Client{Transport: &http.Transport{
		TLSClientConfig:   &tls.Config{RootCAs: r.trusts},
		ForceAttemptHTTP2: true,
	}}
	defer client.CloseIdleConnections()
	request, err := http.NewRequest(http.MethodGet, "https://"+r.address+path, nil)
	if err != nil {
		t.Fatal(err)
	}
	if header != nil {
		request.Header = header.Clone()
	}
	if credential != "" {
		request.Header.Set("Proxy-Authorization", proxyAuthorization(credential))
	}
	if target != "" {
		request.Header.Set(protocol.EgressTargetHeader, target)
	}

	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	return response, string(body)
}

func (r *rig) tunnel(t *testing.T, credential, address string, header http.Header) (*http.Response, string, error) {
	t.Helper()

	through := &url.URL{Scheme: "https", Host: r.address, User: url.UserPassword("sandbox", credential)}
	client := &http.Client{Transport: &http.Transport{
		Proxy:           http.ProxyURL(through),
		TLSClientConfig: &tls.Config{RootCAs: r.trusts},
	}}
	request, err := http.NewRequest(http.MethodGet, address, nil)
	if err != nil {
		t.Fatal(err)
	}
	if header != nil {
		request.Header = header.Clone()
	}

	defer client.CloseIdleConnections()

	response, err := client.Do(request)
	if err != nil {
		return nil, "", err
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	return response, string(body), nil
}

func standIn() http.Header {
	return http.Header{"Authorization": {"Bearer " + protocol.StandInPrefix + "LINEAR_API_KEY"}}
}

func TestInjectsTheSecretIntoARequestForwardedToABoundHostOverHTTP2(t *testing.T) {
	r := rigged(t, Settings{})

	response, body := r.forward(t, "one", "mcp.example.com:443", "/mcp", standIn())

	if response.StatusCode != http.StatusOK || response.ProtoMajor != 2 {
		t.Fatalf("answered %s over %s: %s", response.Status, response.Proto, body)
	}
	if got := r.upstream.last().Get("Authorization"); got != "Bearer "+linearKey {
		t.Errorf("the host got %q", got)
	}
	if strings.Contains(body, linearKey) || !strings.Contains(body, protocol.StandInPrefix+"LINEAR_API_KEY") {
		t.Errorf("the sandbox read %s", body)
	}
	if !strings.Contains(body, `"host":"mcp.example.com"`) {
		t.Errorf("the host was asked as %s", body)
	}
	for _, name := range []string{"Proxy-Authorization", protocol.EgressTargetHeader} {
		if r.upstream.last().Get(name) != "" {
			t.Errorf("the host got %s", name)
		}
	}
}

func TestTunnelsAnotherHostAndDoesNotOpenItsTraffic(t *testing.T) {
	r := rigged(t, Settings{})

	response, body, err := r.tunnel(t, "one", "https://api.example.com/", standIn())
	if err != nil || response.StatusCode != http.StatusOK {
		t.Fatalf("tunnel: %v %v", response, err)
	}
	if got := r.upstream.last().Get("Authorization"); got != "Bearer "+protocol.StandInPrefix+"LINEAR_API_KEY" {
		t.Errorf("the host got %q", got)
	}
	if !strings.Contains(body, `"host":"api.example.com"`) {
		t.Errorf("answered %s", body)
	}
}

func TestRefusesToForwardToAHostNoSecretOfTheRunIsBoundTo(t *testing.T) {
	r := rigged(t, Settings{})

	response, body := r.forward(t, "one", "api.example.com:443", "/", standIn())

	if response.StatusCode != http.StatusForbidden || !strings.Contains(body, "api.example.com is not one") {
		t.Errorf("answered %s: %s", response.Status, body)
	}
	if r.upstream.last() != nil {
		t.Error("the host was asked")
	}
}

func TestAProxyCredentialCannotUseTheSecretsOfAnotherRun(t *testing.T) {
	r := rigged(t, Settings{})

	if response, _ := r.forward(t, "one", "mcp.example.com:443", "/", standIn()); response.StatusCode != http.StatusOK {
		t.Fatalf("the first run was answered %s", response.Status)
	}
	response, body := r.forward(t, "two", "mcp.example.com:443", "/", standIn())

	if response.StatusCode != http.StatusForbidden {
		t.Errorf("the other run was answered %s: %s", response.Status, body)
	}
	_, body, _ = r.tunnel(t, "two", "https://mcp.example.com/", standIn())
	if strings.Contains(body, linearKey) || r.upstream.last().Get("Authorization") == "Bearer "+linearKey {
		t.Errorf("the other run got the first run's secret: %s", body)
	}
}

func TestBeforeItsRunASandboxReachesOnlyTheControlPlane(t *testing.T) {
	r := rigged(t, Settings{})
	r.control.runs["two"].noRun = true

	if _, _, err := r.tunnel(t, "two", "https://api.example.com/", nil); err == nil || !strings.Contains(err.Error(), "Forbidden") {
		t.Errorf("reached another host: %v", err)
	}
	response, _, err := r.tunnel(t, "two", "https://"+controlPlaneHost+"/", nil)
	if err != nil || response.StatusCode != http.StatusOK {
		t.Errorf("did not reach the control plane: %v", err)
	}

	fetches := r.control.fetches
	if _, _, err := r.tunnel(t, "two", "https://api.example.com/", nil); err == nil {
		t.Error("reached another host")
	}
	if r.control.fetches != fetches {
		t.Error("asked the control plane again at once")
	}
}

func TestRefusesASandboxWithoutAKnownProxyCredential(t *testing.T) {
	r := rigged(t, Settings{})

	for name, credential := range map[string]string{"none": "", "unknown": "stranger"} {
		response, _ := r.forward(t, credential, "mcp.example.com:443", "/", standIn())
		if response.StatusCode != http.StatusProxyAuthRequired {
			t.Errorf("%s: answered %s", name, response.Status)
		}
	}
	if r.upstream.last() != nil {
		t.Error("the host was asked")
	}
}

func TestSaysWhichHostsAreBound(t *testing.T) {
	r := rigged(t, Settings{})

	response, body := r.forward(t, "one", "", protocol.EgressBoundPath, nil)

	var bound protocol.EgressBound
	if err := json.Unmarshal([]byte(body), &bound); err != nil || response.StatusCode != http.StatusOK {
		t.Fatalf("answered %s: %s", response.Status, body)
	}
	if !slices.Equal(bound.Hosts, []string{"mcp.example.com"}) {
		t.Errorf("bound %v", bound.Hosts)
	}
}

func TestAnswersTooManyRequestsAboveTheWorkspaceLimit(t *testing.T) {
	r := rigged(t, Settings{Rate: 1})
	still := time.Now()
	r.egress.limits.now = func() time.Time { return still }

	first, _ := r.forward(t, "one", "", protocol.EgressBoundPath, nil)
	second, body := r.forward(t, "one", "", protocol.EgressBoundPath, nil)
	other, _ := r.forward(t, "two", "", protocol.EgressBoundPath, nil)

	if first.StatusCode != http.StatusOK || other.StatusCode != http.StatusOK {
		t.Errorf("answered %s and %s", first.Status, other.Status)
	}
	if second.StatusCode != http.StatusTooManyRequests || !strings.Contains(body, "more than 1 requests each second") {
		t.Errorf("answered %s: %s", second.Status, body)
	}
}

func TestLimitsOpenConnectionsForEachWorkspace(t *testing.T) {
	limited := newLimits(0, 1, time.Now)

	release, refusal := limited.take("ws_1")
	if refusal != "" {
		t.Fatal(refusal)
	}
	if _, refusal := limited.take("ws_1"); !strings.Contains(refusal, "more than 1 connections open") {
		t.Errorf("refusal %q", refusal)
	}
	if _, refusal := limited.take("ws_2"); refusal != "" {
		t.Errorf("another workspace was refused: %s", refusal)
	}
	release()
	if _, refusal := limited.take("ws_1"); refusal != "" {
		t.Errorf("refused after a release: %s", refusal)
	}
}

func TestForgetsARunThatIsNoLongerActive(t *testing.T) {
	r := rigged(t, Settings{})
	r.forward(t, "one", "mcp.example.com:443", "/", standIn())
	forgotten := r.egress.runs["one"]

	r.control.active["one"] = false
	r.egress.checkActiveRuns(context.Background())

	if _, ok := r.egress.runs["one"]; ok {
		t.Fatal("still keeps the run")
	}
	if forgotten.injector.InjectsFor("mcp.example.com") {
		t.Error("still injects the run's secret")
	}
}

func pendingRecords(t *testing.T, e *Egress, want int) {
	t.Helper()

	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		e.records.mu.Lock()
		pending := len(e.records.pending)
		e.records.mu.Unlock()
		if pending == want {
			return
		}
	}
	t.Fatalf("has no %d pending records", want)
}

func TestSendsTheRecordsOfARunBeforeItForgetsTheRun(t *testing.T) {
	r := rigged(t, Settings{})
	r.forward(t, "one", "mcp.example.com:443", "/", standIn())
	pendingRecords(t, r.egress, 1)

	r.control.active["one"] = false
	r.egress.checkActiveRuns(context.Background())

	if len(r.control.recorded) != 1 || r.control.recorded[0].ProxyCredential != "one" {
		t.Errorf("recorded %+v", r.control.recorded)
	}
}

func TestCountsTheHeadsAndBodiesOfAForwardedRequest(t *testing.T) {
	r := rigged(t, Settings{})
	header := standIn()
	header.Set("X-Request-Note", strings.Repeat("n", 500))
	r.forward(t, "one", "mcp.example.com:443", "/mcp", header)
	pendingRecords(t, r.egress, 1)
	r.egress.records.flush(context.Background())

	record := r.control.recorded[0]
	sentHead := len("GET /mcp HTTP/1.1\r\n") + len("Authorization: Bearer "+linearKey+"\r\n") + len("X-Request-Note: \r\n") + 500
	if record.BytesOut < int64(sentHead) {
		t.Errorf("counted %d bytes out, the head alone is %d", record.BytesOut, sentHead)
	}
	gotBody := len(fmt.Sprintf(`{"host":%q,"authorization":%q}`, "mcp.example.com", "Bearer "+linearKey))
	gotHead := len("HTTP/1.1 200 OK\r\n") + len("Content-Type: application/json\r\n")
	if record.BytesIn < int64(gotHead+gotBody) {
		t.Errorf("counted %d bytes in, the head and body are at least %d", record.BytesIn, gotHead+gotBody)
	}
}

func TestForgetsARunAfterTwoMinutesWithoutUse(t *testing.T) {
	r := rigged(t, Settings{})
	r.forward(t, "one", "mcp.example.com:443", "/", standIn())
	r.forward(t, "two", "", protocol.EgressBoundPath, nil)

	now := time.Now()
	r.egress.runs["two"].touch(now.Add(time.Minute))
	r.egress.now = func() time.Time { return now.Add(unusedFor + time.Second) }
	r.egress.sweep(context.Background())

	if _, ok := r.egress.runs["one"]; ok {
		t.Error("still keeps the unused run")
	}
	if _, ok := r.egress.runs["two"]; !ok {
		t.Error("let go of a run in use")
	}
}

func TestRecordsEachConnection(t *testing.T) {
	r := rigged(t, Settings{})
	r.forward(t, "one", "mcp.example.com:443", "/", standIn())
	r.forward(t, "one", "api.example.com:443", "/", standIn())
	_, _, _ = r.tunnel(t, "one", "https://api.example.com/", nil)

	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		r.egress.records.flush(context.Background())
		r.control.mu.Lock()
		done := len(r.control.recorded) == 3
		r.control.mu.Unlock()
		if done {
			break
		}
	}

	outcomes := map[string]string{}
	for _, record := range r.control.recorded {
		if record.ProxyCredential != "one" || record.Port != 443 || record.At.IsZero() {
			t.Errorf("recorded %+v", record)
		}
		outcomes[record.Outcome] = record.Host
		if record.Outcome != protocol.ConnectionBlocked && record.BytesIn == 0 {
			t.Errorf("recorded no bytes in %+v", record)
		}
	}
	want := map[string]string{
		protocol.ConnectionInjected:    "mcp.example.com",
		protocol.ConnectionBlocked:     "api.example.com",
		protocol.ConnectionPassthrough: "api.example.com",
	}
	if fmt.Sprint(outcomes) != fmt.Sprint(want) {
		t.Errorf("recorded %v", outcomes)
	}
	for _, record := range r.control.recorded {
		if record.Outcome == protocol.ConnectionBlocked && record.Reason != protocol.ReasonNotBound {
			t.Errorf("recorded the reason %q", record.Reason)
		}
		if record.Outcome == protocol.ConnectionInjected && record.Status != http.StatusOK {
			t.Errorf("recorded the status %d", record.Status)
		}
	}
}

func recorded(t *testing.T, r *rig, count int) []protocol.EgressConnection {
	t.Helper()
	pendingRecords(t, r.egress, count)
	r.egress.records.flush(context.Background())
	return r.control.recorded
}

func TestRecordsTheStatusTheHostAnsweredAForwardedRequestWith(t *testing.T) {
	r := rigged(t, Settings{})

	response, _ := r.forward(t, "one", "mcp.example.com:443", "/refused", standIn())

	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("answered %s", response.Status)
	}
	if record := recorded(t, r, 1)[0]; record.Outcome != protocol.ConnectionInjected || record.Status != http.StatusUnauthorized {
		t.Errorf("recorded %+v", record)
	}
}

func TestRecordsAConnectionEgressCouldNotOpen(t *testing.T) {
	refused := func(context.Context, string, string) (net.Conn, error) {
		return nil, &net.OpError{Op: "dial", Net: "tcp", Err: os.NewSyscallError("connect", syscall.ECONNREFUSED)}
	}
	r := rigged(t, Settings{Dial: refused})

	_, _, _ = r.tunnel(t, "one", "https://api.example.com/", nil)
	response, _ := r.forward(t, "one", "mcp.example.com:443", "/", standIn())

	if response.StatusCode != http.StatusBadGateway {
		t.Fatalf("answered %s", response.Status)
	}
	for _, record := range recorded(t, r, 2) {
		if record.Outcome != protocol.ConnectionFailed || record.Reason != protocol.ReasonUnreachable {
			t.Errorf("recorded %+v", record)
		}
	}
}

func TestRecordsAForwardedRequestWhoseAnswerWasCutOff(t *testing.T) {
	r := rigged(t, Settings{})

	r.forward(t, "one", "mcp.example.com:443", "/cut", standIn())

	if record := recorded(t, r, 1)[0]; record.Outcome != protocol.ConnectionInjected || record.Status != http.StatusOK {
		t.Errorf("recorded %+v", record)
	}
}

func TestDoesNotRecordAConnectionTheSandboxGaveUp(t *testing.T) {
	r := rigged(t, Settings{Dial: func(context.Context, string, string) (net.Conn, error) {
		return nil, &net.OpError{Op: "dial", Net: "tcp", Err: context.Canceled}
	}})

	_, _, _ = r.tunnel(t, "one", "https://api.example.com/", nil)

	r.egress.records.mu.Lock()
	defer r.egress.records.mu.Unlock()
	if len(r.egress.records.pending) != 0 {
		t.Errorf("recorded %+v", r.egress.records.pending)
	}
}

func TestRecordsAConnectionToAnAddressEgressRefusesAsBlocked(t *testing.T) {
	r := rigged(t, Settings{Dial: func(context.Context, string, string) (net.Conn, error) {
		return nil, &guard.Refusal{Reason: "Egress never opens a connection to 169.254.169.254."}
	}})

	_, _, _ = r.tunnel(t, "one", "https://api.example.com/", nil)

	if record := recorded(t, r, 1)[0]; record.Outcome != protocol.ConnectionBlocked || record.Reason != protocol.ReasonAddressRefused {
		t.Errorf("recorded %+v", record)
	}
}

func TestSaysWhyAConnectionFailed(t *testing.T) {
	for err, want := range map[error]string{
		&net.DNSError{Err: "no such host", Name: "nowhere.example", IsNotFound: true}: protocol.ReasonNoSuchHost,
		&net.DNSError{Err: "i/o timeout", Name: "slow.example", IsTimeout: true}:      protocol.ReasonTimedOut,
		fmt.Errorf("dial: %w", context.DeadlineExceeded):                              protocol.ReasonTimedOut,
		&tls.CertificateVerificationError{Err: x509.UnknownAuthorityError{}}:          protocol.ReasonTLSFailed,
		tls.AlertError(40): protocol.ReasonTLSFailed,
		&net.OpError{Op: "remote error", Err: fmt.Errorf("tls: handshake failure")}: protocol.ReasonTLSFailed,
		io.ErrUnexpectedEOF: protocol.ReasonUnreachable,
	} {
		if got := reasonOf(&url.Error{Op: "Get", URL: "https://example.com", Err: err}); got != want {
			t.Errorf("%v: said %q, want %q", err, got, want)
		}
	}
}

func TestReadsItsSettingsFromTheEnvironment(t *testing.T) {
	t.Setenv(envURL, "https://spotlight.example.com")
	t.Setenv(envToken, "egress-token")
	t.Setenv(envAllow, "api.anthropic.com, *.example.com")
	t.Setenv(envRate, "20")
	t.Setenv(envConnections, "10")

	settings, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if settings.Listen != defaultListen || settings.Rate != 20 || settings.Connections != 10 || settings.Certificate != nil {
		t.Errorf("settings %+v", settings)
	}
	if !settings.Allow.Admits("mcp.example.com") || settings.Allow.Admits("evil.test") {
		t.Error("the allow-list is not the one given")
	}
}

func TestSaysWhatIsWrongWithItsSettings(t *testing.T) {
	t.Setenv(envURL, "spotlight")
	t.Setenv(envToken, "")
	t.Setenv(envCertificate, "/tmp/cert.pem")
	t.Setenv(envRate, "fast")

	_, err := Load()
	for _, named := range []string{envURL, envToken, envKey, envRate} {
		if err == nil || !strings.Contains(err.Error(), named) {
			t.Errorf("does not name %s: %v", named, err)
		}
	}
}

func admittedAlready(e *Egress, credentials ...string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, credential := range credentials {
		found := &run{credential: credential, workspace: "ws_1", controlPlane: controlPlaneHost, port: "443", admitting: make(chan struct{})}
		close(found.admitting)
		e.runs[credential] = found
	}
}

func TestAsksWhichRunsAreActiveInBatchesTheControlPlaneTakes(t *testing.T) {
	r := rigged(t, Settings{})
	var credentials []string
	for at := range 2*protocol.MaxRunsAtOnce + 1 {
		credentials = append(credentials, fmt.Sprintf("many_%d", at))
	}
	admittedAlready(r.egress, credentials...)
	r.control.active["many_0"] = true

	r.egress.checkActiveRuns(context.Background())

	if !slices.Equal(r.control.asked, []int{protocol.MaxRunsAtOnce, protocol.MaxRunsAtOnce, 1}) {
		t.Errorf("asked in batches of %v", r.control.asked)
	}
	if len(r.egress.runs) != 1 || r.egress.runs["many_0"] == nil {
		t.Errorf("still keeps %d runs", len(r.egress.runs))
	}
}

func TestSendsConnectionRecordsInBatchesTheControlPlaneTakes(t *testing.T) {
	r := rigged(t, Settings{})
	for range 2*protocol.MaxRecordsAtOnce + 500 {
		r.egress.records.add(protocol.EgressConnection{ProxyCredential: "one", Host: "api.example.com", Port: 443})
	}

	r.egress.records.flush(context.Background())

	if !slices.Equal(r.control.sent, []int{protocol.MaxRecordsAtOnce, protocol.MaxRecordsAtOnce, 500}) {
		t.Errorf("sent in batches of %v", r.control.sent)
	}
	if len(r.control.recorded) != 2*protocol.MaxRecordsAtOnce+500 {
		t.Errorf("recorded %d", len(r.control.recorded))
	}
}

func TestBeforeItsRunASandboxAlsoReachesWhatEverySandboxReaches(t *testing.T) {
	r := rigged(t, Settings{})
	admittedAlready(r.egress, "early")
	r.egress.runs["early"].reaches = []string{"storage.example.com"}
	r.egress.runs["early"].allowed = reach.List{}.With("storage.example.com")
	r.control.runs["early"] = &granted{workspace: "ws_1", noRun: true}

	if _, _, err := r.tunnel(t, "early", "https://storage.example.com/", nil); err != nil {
		t.Errorf("did not reach storage: %v", err)
	}
	if _, _, err := r.tunnel(t, "early", "https://api.example.com/", nil); err == nil {
		t.Error("reached another host")
	}
}

func TestAsksForBoundHostsFetchesSecretsWithoutWaiting(t *testing.T) {
	r := rigged(t, Settings{})
	r.control.runs["two"].noRun = true

	if response, body := r.forward(t, "two", "", protocol.EgressBoundPath, nil); response.StatusCode != http.StatusConflict {
		t.Fatalf("answered %s: %s", response.Status, body)
	}

	r.control.mu.Lock()
	r.control.runs["two"].noRun = false
	r.control.runs["two"].secrets = map[string]string{"mcp.example.com": linearKey}
	r.control.runs["two"].bound = []string{"mcp.example.com"}
	r.control.mu.Unlock()

	response, body := r.forward(t, "two", "", protocol.EgressBoundPath, nil)
	if response.StatusCode != http.StatusOK || !strings.Contains(body, "mcp.example.com") {
		t.Errorf("answered %s: %s", response.Status, body)
	}
}

func TestTrustsTheAuthorityItIsGiven(t *testing.T) {
	internal := httptest.NewTLSServer(http.NotFoundHandler())
	defer internal.Close()
	path := t.TempDir() + "/internal.pem"
	if err := os.WriteFile(path, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: internal.Certificate().Raw}), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv(envURL, "https://spotlight.example.com")
	t.Setenv(envToken, "egress-token")
	t.Setenv(envCABundle, path)

	settings, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := internal.Certificate().Verify(x509.VerifyOptions{Roots: settings.RootCAs}); err != nil {
		t.Errorf("does not trust the internal authority: %v", err)
	}

	client := &http.Client{Transport: settings.Transport()}
	defer client.CloseIdleConnections()
	if _, err := client.Get(internal.URL); err != nil {
		t.Errorf("the control plane client does not trust it: %v", err)
	}
}

func TestRefusesATrustThatHasNoCertificate(t *testing.T) {
	path := t.TempDir() + "/empty.pem"
	if err := os.WriteFile(path, []byte("nothing"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv(envURL, "https://spotlight.example.com")
	t.Setenv(envToken, "egress-token")
	t.Setenv(envCABundle, path)

	if _, err := Load(); err == nil || !strings.Contains(err.Error(), envCABundle) {
		t.Errorf("error %v", err)
	}
}

func TestEachRunInjectsItsOwnValueForTheSameHost(t *testing.T) {
	r := rigged(t, Settings{})
	r.control.runs["two"].secrets = map[string]string{"mcp.example.com": "lin_api_two"}
	r.control.runs["two"].bound = []string{"mcp.example.com"}

	for _, each := range [][2]string{{"one", linearKey}, {"two", "lin_api_two"}, {"one", linearKey}} {
		credential, want := each[0], each[1]
		if response, body := r.forward(t, credential, "mcp.example.com:443", "/", standIn()); response.StatusCode != http.StatusOK {
			t.Fatalf("%s was answered %s: %s", credential, response.Status, body)
		}
		if got := r.upstream.last().Get("Authorization"); got != "Bearer "+want {
			t.Errorf("%s injected %q", credential, got)
		}
	}
}

func TestHandsBackTheStandInWhenTheRunIsForgottenDuringARequest(t *testing.T) {
	r := rigged(t, Settings{})
	r.forward(t, "one", "", protocol.EgressBoundPath, nil)

	answered := make(chan string, 1)
	go func() {
		_, body := r.forward(t, "one", "mcp.example.com:443", "/slow", standIn())
		answered <- body
	}()
	<-r.arrived

	r.control.mu.Lock()
	r.control.active["one"] = false
	r.control.mu.Unlock()
	r.egress.checkActiveRuns(context.Background())
	close(r.answer)

	body := <-answered
	if strings.Contains(body, linearKey) || !strings.Contains(body, protocol.StandInPrefix+"LINEAR_API_KEY") {
		t.Errorf("the sandbox read %s", body)
	}
	if _, ok := r.egress.runs["one"]; ok {
		t.Error("still keeps the run")
	}
}

func TestForgetsOnlyTheRunItWasAskedToForget(t *testing.T) {
	r := rigged(t, Settings{})
	admittedAlready(r.egress, "one")
	before := r.egress.runs["one"]
	r.egress.forget(t.Context(), []*run{before}, "test")
	admittedAlready(r.egress, "one")
	again := r.egress.runs["one"]

	r.egress.forget(t.Context(), []*run{before}, "test")

	if r.egress.runs["one"] != again {
		t.Error("forgot the run admitted again")
	}
}

func TestAsksTheControlPlaneOnceAboutAnUnknownCredentialForAWhile(t *testing.T) {
	r := rigged(t, Settings{})

	for range 3 {
		if response, _ := r.forward(t, "stranger", "", protocol.EgressBoundPath, nil); response.StatusCode != http.StatusProxyAuthRequired {
			t.Errorf("answered %s", response.Status)
		}
	}
	if r.control.admits != 1 {
		t.Errorf("asked the control plane %d times", r.control.admits)
	}

	later := time.Now().Add(refusedFor + time.Second)
	r.egress.now = func() time.Time { return later }
	r.forward(t, "stranger", "", protocol.EgressBoundPath, nil)
	if r.control.admits != 2 {
		t.Errorf("did not ask again after %s; asked %d times", refusedFor, r.control.admits)
	}
}

func TestSendsRecordsAgainAfterTheControlPlaneFailed(t *testing.T) {
	r := rigged(t, Settings{})
	r.control.failSend = 1
	r.egress.records.add(protocol.EgressConnection{ProxyCredential: "one", Host: "api.example.com", Port: 443})

	r.egress.records.flush(context.Background())
	if len(r.control.recorded) != 0 {
		t.Fatalf("recorded %d", len(r.control.recorded))
	}
	r.egress.records.flush(context.Background())

	if len(r.control.recorded) != 1 {
		t.Errorf("recorded %d after the second flush", len(r.control.recorded))
	}
}

func TestTheControlPlaneTunnelIsNotCountedAgainstTheWorkspaceLimit(t *testing.T) {
	r := rigged(t, Settings{Rate: 1})
	still := time.Now()
	r.egress.limits.now = func() time.Time { return still }

	if response, _ := r.forward(t, "one", "", protocol.EgressBoundPath, nil); response.StatusCode != http.StatusOK {
		t.Fatalf("answered %s", response.Status)
	}
	if _, _, err := r.tunnel(t, "one", "https://"+controlPlaneHost+"/", nil); err != nil {
		t.Errorf("the control plane tunnel was refused: %v", err)
	}
	if _, _, err := r.tunnel(t, "one", "https://api.example.com/", nil); err == nil {
		t.Error("another tunnel was not limited")
	}
}

func TestBeforeItsRunASandboxDoesNotReachTheOperatorsAllowList(t *testing.T) {
	r := riggedAllowing(t, Settings{}, []string{"internal.example.com", "storage.example.com"})
	r.control.reaches = []string{"storage.example.com"}
	r.control.runs["two"].noRun = true

	if _, _, err := r.tunnel(t, "two", "https://storage.example.com/", nil); err != nil {
		t.Errorf("did not reach what every sandbox reaches: %v", err)
	}
	if _, _, err := r.tunnel(t, "two", "https://internal.example.com/", nil); err == nil {
		t.Error("reached a host of the operator's allow-list before the run")
	}
}

func TestReachesTheControlPlaneOnlyOnItsPort(t *testing.T) {
	r := rigged(t, Settings{})

	for _, credential := range []string{"one", "two"} {
		if _, _, err := r.tunnel(t, credential, "https://"+controlPlaneHost+"/", nil); err != nil {
			t.Errorf("%s did not reach the control plane: %v", credential, err)
		}
		if _, _, err := r.tunnel(t, credential, "https://"+controlPlaneHost+":5432/", nil); err == nil || !strings.Contains(err.Error(), "Forbidden") {
			t.Errorf("%s reached another port of the control plane host: %v", credential, err)
		}
	}
}

func TestDoesNotForwardToTheControlPlaneWhenItIsNotOnPort443(t *testing.T) {
	r := rigged(t, Settings{})
	r.control.port = 3000
	r.control.runs["one"].bound = []string{"mcp.example.com", controlPlaneHost}

	if response, body := r.forward(t, "one", controlPlaneHost+":443", "/", standIn()); response.StatusCode != http.StatusForbidden {
		t.Errorf("answered %s: %s", response.Status, body)
	}
}

func TestRefusesAnAdmissionThatNamesNoControlPlanePort(t *testing.T) {
	r := rigged(t, Settings{})
	r.control.port = 0

	if response, body := r.forward(t, "one", "", protocol.EgressBoundPath, nil); response.StatusCode != http.StatusBadGateway {
		t.Errorf("answered %s: %s", response.Status, body)
	}
}
