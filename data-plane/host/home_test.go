package host

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/data-plane/credentials"
	"usespotlight.ai/data-plane/host/internal/config"
)

func TestStatusOfAComputerWithNothingSetUp(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv(credentials.DirVar, filepath.Join(home, "spotlight"))
	t.Setenv(config.EnvConfig, filepath.Join(home, "host.env"))

	report, err := inspectHome(context.Background(), "dev", true)
	if err != nil {
		t.Fatal(err)
	}

	var out bytes.Buffer
	report.print(&out)
	for _, want := range []string{"○ Not logged in.", "spotlight login", "○ ssh is not set up for VS Code or Cursor.", "○ This computer has no host.", "spotlight host init", "spotlight dev is installed."} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("printed\n%s\nwant %q", out.String(), want)
		}
	}

	encoded, err := json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	if got := string(encoded); got != `{"version":"dev","logins":[],"editors":{"configured":false,"editors":[]},"host":null,"host_as_root":false}` {
		t.Errorf("json %s", got)
	}
}

func TestStatusNamesTheHostAndTheSpotlightItRunsFor(t *testing.T) {
	host := report{Name: "build-1", Settings: []listed{{Key: "url", Value: "https://app.dev.example.com"}}}
	host.Service.Running, host.Service.Process = true, 42

	var out bytes.Buffer
	homeReport{Version: "v0.1.0", Host: &host}.print(&out)
	for _, want := range []string{"The host build-1 for https://app.dev.example.com is running (process 42), not as a service.", "spotlight v0.1.0 is installed."} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("printed\n%s\nwant %q", out.String(), want)
		}
	}
}

func TestTheOverviewReadsOnlyThisComputer(t *testing.T) {
	asked := 0
	spotlight := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		asked++
		time.Sleep(3 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(spotlight.Close)

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv(credentials.DirVar, filepath.Join(home, "spotlight"))
	settings := filepath.Join(home, "host.env")
	t.Setenv(config.EnvConfig, settings)
	t.Setenv("SPOTLIGHT_URL", "")
	t.Setenv("DOCKER_HOST", "tcp://127.0.0.1:1")
	if err := os.WriteFile(settings, []byte("SPOTLIGHT_URL="+spotlight.URL+"\nSPOTLIGHT_POOL_TOKEN=spl_0123456789abcd\nSPOTLIGHT_HOST_NAME=build-1\nDOCKER_HOST=tcp://127.0.0.1:1\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var out bytes.Buffer
	started := time.Now()
	if err := Overview(&out, "dev"); err != nil {
		t.Fatal(err)
	}
	if took := time.Since(started); took > time.Second || asked > 0 {
		t.Errorf("took %s and asked Spotlight %d times", took, asked)
	}
	if want := "The host build-1 for " + spotlight.URL + " is not installed."; !strings.Contains(out.String(), want) {
		t.Errorf("printed\n%s\nwant %q", out.String(), want)
	}
}
