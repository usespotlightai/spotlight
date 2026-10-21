package host

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"net/http"
	"net/http/httptest"
	"os"
	"os/signal"
	"path/filepath"
	"slices"
	"strings"
	"syscall"
	"testing"
	"time"

	"usespotlight.ai/data-plane/host/internal/config"
)

func settled(t *testing.T, body string) string {
	t.Helper()

	dir := t.TempDir()
	for _, name := range []string{
		"SPOTLIGHT_URL", "SPOTLIGHT_POOL_TOKEN", "SPOTLIGHT_TRUST", "SPOTLIGHT_OIDC_TOKEN_FILE", "SPOTLIGHT_CAPACITY",
		"SPOTLIGHT_RUNNER_IMAGE", "SPOTLIGHT_HOST_NAME", "DOCKER_HOST", "SPOTLIGHT_SANDBOX_ENV", "SPOTLIGHT_EGRESS_ENV",
	} {
		t.Setenv(name, "")
	}
	t.Setenv(config.EnvConfig, filepath.Join(dir, "host.env"))
	t.Setenv("SPOTLIGHT_STATE", filepath.Join(dir, "state"))
	if body != "" {
		if err := os.WriteFile(filepath.Join(dir, "host.env"), []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	return filepath.Join(dir, "host.env")
}

func saved(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

const ready = "SPOTLIGHT_URL=https://spotlight.test\nSPOTLIGHT_POOL_TOKEN=spl_0123456789abcd\n"

func TestFlagsMayFollowTheArguments(t *testing.T) {
	flags := flag.NewFlagSet("set", flag.ContinueOnError)
	now := flags.Bool("now", false, "")
	rest, err := parse(flags, []string{"capacity=8", "--now", "image=runner:2"})
	if err != nil || !*now || !slices.Equal(rest, []string{"capacity=8", "image=runner:2"}) {
		t.Errorf("rest %v, now %v, error %v", rest, *now, err)
	}
}

func TestArgumentsAfterTheMarkerAreNotFlags(t *testing.T) {
	flags := flag.NewFlagSet("set", flag.ContinueOnError)
	now := flags.Bool("now", false, "")
	rest, err := parse(flags, []string{"capacity=8", "--", "--now"})
	if err != nil || *now || !slices.Equal(rest, []string{"capacity=8", "--now"}) {
		t.Errorf("rest %v, now %v, error %v", rest, *now, err)
	}
}

func TestValidationReadsTheFileNotTheShell(t *testing.T) {
	path := settled(t, ready)
	t.Setenv("SPOTLIGHT_CAPACITY", "5")

	if err := changeSettings(new(bytes.Buffer), "dev", "set", []string{"capacity=abc"}); err == nil {
		t.Fatal("a bad capacity is saved because the shell sets a good one")
	}
	if saved(t, path) != ready {
		t.Errorf("saved:\n%s", saved(t, path))
	}
}

func TestInitWithOneHalfOfATrustKeepsTheOther(t *testing.T) {
	path := settled(t, "SPOTLIGHT_URL=https://self.test\nSPOTLIGHT_TRUST=trust_1\nSPOTLIGHT_OIDC_TOKEN_FILE=/token\n")
	file, _ := config.Open(path)

	f := initFlags{tokenFile: "/new-token", given: map[string]bool{"oidc-token-file": true}}
	if err := settle(file, f, nil, "dev"); err != nil {
		t.Fatal(err)
	}
	if got := file.Values(); got["SPOTLIGHT_TRUST"] != "trust_1" || got["SPOTLIGHT_OIDC_TOKEN_FILE"] != "/new-token" {
		t.Errorf("values %v", got)
	}
}

func TestSetsAndUnsetsSettingsByTheirFriendlyKeys(t *testing.T) {
	path := settled(t, ready)
	var out bytes.Buffer

	if err := changeSettings(&out, "dev", "set", []string{"capacity=8", "SPOTLIGHT_RUN_TIMEOUT=2h"}); err != nil {
		t.Fatal(err)
	}
	if got := saved(t, path); !strings.Contains(got, "SPOTLIGHT_CAPACITY=8\n") || !strings.Contains(got, "SPOTLIGHT_RUN_TIMEOUT=2h\n") {
		t.Errorf("saved:\n%s", got)
	}
	if !strings.Contains(out.String(), "No host runs") {
		t.Errorf("said %q", out.String())
	}

	out.Reset()
	if err := getSetting(&out, []string{"capacity"}); err != nil || out.String() != "8\n" {
		t.Errorf("get %q, %v", out.String(), err)
	}

	if err := changeSettings(&out, "dev", "unset", []string{"run-timeout"}); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(saved(t, path), "RUN_TIMEOUT") {
		t.Errorf("still saved:\n%s", saved(t, path))
	}
}

func TestAnInvalidValueChangesNothing(t *testing.T) {
	path := settled(t, ready)

	err := changeSettings(new(bytes.Buffer), "dev", "set", []string{"capacity=8", "run-timeout=soon"})
	if err == nil || !strings.Contains(err.Error(), `run-timeout: "soon"`) {
		t.Fatalf("error %v", err)
	}
	if saved(t, path) != ready {
		t.Errorf("saved:\n%s", saved(t, path))
	}
}

func TestListingMasksTheToken(t *testing.T) {
	settled(t, ready+"SPOTLIGHT_CAPACITY=4\nHTTPS_PROXY=http://proxy.test\n")
	var out bytes.Buffer

	if err := listSettings(&out, []string{"--json"}); err != nil {
		t.Fatal(err)
	}
	var got struct{ Settings []listed }
	if err := json.Unmarshal(out.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	want := []listed{
		{Key: "url", Env: "SPOTLIGHT_URL", Value: "https://spotlight.test"},
		{Key: "token", Env: "SPOTLIGHT_POOL_TOKEN", Value: "••••abcd"},
		{Key: "capacity", Env: "SPOTLIGHT_CAPACITY", Value: "4"},
		{Key: "HTTPS_PROXY", Env: "HTTPS_PROXY", Value: "http://proxy.test"},
	}
	if !slices.Equal(got.Settings, want) {
		t.Errorf("listed %+v", got.Settings)
	}
	if strings.Contains(out.String(), "0123456789") {
		t.Error("the listing shows the token")
	}
}

// signalled holds the lock as a running host would, and catches what the command sends it.
func signalled(t *testing.T) <-chan os.Signal {
	t.Helper()

	release, err := config.Lock(os.Getenv("SPOTLIGHT_STATE"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(release)

	caught := make(chan os.Signal, 2)
	signal.Notify(caught, syscall.SIGHUP, syscall.SIGUSR1)
	t.Cleanup(func() { signal.Stop(caught) })
	return caught
}

func received(t *testing.T, caught <-chan os.Signal) os.Signal {
	t.Helper()
	select {
	case sig := <-caught:
		return sig
	case <-time.After(2 * time.Second):
		t.Fatal("the host got no signal")
		return nil
	}
}

func TestALiveSettingReloadsTheRunningHost(t *testing.T) {
	settled(t, ready)
	caught := signalled(t)
	var out bytes.Buffer

	if err := changeSettings(&out, "dev", "set", []string{"capacity=8", "image=runner:2"}); err != nil {
		t.Fatal(err)
	}
	if sig := received(t, caught); sig != syscall.SIGHUP {
		t.Errorf("sent %v", sig)
	}
	if !strings.Contains(out.String(), "applied the change") {
		t.Errorf("said %q", out.String())
	}
}

func TestASettingThatNeedsARestartRestartsWhenTheSandboxesFinish(t *testing.T) {
	settled(t, ready)
	caught := signalled(t)

	if err := changeSettings(new(bytes.Buffer), "dev", "set", []string{"capacity=8", "url=https://other.test"}); err != nil {
		t.Fatal(err)
	}
	if sig := received(t, caught); sig != syscall.SIGUSR1 {
		t.Errorf("sent %v", sig)
	}
}

func TestInitTakesItsFlagsAndDefaultsWithoutATerminal(t *testing.T) {
	path := settled(t, "")
	file, _ := config.Open(path)

	f := initFlags{url: "https://spotlight.test", token: "pool-token", given: map[string]bool{"url": true, "token": true}}
	if err := settle(file, f, nil, "v1.2.0"); err != nil {
		t.Fatal(err)
	}

	got := file.Values()
	want := map[string]string{"SPOTLIGHT_URL": "https://spotlight.test", "SPOTLIGHT_POOL_TOKEN": "pool-token", "SPOTLIGHT_CAPACITY": "5"}
	if len(got) != len(want) {
		t.Errorf("values %v", got)
	}
	for key, value := range want {
		if got[key] != value {
			t.Errorf("%s = %q, want %q", key, got[key], value)
		}
	}
}

func TestInitAgainKeepsWhatIsSaved(t *testing.T) {
	path := settled(t, "SPOTLIGHT_URL=https://self.test\nSPOTLIGHT_TRUST=trust_1\nSPOTLIGHT_OIDC_TOKEN_FILE=/token\nSPOTLIGHT_CAPACITY=3\nSPOTLIGHT_RUNNER_IMAGE=runner:2\n")
	file, _ := config.Open(path)

	if err := settle(file, initFlags{capacity: 6, given: map[string]bool{"capacity": true}}, nil, "v1.2.0"); err != nil {
		t.Fatal(err)
	}

	got := file.Values()
	if got["SPOTLIGHT_URL"] != "https://self.test" || got["SPOTLIGHT_TRUST"] != "trust_1" || got["SPOTLIGHT_CAPACITY"] != "6" ||
		got["SPOTLIGHT_RUNNER_IMAGE"] != "runner:2" {
		t.Errorf("values %v", got)
	}
}

func TestInitNeedsATokenWithoutATerminal(t *testing.T) {
	file, _ := config.Open(settled(t, ""))
	if err := settle(file, initFlags{given: map[string]bool{}}, nil, "dev"); err == nil || !strings.Contains(err.Error(), "--token") {
		t.Errorf("error %v", err)
	}
}

func TestInitStopsOnACredentialSpotlightRefuses(t *testing.T) {
	refusing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer refusing.Close()
	settled(t, "")

	cfg, err := config.Parse("dev", map[string]string{"SPOTLIGHT_URL": refusing.URL, "SPOTLIGHT_POOL_TOKEN": "pool-token"})
	if err != nil {
		t.Fatal(err)
	}
	if err := reach(context.Background(), new(bytes.Buffer), cfg); err == nil || !strings.Contains(err.Error(), "does not accept") {
		t.Errorf("error %v", err)
	}

	cfg.URL = "http://127.0.0.1:1"
	var out bytes.Buffer
	if err := reach(context.Background(), &out, cfg); err != nil || !strings.Contains(out.String(), "does not answer") {
		t.Errorf("an unreachable Spotlight: %v, said %q", err, out.String())
	}
}
