package send

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
)

func listed(t *testing.T, entries ...string) reach.List {
	t.Helper()

	list, err := reach.Parse(entries)
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

func TestSendsTheCallOnceAndAnswersWithTheHostsResponse(t *testing.T) {
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

	answer := sender.Send(context.Background(), protocol.HostCall{
		ID: "call_1", Method: http.MethodPost, URL: "https://audit.example.com/hooks",
		Headers: map[string]string{"content-type": "application/json", "webhook-id": "firing_1"},
		Body:    encoded(`{"hook":"core/dba-review"}`), TimeoutMs: 5000,
	})

	if answer.Error != "" || answer.Status != http.StatusAccepted {
		t.Fatalf("answered %+v", answer)
	}
	if calls != 1 || got.Method != http.MethodPost || got.URL.Path != "/hooks" || got.Host != "audit.example.com" {
		t.Errorf("the host saw %d calls, last %s %s at %s", calls, got.Method, got.URL.Path, got.Host)
	}
	if got.Header.Get("Webhook-Id") != "firing_1" || received != `{"hook":"core/dba-review"}` {
		t.Errorf("the host was sent %v %q", got.Header, received)
	}
	body, _ := base64.StdEncoding.DecodeString(answer.Body)
	if string(body) != `{"deny":"no migrations on Fridays"}` || answer.Headers["content-type"] != "application/json" {
		t.Errorf("answered %q with %v", body, answer.Headers)
	}
}

func TestTrimsTheAnswersBody(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, strings.Repeat("a", 3*protocol.AnswerBodyMost))
	}))
	t.Cleanup(server.Close)

	sender := New(listed(t, "audit.example.com"))
	sendTo(t, sender, server)

	answer := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/"})
	body, _ := base64.StdEncoding.DecodeString(answer.Body)
	if answer.Status != http.StatusOK || len(body) != protocol.AnswerBodyMost {
		t.Errorf("answered %d with %d bytes", answer.Status, len(body))
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

	answer := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/"})
	if answer.Status != http.StatusFound || answer.Headers["location"] != "https://elsewhere.example.com/" || calls != 1 {
		t.Errorf("answered %+v after %d calls", answer, calls)
	}
}

func TestBlocksAHostTheAllowListLeavesOut(t *testing.T) {
	sender := New(listed(t, "grafana.example.com"))

	answer := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.acme.internal/"})
	if answer.Status != 0 || answer.Error != "The host's allow-list doesn't admit audit.acme.internal." {
		t.Errorf("answered %+v", answer)
	}
}

func TestNeverConnectsToItselfEvenForAHostTheListNames(t *testing.T) {
	sender := New(listed(t, "127.0.0.1"))

	answer := sender.Send(context.Background(), protocol.HostCall{URL: "http://127.0.0.1:9/"})
	if answer.Status != 0 || answer.Error != "Egress never opens a connection to 127.0.0.1." {
		t.Errorf("answered %+v", answer)
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

	answer := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/", TimeoutMs: 100})
	if answer.Status != 0 || answer.Error != "The call timed out. Time limit: 100ms" || answer.Ms < 100 {
		t.Errorf("answered %+v", answer)
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

	answer := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/"})
	if answer.Status != 0 || answer.Error != "The server refused the connection." {
		t.Errorf("answered %+v", answer)
	}
}

func TestSaysAnUntrustedCertificateIsNotTrusted(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	t.Cleanup(server.Close)

	sender := New(listed(t, "audit.example.com"))
	sendTo(t, sender, server)
	sender.transport.TLSClientConfig = &tls.Config{RootCAs: x509.NewCertPool()}

	answer := sender.Send(context.Background(), protocol.HostCall{URL: "https://audit.example.com/"})
	if answer.Status != 0 || !strings.HasPrefix(answer.Error, "The server's certificate isn't trusted.") {
		t.Errorf("answered %+v", answer)
	}
}
