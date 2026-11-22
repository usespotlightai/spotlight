package stackcheck

import (
	"context"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

func TestASetupStepThatInstalledIsRecordedThoughAnotherFailed(t *testing.T) {
	tree, bin := t.TempDir(), t.TempDir()
	marks := filepath.Join(t.TempDir(), "marks")
	for name, body := range map[string]string{
		"package-lock.json": "{}", "go.mod": "module example.test\n", "go.sum": "",
	} {
		if err := os.WriteFile(filepath.Join(tree, name), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	for name, script := range map[string]string{
		"npm": "#!/bin/sh\necho the registry is down\nexit 1\n",
		"go":  "#!/bin/sh\nprintf x >> " + marks + "\n",
	} {
		if err := os.WriteFile(filepath.Join(bin, name), []byte(script), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if output, err := exec.Command("git", "-C", tree, "init", "--quiet").CombinedOutput(); err != nil {
		t.Fatalf("git init: %v: %s", err, output)
	}

	o := Options{
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Env: map[string]string{"PATH": bin + ":" + os.Getenv("PATH")},
	}
	installed := map[string]string{}
	for range 2 {
		_, warning, err := o.setUp(context.Background(), tree, protocol.StackCheck{}, installed)
		if err != nil || warning == nil || !strings.Contains(warning.Error(), "`npm ci`") {
			t.Fatalf("setUp: warning %v, error %v, want npm ci as a warning only", warning, err)
		}
	}

	if got, _ := os.ReadFile(marks); string(got) != "x" {
		t.Errorf("go mod download ran %d times, want once: it installed and nothing it reads changed", len(got))
	}
}
