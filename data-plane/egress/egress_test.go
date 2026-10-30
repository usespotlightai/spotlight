package egress

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"usespotlight.ai/data-plane/allowlist"
	"usespotlight.ai/data-plane/control"
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
