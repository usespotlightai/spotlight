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

type redeemer struct {
	answers []error
	asked   int
}

func (r *redeemer) RedeemEgress(context.Context, string) (protocol.EgressRedemption, error) {
	r.asked++
	if len(r.answers) > 0 {
		answer := r.answers[0]
		r.answers = r.answers[1:]
		if answer != nil {
			return protocol.EgressRedemption{}, answer
		}
	}
	return protocol.EgressRedemption{RunID: "run_1"}, nil
}

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func TestTriesAgainWhileTheControlPlaneCannotAnswer(t *testing.T) {
	asked := &redeemer{answers: []error{
		errors.New("connection refused"),
		&control.Rejection{Status: http.StatusBadGateway, Err: errors.New("bad gateway")},
	}}

	if redeemed := redeemedBy(context.Background(), asked, "key", quiet); redeemed.RunID != "run_1" || asked.asked != 3 {
		t.Errorf("redeemed %+v after %d asks", redeemed, asked.asked)
	}
}

func TestGoesOutWearingNothingWhenTheControlPlaneRefuses(t *testing.T) {
	asked := &redeemer{answers: []error{&control.Rejection{Status: http.StatusUnauthorized, Err: control.ErrRefused}}}

	if redeemed := redeemedBy(context.Background(), asked, "key", quiet); redeemed.RunID != "" || asked.asked != 1 {
		t.Errorf("redeemed %+v after %d asks", redeemed, asked.asked)
	}
}

func TestReadsWhatTheHostHandedItOnceAndLeavesNoCopy(t *testing.T) {
	path := filepath.Join(t.TempDir(), "egress.json")
	if err := os.WriteFile(path, []byte(`{"url":"http://control-plane:3000","token":"egress-token","credential":"proxy","allow":["api.example.com"],"reads":["sentry-*"]}`), 0o400); err != nil {
		t.Fatal(err)
	}

	handed, err := handedTo(path)
	if err != nil || handed.Token != "egress-token" || handed.URL != "http://control-plane:3000" ||
		handed.Credential != "proxy" || len(handed.Allow) != 1 || len(handed.Reads) != 1 {
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

func TestRedeemsNothingWithoutAToken(t *testing.T) {
	connected := false
	redeemed, err := redemptionFor(context.Background(), protocol.EgressHanded{URL: "http://control-plane:3000"}, "key",
		func(string, string) (Redeemer, error) {
			connected = true
			return &redeemer{}, nil
		}, quiet)

	if err != nil || connected || redeemed.RunID != "" {
		t.Errorf("redeemed %+v (connected %v): %v", redeemed, connected, err)
	}
}

func TestReachesTheControlPlaneAndItsStorageButNoHostASecretIsBoundTo(t *testing.T) {
	listed, err := reach.Parse([]string{"api.anthropic.com"})
	if err != nil {
		t.Fatal(err)
	}

	reached := reachedBy(listed, "control-plane", protocol.EgressRedemption{
		Reaches: []string{"storage"},
		Secrets: []protocol.RedeemedSecret{{Secret: "PRIVATE", Host: "private-api.acme.internal"}},
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
