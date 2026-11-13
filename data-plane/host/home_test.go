package host

import (
	"bytes"
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/credentials"
	"usespotlight.ai/data-plane/host/internal/config"
)

func TestStatusOfAComputerWithNothingSetUp(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv(credentials.DirVar, filepath.Join(home, "spotlight"))
	t.Setenv(config.EnvConfig, filepath.Join(home, "host.env"))

	report, err := inspectHome(context.Background(), "dev")
	if err != nil {
		t.Fatal(err)
	}

	var out bytes.Buffer
	report.print(&out)
	for _, want := range []string{"○ Not logged in.", "spotlight login", "○ ssh is not set up for VS Code or Cursor.", "○ This computer has no host.", "spotlight host init"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("printed\n%s\nwant %q", out.String(), want)
		}
	}

	encoded, err := json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	if got := string(encoded); got != `{"logins":[],"editors":{"configured":false,"editors":[]},"host":null,"host_as_root":false}` {
		t.Errorf("json %s", got)
	}
}
