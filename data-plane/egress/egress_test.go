package egress

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"testing"

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
