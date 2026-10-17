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

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
)

type fakeFetcher struct {
	answers []error
	asked   int
}

func (r *fakeFetcher) FetchRunSecrets(context.Context, string) (protocol.EgressSecrets, error) {
	r.asked++
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
	asked := &fakeFetcher{answers: []error{
		errors.New("connection refused"),
		&control.Rejection{Status: http.StatusBadGateway, Err: errors.New("bad gateway")},
	}}

	if fetched := fetchedBy(context.Background(), asked, "key", quiet); fetched.RunID != "run_1" || asked.asked != 3 {
		t.Errorf("fetched %+v after %d asks", fetched, asked.asked)
	}
}

func TestGoesOutInjectingNothingWhenTheControlPlaneRefuses(t *testing.T) {
	asked := &fakeFetcher{answers: []error{&control.Rejection{Status: http.StatusUnauthorized, Err: control.ErrRefused}}}

	if fetched := fetchedBy(context.Background(), asked, "key", quiet); fetched.RunID != "" || asked.asked != 1 {
		t.Errorf("fetched %+v after %d asks", fetched, asked.asked)
	}
}

func TestReadsWhatTheHostHandedItOnceAndLeavesNoCopy(t *testing.T) {
	path := filepath.Join(t.TempDir(), "egress.json")
	if err := os.WriteFile(path, []byte(`{"url":"http://control-plane:3000","token":"egress-token","credential":"proxy","allow":["api.example.com"],"secretAllow":["sentry-*"]}`), 0o400); err != nil {
		t.Fatal(err)
	}

	handed, err := handedTo(path)
	if err != nil || handed.Token != "egress-token" || handed.URL != "http://control-plane:3000" ||
		handed.Credential != "proxy" || len(handed.Allow) != 1 || len(handed.SecretAllow) != 1 {
		t.Fatalf("handed %+v: %v", handed, err)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the handed file is still there: %v", err)
	}
}

func TestRefusesAHandingWithNoControlPlaneOrProxyCredential(t *testing.T) {
	for _, handed := range []string{
		`{"credential":"proxy"}`,
		`{"url":"http://control-plane:3000","token":"egress-token"}`,
	} {
		path := filepath.Join(t.TempDir(), "egress.json")
		if err := os.WriteFile(path, []byte(handed), 0o400); err != nil {
			t.Fatal(err)
		}

		if _, err := handedTo(path); err == nil {
			t.Errorf("took %s", handed)
		}
	}
}

func TestFetchesNothingWithoutAToken(t *testing.T) {
	connected := false
	fetched, err := fetchSecretsFor(context.Background(), protocol.EgressHanded{URL: "http://control-plane:3000"}, "key",
		func(string, string) (SecretFetcher, error) {
			connected = true
			return &fakeFetcher{}, nil
		}, quiet)

	if err != nil || connected || fetched.RunID != "" {
		t.Errorf("fetched %+v (connected %v): %v", fetched, connected, err)
	}
}

func TestReachesTheControlPlaneAndItsStorageButNoHostASecretIsBoundTo(t *testing.T) {
	listed, err := reach.Parse([]string{"api.anthropic.com"})
	if err != nil {
		t.Fatal(err)
	}

	reached := reachedBy(listed, "control-plane", protocol.EgressSecrets{
		Reaches: []string{"storage"},
		Secrets: []protocol.FetchedSecret{{Secret: "PRIVATE", Host: "private-api.acme.internal"}},
	})

	for host, want := range map[string]bool{
		"control-plane": true, "storage": true, "api.anthropic.com": true, "private-api.acme.internal": false,
	} {
		if reached.Names(host) != want {
			t.Errorf("%s named: %v", host, !want)
		}
	}
}

type sender protocol.HostCallAnswer

func (s sender) Send(context.Context, protocol.HostCall) protocol.HostCallAnswer {
	return protocol.HostCallAnswer(s)
}

func TestWritesTheCallsAnswerForTheHostAndWaitsToBeStopped(t *testing.T) {
	path := filepath.Join(t.TempDir(), "egress", "answer.json")
	ctx, stop := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() {
		done <- sent(ctx, protocol.HostCall{ID: "call_1"}, sender{Status: 0, Error: "connection refused", Ms: 3}, path, quiet)
	}()

	var answer protocol.HostCallAnswer
	deadline := time.Now().Add(3 * time.Second)
	for {
		raw, err := os.ReadFile(path)
		if err == nil && json.Unmarshal(raw, &answer) == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("never wrote the answer")
		}
		time.Sleep(5 * time.Millisecond)
	}
	if answer.Error != "connection refused" || answer.Ms != 3 {
		t.Errorf("wrote %+v", answer)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o644 {
		t.Errorf("wrote the answer as %v", info.Mode())
	}

	select {
	case err := <-done:
		t.Fatalf("stopped before it was told to: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	stop()
	if err := <-done; err != nil {
		t.Errorf("stopped with %v", err)
	}
}
