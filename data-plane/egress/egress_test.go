package egress

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"usespotlight.ai/data-plane/allowlist"
	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/egress/internal/send"
	"usespotlight.ai/data-plane/egresskit/seal/sealtest"
	"usespotlight.ai/data-plane/protocol"
)

type fakeFetcher struct {
	answers []error
	calls   int
}

func (r *fakeFetcher) FetchRunSecrets(context.Context, string) (protocol.EgressSecrets, error) {
	r.calls++
	if len(r.answers) > 0 {
		answer := r.answers[0]
		r.answers = r.answers[1:]
		if answer != nil {
			return protocol.EgressSecrets{}, answer
		}
	}
	return protocol.EgressSecrets{RunID: "run_1"}, nil
}

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func TestTriesAgainWhileTheControlPlaneCannotAnswer(t *testing.T) {
	fetcher := &fakeFetcher{answers: []error{
		errors.New("connection refused"),
		&control.ResponseError{Status: http.StatusBadGateway, Err: errors.New("bad gateway")},
	}}

	if fetched := fetchedBy(context.Background(), fetcher, "key", quiet); fetched.RunID != "run_1" || fetcher.calls != 3 {
		t.Errorf("fetched %+v after %d calls", fetched, fetcher.calls)
	}
}

func TestGoesOutInjectingNothingWhenTheControlPlaneDoesNotAccept(t *testing.T) {
	fetcher := &fakeFetcher{answers: []error{&control.ResponseError{Status: http.StatusUnauthorized, Err: control.ErrUnauthorized}}}

	if fetched := fetchedBy(context.Background(), fetcher, "key", quiet); fetched.RunID != "" || fetcher.calls != 1 {
		t.Errorf("fetched %+v after %d calls", fetched, fetcher.calls)
	}
}

func TestReadsItsConfigOnceAndLeavesNoCopy(t *testing.T) {
	path := filepath.Join(t.TempDir(), "egress.json")
	if err := os.WriteFile(path, []byte(`{"url":"http://control-plane:3000","token":"egress-token","credential":"proxy","allow":["api.example.com"],"secretAllow":["sentry-*"]}`), 0o400); err != nil {
		t.Fatal(err)
	}

	config, err := readConfig(path)
	if err != nil || config.Token != "egress-token" || config.URL != "http://control-plane:3000" ||
		config.Credential != "proxy" || len(config.Allow) != 1 || len(config.SecretAllow) != 1 {
		t.Fatalf("config %+v: %v", config, err)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the config file is still there: %v", err)
	}
}

func TestRejectsAConfigWithNoControlPlaneOrProxyCredential(t *testing.T) {
	for _, config := range []string{
		`{"credential":"proxy"}`,
		`{"url":"http://control-plane:3000","token":"egress-token"}`,
	} {
		path := filepath.Join(t.TempDir(), "egress.json")
		if err := os.WriteFile(path, []byte(config), 0o400); err != nil {
			t.Fatal(err)
		}

		if _, err := readConfig(path); err == nil {
			t.Errorf("accepted %s", config)
		}
	}
}

func TestFetchesNothingWithoutAToken(t *testing.T) {
	connected := false
	fetched, err := fetchSecretsFor(context.Background(), protocol.EgressConfig{URL: "http://control-plane:3000"}, "key",
		func(string, string) (SecretFetcher, error) {
			connected = true
			return &fakeFetcher{}, nil
		}, quiet)

	if err != nil || connected || fetched.RunID != "" {
		t.Errorf("fetched %+v (connected %v): %v", fetched, connected, err)
	}
}

func TestAllowsTheControlPlaneAndItsStorageButNoHostASecretIsBoundTo(t *testing.T) {
	listed, err := allowlist.Parse([]string{"api.anthropic.com"})
	if err != nil {
		t.Fatal(err)
	}

	allowed := withRunHosts(listed, "control-plane", protocol.EgressSecrets{
		ExtraAllowedHosts: []string{"storage"},
		Secrets:           []protocol.FetchedSecret{{Secret: "PRIVATE", Host: "private-api.acme.internal"}},
	}, []string{"archives"})

	for host, want := range map[string]bool{
		"control-plane": true, "storage": true, "archives": true, "api.anthropic.com": true, "private-api.acme.internal": false,
	} {
		if allowed.ExplicitlyListed(host) != want {
			t.Errorf("%s named: %v", host, !want)
		}
	}
}

type sender protocol.HostCallResponse

func (s sender) Send(context.Context, protocol.HostCall) protocol.HostCallResponse {
	return protocol.HostCallResponse(s)
}

func TestWritesTheCallsResponseForTheHostAndWaitsToBeStopped(t *testing.T) {
	path := filepath.Join(t.TempDir(), "egress", "response.json")
	ctx, stop := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() {
		done <- sent(ctx, protocol.HostCall{ID: "call_1"}, sender{Status: 0, Error: "connection refused", Ms: 3}, path, quiet)
	}()

	var response protocol.HostCallResponse
	deadline := time.Now().Add(3 * time.Second)
	for {
		raw, err := os.ReadFile(path)
		if err == nil && json.Unmarshal(raw, &response) == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("never wrote the response")
		}
		time.Sleep(5 * time.Millisecond)
	}
	if response.Error != "connection refused" || response.Ms != 3 {
		t.Errorf("wrote %+v", response)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o644 {
		t.Errorf("wrote the response as %v", info.Mode())
	}

	select {
	case err := <-done:
		t.Fatalf("stopped before a stop was requested: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	stop()
	if err := <-done; err != nil {
		t.Errorf("stopped with %v", err)
	}
}

type redeemingPlane struct {
	t        *testing.T
	statuses []int
	extra    []protocol.FetchedSecret
	denied   []protocol.DeniedSecret
	mu       sync.Mutex
	redeems  []protocol.HostCallSecretsRequest
	headers  []http.Header
}

func (p *redeemingPlane) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p.mu.Lock()
	defer p.mu.Unlock()

	var redeem protocol.HostCallSecretsRequest
	_ = json.NewDecoder(r.Body).Decode(&redeem)
	p.redeems, p.headers = append(p.redeems, redeem), append(p.headers, r.Header.Clone())

	if r.URL.Path != "/api/hosts/calls/call_1/secrets" || r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	if len(p.statuses) > 0 {
		status := p.statuses[0]
		p.statuses = p.statuses[1:]
		if status != http.StatusOK {
			http.Error(w, `{"reason":"refused"}`, status)
			return
		}
	}

	sealed := func(value, secret string) string {
		out, err := sealtest.Seal(redeem.Recipient, value, "call_1", secret)
		if err != nil {
			p.t.Error(err)
		}
		return out
	}
	secrets := []protocol.FetchedSecret{
		{Secret: "SLACK_BOT_TOKEN", Host: "slack.example.com", Location: protocol.LocationHeader, Name: "Authorization",
			Prefix: "Bearer ", Sealed: sealed("xoxb-real", "SLACK_BOT_TOKEN")},
		{Secret: "OTHER_TOKEN", Host: "other.example.com", Location: protocol.LocationHeader, Name: "X-Other-Token",
			Sealed: sealed("other-real", "OTHER_TOKEN")},
	}
	for _, each := range p.extra {
		each.Sealed = sealed("foreign-real", each.Sealed)
		secrets = append(secrets, each)
	}
	_ = json.NewEncoder(w).Encode(protocol.EgressSecrets{
		RunID: "call_1", ExtraAllowedHosts: []string{}, Denied: append([]protocol.DeniedSecret{}, p.denied...), Secrets: secrets,
	})
}

func (p *redeemingPlane) redeemed() ([]protocol.HostCallSecretsRequest, []http.Header) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return slices.Clone(p.redeems), slices.Clone(p.headers)
}

type upstream struct {
	injector send.Injector
	sent     *http.Request
	called   bool
}

func (u *upstream) Send(_ context.Context, call protocol.HostCall) protocol.HostCallResponse {
	u.called = true
	u.sent, _ = http.NewRequest(call.Method, call.URL, nil)
	for name, value := range call.Headers {
		u.sent.Header.Set(name, value)
	}
	if u.injector != nil {
		u.injector.Inject(u.sent.URL.Hostname(), u.sent)
	}

	answer := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": {"application/json"}, "Location": {"https://slack.example.com/?t=xoxb-real"}},
		Body:       io.NopCloser(strings.NewReader(`{"echo":"xoxb-real"}`)),
	}
	if u.injector != nil {
		_ = u.injector.RedactAnswer(u.sent.URL.Hostname(), answer)
	}
	read, _ := io.ReadAll(answer.Body)

	return protocol.HostCallResponse{
		Status: answer.StatusCode, Headers: map[string]string{"location": answer.Header.Get("Location")},
		Body: base64.StdEncoding.EncodeToString(read),
	}
}

func sentAndRead(
	t *testing.T, config protocol.EgressConfig, sending func(send.Injector) Sender,
) protocol.HostCallResponse {
	t.Helper()

	allowed, err := allowlist.Parse(config.Allow)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "egress", "response.json")
	ctx, stop := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() {
		done <- sentWith(ctx, config, allowed, func(url string) (CallSecretRedeemer, error) {
			return control.Authorized(url, control.NoCredential{})
		}, sending, path, quiet)
	}()
	t.Cleanup(func() {
		stop()
		if err := <-done; err != nil {
			t.Errorf("stopped with %v", err)
		}
	})

	deadline := time.Now().Add(5 * time.Second)
	for {
		var response protocol.HostCallResponse
		if raw, err := os.ReadFile(path); err == nil && json.Unmarshal(raw, &response) == nil {
			return response
		}
		if time.Now().After(deadline) {
			t.Fatal("never wrote the response")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func callWithSecrets(controlPlane string) protocol.EgressConfig {
	return protocol.EgressConfig{
		URL: controlPlane, Credential: "proxy", Allow: []string{"slack.example.com", "other.example.com"},
		Send: &protocol.HostCall{
			ID: "call_1", Method: http.MethodPost, URL: "https://slack.example.com/api/chat.postMessage",
			Headers: map[string]string{
				"Authorization": "Bearer spotlight-egress:SLACK_BOT_TOKEN", "X-Other-Token": "spotlight-egress:OTHER_TOKEN",
				"X-Foreign": "spotlight-egress:FOREIGN",
			},
			SecretsToken: "secrets-token",
		},
		SendSecrets: &protocol.CallSecrets{CallID: "call_1", Host: "host_1", Token: "secrets-token"},
	}
}

func TestSendsACallWithTheSecretsItRedeemedForTheBoundHostOnlyAndRedactsThem(t *testing.T) {
	plane := &redeemingPlane{t: t}
	server := httptest.NewServer(plane)
	t.Cleanup(server.Close)

	sender := &upstream{}
	response := sentAndRead(t, callWithSecrets(server.URL), func(injector send.Injector) Sender {
		sender.injector = injector
		return sender
	})

	redeems, headers := plane.redeemed()
	if len(redeems) != 1 || redeems[0].Host != "host_1" || redeems[0].Token != "secrets-token" || redeems[0].Recipient == "" {
		t.Fatalf("redeemed %+v", redeems)
	}
	if headers[0].Get("Authorization") != "" || headers[0].Get(protocol.TrustHeader) != "" {
		t.Errorf("redeemed with a host credential: %v", headers[0])
	}
	if sender.injector == nil || !sender.called {
		t.Fatal("sent the call with no secrets to inject")
	}
	if got := sender.sent.Header.Get("Authorization"); got != "Bearer xoxb-real" {
		t.Errorf("sent Authorization %q", got)
	}
	for _, name := range []string{"X-Other-Token", "X-Foreign"} {
		if values, sent := sender.sent.Header[name]; sent {
			t.Errorf("sent %s %v, a secret of no value for the call's host", name, values)
		}
	}

	body, _ := base64.StdEncoding.DecodeString(response.Body)
	if response.Status != http.StatusOK || response.Error != "" || string(body) != `{"echo":"spotlight-egress:SLACK_BOT_TOKEN"}` ||
		response.Headers["location"] != "https://slack.example.com/?t=spotlight-egress:SLACK_BOT_TOKEN" {
		t.Errorf("answered %+v with %s", response, body)
	}
}

func TestSendsNothingWhenTheControlPlaneRefusesToRedeemTheCallsSecrets(t *testing.T) {
	for _, status := range []int{http.StatusUnauthorized, http.StatusNotFound, http.StatusConflict, http.StatusGone} {
		plane := &redeemingPlane{t: t, statuses: []int{status}}
		server := httptest.NewServer(plane)
		t.Cleanup(server.Close)

		sender := &upstream{}
		response := sentAndRead(t, callWithSecrets(server.URL), func(injector send.Injector) Sender {
			sender.injector = injector
			return sender
		})

		if redeems, _ := plane.redeemed(); len(redeems) != 1 {
			t.Errorf("%d: tried to redeem %d times", status, len(redeems))
		}
		if sender.called {
			t.Errorf("%d: sent the call", status)
		}
		if response.Status != 0 ||
			!strings.HasPrefix(response.Error, "Egress couldn't redeem the call's secrets, so it didn't send the call. Error: ") {
			t.Errorf("%d: answered %+v", status, response)
		}
	}
}

func TestSendsNothingWhenASecretOfTheCallCannotBeInjected(t *testing.T) {
	for name, plane := range map[string]*redeemingPlane{
		"denied": {t: t, denied: []protocol.DeniedSecret{{Secret: "FOREIGN", Reason: "not bound"}}},
		"unopened": {t: t, extra: []protocol.FetchedSecret{
			{Secret: "FOREIGN", Host: "slack.example.com", Location: protocol.LocationHeader, Name: "X-Foreign", Sealed: "SOMETHING_ELSE"},
		}},
		"conflict": {t: t, extra: []protocol.FetchedSecret{
			{Secret: "FOREIGN", Host: "slack.example.com", Location: protocol.LocationHeader, Name: "Authorization", Sealed: "FOREIGN"},
		}},
	} {
		server := httptest.NewServer(plane)
		t.Cleanup(server.Close)

		sender := &upstream{}
		response := sentAndRead(t, callWithSecrets(server.URL), func(injector send.Injector) Sender {
			sender.injector = injector
			return sender
		})

		if sender.called {
			t.Errorf("%s: sent the call", name)
		}
		if response.Status != 0 || response.Error != "Egress couldn't inject secret FOREIGN, so it didn't send the call." {
			t.Errorf("%s: answered %+v", name, response)
		}
	}
}

func TestTriesAgainToRedeemTheCallsSecretsWhileTheControlPlaneCannotAnswer(t *testing.T) {
	plane := &redeemingPlane{t: t, statuses: []int{http.StatusServiceUnavailable}}
	server := httptest.NewServer(plane)
	t.Cleanup(server.Close)

	sender := &upstream{}
	response := sentAndRead(t, callWithSecrets(server.URL), func(injector send.Injector) Sender {
		sender.injector = injector
		return sender
	})

	if redeems, _ := plane.redeemed(); len(redeems) != 2 || response.Status != http.StatusOK ||
		sender.sent.Header.Get("Authorization") != "Bearer xoxb-real" {
		t.Errorf("redeemed %d times and answered %+v", len(redeems), response)
	}
}

func TestSendsACallWithNoSecretsWithoutAskingTheControlPlane(t *testing.T) {
	plane := &redeemingPlane{t: t}
	server := httptest.NewServer(plane)
	t.Cleanup(server.Close)

	config := callWithSecrets(server.URL)
	config.SendSecrets = nil
	sender := &upstream{}
	injected := false
	response := sentAndRead(t, config, func(injector send.Injector) Sender {
		injected = injector != nil
		return sender
	})

	if redeems, _ := plane.redeemed(); len(redeems) != 0 || injected || !sender.called || response.Status != http.StatusOK {
		t.Errorf("redeemed %d times (injecting %v) and answered %+v", len(redeems), injected, response)
	}
}
