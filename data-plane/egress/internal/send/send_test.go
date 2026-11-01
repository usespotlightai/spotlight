package send

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/allowlist"
	"usespotlight.ai/data-plane/egresskit/inject"
	"usespotlight.ai/data-plane/egresskit/seal"
	"usespotlight.ai/data-plane/egresskit/seal/sealtest"
	"usespotlight.ai/data-plane/protocol"
)

func listed(t *testing.T, entries ...string) allowlist.List {
	t.Helper()

	list, err := allowlist.Parse(entries)
	if err != nil {
		t.Fatal(err)
	}
	return list
}

func sendTo(t *testing.T, sender *Sender, server *httptest.Server) {
	t.Helper()

	sender.transport.DialContext = func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, network, server.Listener.Addr().String())
	}
	roots := x509.NewCertPool()
	roots.AddCert(server.Certificate())
	sender.transport.TLSClientConfig = &tls.Config{RootCAs: roots}
}

func encoded(body string) string {
	return base64.StdEncoding.EncodeToString([]byte(body))
}

func TestLeavesTheCallsAcceptEncodingWhenItInjectsNothing(t *testing.T) {
	var encoding string
	server := httptest.NewTLSServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		encoding = r.Header.Get("Accept-Encoding")
	}))
	t.Cleanup(server.Close)

	sender := New(listed(t, "audit.example.com"))
	sendTo(t, sender, server)

	sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/", Headers: map[string]string{"accept-encoding": "br"}})
	if encoding != "br" {
		t.Errorf("the host was asked for the response in %q", encoding)
	}
}

func TestSendsTheCallOnceAndReturnsTheHostsResponse(t *testing.T) {
	var got *http.Request
	var received string
	calls := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		got = r.Clone(context.Background())
		read, _ := io.ReadAll(r.Body)
		received = string(read)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_, _ = io.WriteString(w, `{"deny":"no migrations on Fridays"}`)
	}))
	t.Cleanup(server.Close)

	sender := New(listed(t, "audit.example.com"))
	sendTo(t, sender, server)

	result := sender.Send(context.Background(), protocol.HostCall{
		ID: "call_1", Method: http.MethodPost, URL: "https://audit.example.com/hooks",
		Headers: map[string]string{"content-type": "application/json", "webhook-id": "firing_1"},
		Body:    encoded(`{"hook":"core/dba-review"}`), TimeoutMs: 5000,
	})

	if result.Error != "" || result.Status != http.StatusAccepted {
		t.Fatalf("got %+v", result)
	}
	if calls != 1 || got.Method != http.MethodPost || got.URL.Path != "/hooks" || got.Host != "audit.example.com" {
		t.Errorf("the host saw %d calls, last %s %s at %s", calls, got.Method, got.URL.Path, got.Host)
	}
	if got.Header.Get("Webhook-Id") != "firing_1" || received != `{"hook":"core/dba-review"}` {
		t.Errorf("the host was sent %v %q", got.Header, received)
	}
	body, _ := base64.StdEncoding.DecodeString(result.Body)
	if string(body) != `{"deny":"no migrations on Fridays"}` || result.Headers["content-type"] != "application/json" {
		t.Errorf("got %q with %v", body, result.Headers)
	}
}

func TestTrimsTheResponseBody(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, strings.Repeat("a", 3*protocol.MaxResponseBody))
	}))
	t.Cleanup(server.Close)

	sender := New(listed(t, "audit.example.com"))
	sendTo(t, sender, server)

	result := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/"})
	body, _ := base64.StdEncoding.DecodeString(result.Body)
	if result.Status != http.StatusOK || len(body) != protocol.MaxResponseBody {
		t.Errorf("got %d with %d bytes", result.Status, len(body))
	}
}

func TestDoesNotFollowARedirect(t *testing.T) {
	calls := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		http.Redirect(w, r, "https://elsewhere.example.com/", http.StatusFound)
	}))
	t.Cleanup(server.Close)

	sender := New(listed(t, "audit.example.com"))
	sendTo(t, sender, server)

	result := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/"})
	if result.Status != http.StatusFound || result.Headers["location"] != "https://elsewhere.example.com/" || calls != 1 {
		t.Errorf("got %+v after %d calls", result, calls)
	}
}

func TestBlocksAHostTheAllowListLeavesOut(t *testing.T) {
	sender := New(listed(t, "grafana.example.com"))

	result := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.acme.internal/"})
	if result.Status != 0 || result.Error != "The host's allow-list doesn't allow audit.acme.internal." {
		t.Errorf("got %+v", result)
	}
}

func TestNeverConnectsToItselfEvenForAHostTheListNames(t *testing.T) {
	sender := New(listed(t, "127.0.0.1"))

	result := sender.Send(context.Background(), protocol.HostCall{URL: "http://127.0.0.1:9/"})
	if result.Status != 0 || result.Error != "Egress never opens a connection to 127.0.0.1." {
		t.Errorf("got %+v", result)
	}
}

func TestSaysItTimedOut(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewTLSServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		<-release
	}))
	t.Cleanup(server.Close)
	t.Cleanup(func() { close(release) })

	sender := New(listed(t, "audit.example.com"))
	sendTo(t, sender, server)

	result := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/", TimeoutMs: 100})
	if result.Status != 0 || result.Error != "The call timed out. Time limit: 100ms" || result.Ms < 100 {
		t.Errorf("got %+v", result)
	}
}

func TestSaysTheConnectionWasRefused(t *testing.T) {
	closed, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := closed.Addr().String()
	_ = closed.Close()

	sender := New(listed(t, "audit.example.com"))
	sender.transport.DialContext = func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{Timeout: time.Second}).DialContext(ctx, network, address)
	}

	result := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/"})
	if result.Status != 0 || result.Error != "The server refused the connection." {
		t.Errorf("got %+v", result)
	}
}

func TestSaysAnUntrustedCertificateIsNotTrusted(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	t.Cleanup(server.Close)

	sender := New(listed(t, "audit.example.com"))
	sendTo(t, sender, server)
	sender.transport.TLSClientConfig = &tls.Config{RootCAs: x509.NewCertPool()}

	result := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/"})
	if result.Status != 0 || !strings.HasPrefix(result.Error, "The server's certificate isn't trusted.") {
		t.Errorf("got %+v", result)
	}
}

func injecting(t *testing.T, allowed allowlist.List) *inject.Injector {
	t.Helper()

	key, err := seal.NewKey()
	if err != nil {
		t.Fatal(err)
	}
	sealed := func(value, secret string) string {
		t.Helper()
		out, err := sealtest.Seal(key.Recipient(), value, "call_1", secret)
		if err != nil {
			t.Fatal(err)
		}
		return out
	}
	injector := inject.From(context.Background(), protocol.EgressSecrets{RunID: "call_1", Secrets: []protocol.FetchedSecret{
		{Secret: "SLACK_BOT_TOKEN", Host: "slack.example.com", Location: protocol.LocationHeader, Name: "authorization",
			Prefix: "Bearer ", Sealed: sealed("xoxb-real", "SLACK_BOT_TOKEN")},
		{Secret: "SLACK_KEY", Host: "slack.example.com", Location: protocol.LocationQuery, Name: "key",
			Sealed: sealed("key-real", "SLACK_KEY")},
		{Secret: "OTHER_TOKEN", Host: "other.example.com", Location: protocol.LocationHeader, Name: "X-Other-Token",
			Sealed: sealed("other-real", "OTHER_TOKEN")},
	}}, nil, inject.Limits{Hosts: allowed}, key, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	t.Cleanup(injector.Wipe)

	return injector
}

var slackCall = protocol.HostCall{
	ID: "call_1", Method: http.MethodPost, URL: "https://slack.example.com/api/chat.postMessage",
	Headers: map[string]string{"authorization": "Bearer spotlight-egress:SLACK_BOT_TOKEN"},
}

func sentWithSecrets(t *testing.T, call protocol.HostCall, handler http.HandlerFunc) (protocol.HostCallResponse, bool) {
	t.Helper()

	called := false
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		handler(w, r)
	}))
	t.Cleanup(server.Close)

	allowed := listed(t, "slack.example.com", "other.example.com")
	sender := New(allowed).Injecting(injecting(t, allowed))
	sendTo(t, sender, server)

	return sender.Send(context.Background(), call), called
}

func TestRefusesAHostHeaderThatNamesAnotherHostThanTheURLWhenItInjects(t *testing.T) {
	call := slackCall
	call.Headers = map[string]string{"authorization": "Bearer spotlight-egress:SLACK_BOT_TOKEN", "Host": "admin.internal"}

	result, called := sentWithSecrets(t, call, func(http.ResponseWriter, *http.Request) {})

	if called || result.Status != 0 || !strings.HasPrefix(result.Error, "The call's Host header names another host than its URL") {
		t.Errorf("sent %v and got %+v", called, result)
	}
}

func TestSendsAHostHeaderThatNamesTheURLsHostWhenItInjects(t *testing.T) {
	call := slackCall
	call.Headers = map[string]string{"authorization": "Bearer spotlight-egress:SLACK_BOT_TOKEN", "host": "Slack.Example.com:443"}

	var host string
	result, _ := sentWithSecrets(t, call, func(_ http.ResponseWriter, r *http.Request) { host = r.Host })

	if result.Status != http.StatusOK || host != "Slack.Example.com:443" {
		t.Errorf("sent Host %q and got %+v", host, result)
	}
}

func TestRedactsEveryResponseHeaderAndABodyOfAnyType(t *testing.T) {
	result, _ := sentWithSecrets(t, slackCall, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("X-Echo", r.Header.Get("Authorization"))
		_, _ = io.WriteString(w, "\x00raw xoxb-real\x00")
	})

	body, _ := base64.StdEncoding.DecodeString(result.Body)
	if result.Error != "" || string(body) != "\x00raw spotlight-egress:SLACK_BOT_TOKEN\x00" {
		t.Errorf("the response kept a secret: %q (%+v)", body, result)
	}
	if echo := result.Headers["x-echo"]; echo != "Bearer spotlight-egress:SLACK_BOT_TOKEN" {
		t.Errorf("the response's header kept a secret: %s", echo)
	}
}

func TestDropsACompressedBodyItCannotRedact(t *testing.T) {
	result, _ := sentWithSecrets(t, slackCall, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte{0x1f, 0x8b, 0x08, 0x00})
	})

	if result.Status != http.StatusOK || result.Body != "" ||
		result.Error != "The response was compressed, so egress couldn't redact it." {
		t.Errorf("got %+v", result)
	}
}

func TestRedactsTheSecretsFromAnError(t *testing.T) {
	call := slackCall
	call.Headers = map[string]string{"authorization": "Bearer spotlight-egress:SLACK_BOT_TOKEN", "host": "xoxb-real.example.com"}

	result, called := sentWithSecrets(t, call, func(http.ResponseWriter, *http.Request) {})

	if called || strings.Contains(result.Error, "xoxb-real") || !strings.Contains(result.Error, "spotlight-egress:SLACK_BOT_TOKEN") {
		t.Errorf("sent %v and got %+v", called, result)
	}
}

func TestInjectsTheCallsSecretsForTheirHostAndRedactsThemFromTheResponse(t *testing.T) {
	allowed := listed(t, "slack.example.com", "other.example.com")
	injector := injecting(t, allowed)

	var got *http.Request
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Clone(context.Background())
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Location", "https://slack.example.com/next?key=key-real")
		_, _ = io.WriteString(w, `{"echo":"Bearer xoxb-real","key":"key-real"}`)
	}))
	t.Cleanup(server.Close)

	sender := New(allowed).Injecting(injector)
	sendTo(t, sender, server)

	result := sender.Send(context.Background(), protocol.HostCall{
		ID: "call_1", Method: http.MethodPost, URL: "https://slack.example.com/api/chat.postMessage?key=spotlight-egress:SLACK_KEY",
		Headers: map[string]string{
			"authorization": "Bearer spotlight-egress:SLACK_BOT_TOKEN", "x-other-token": "spotlight-egress:OTHER_TOKEN",
			"accept-encoding": "gzip, br",
		},
	})

	if result.Error != "" || result.Status != http.StatusOK {
		t.Fatalf("got %+v", result)
	}
	if got.Header.Get("Authorization") != "Bearer xoxb-real" || got.URL.Query().Get("key") != "key-real" {
		t.Errorf("the host was sent %v at %s", got.Header, got.URL)
	}
	if encoding := got.Header.Values("Accept-Encoding"); len(encoding) != 1 || encoding[0] != "identity" {
		t.Errorf("the host was asked for the response in %v", encoding)
	}
	if values, sent := got.Header["X-Other-Token"]; sent {
		t.Errorf("the host was sent another host's stand-in or secret: %v", values)
	}
	body, _ := base64.StdEncoding.DecodeString(result.Body)
	if string(body) != `{"echo":"Bearer spotlight-egress:SLACK_BOT_TOKEN","key":"spotlight-egress:SLACK_KEY"}` {
		t.Errorf("the response kept a secret: %s", body)
	}
	if location := result.Headers["location"]; location != "https://slack.example.com/next?key=spotlight-egress:SLACK_KEY" {
		t.Errorf("the response's location kept a secret: %s", location)
	}
}
