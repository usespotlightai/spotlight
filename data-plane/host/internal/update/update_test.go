package update_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/host/internal/update"
)

const old = "#!/bin/sh\necho 20261001-01\n"

func script(release string) string { return "#!/bin/sh\necho " + release + "\n" }

func sum(body string) string {
	hash := sha256.Sum256([]byte(body))
	return hex.EncodeToString(hash[:])
}

func releases(t *testing.T, files map[string]string) string {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, ok := files[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)
	return server.URL
}

func installed(t *testing.T, base string) *update.Binary {
	t.Helper()
	path := filepath.Join(t.TempDir(), "spotlight")
	if err := os.WriteFile(path, []byte(old), 0o755); err != nil {
		t.Fatal(err)
	}
	binary, err := update.At(path, base)
	if err != nil {
		t.Fatal(err)
	}
	binary.Platform = "linux-amd64"
	return binary
}

func contents(t *testing.T, binary *update.Binary) string {
	t.Helper()
	raw, err := os.ReadFile(binary.Path)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func TestReplacesTheBinaryWithAReleaseThatPassesItsChecksum(t *testing.T) {
	next := script("20261018-01")
	binary := installed(t, releases(t, map[string]string{
		"/20261018-01/spotlight-linux-amd64":        next,
		"/20261018-01/spotlight-linux-amd64.sha256": sum(next) + "  spotlight-linux-amd64\n",
	}))

	if err := binary.To(context.Background(), "20261018-01"); err != nil {
		t.Fatal(err)
	}
	if contents(t, binary) != next {
		t.Error("the binary was not replaced")
	}
	if !binary.Replaced() {
		t.Error("the replaced binary still reads as the running one")
	}
	left, _ := filepath.Glob(filepath.Join(filepath.Dir(binary.Path), ".spotlight-*"))
	if len(left) != 0 {
		t.Errorf("left %v behind", left)
	}
}

func TestKeepsTheBinaryWhenTheDownloadFailsItsChecksum(t *testing.T) {
	binary := installed(t, releases(t, map[string]string{
		"/20261018-01/spotlight-linux-amd64":        script("20261018-01"),
		"/20261018-01/spotlight-linux-amd64.sha256": sum("something else"),
	}))

	err := binary.To(context.Background(), "20261018-01")
	if err == nil || !strings.Contains(err.Error(), "checksum") {
		t.Fatalf("got %v", err)
	}
	if contents(t, binary) != old || binary.Replaced() {
		t.Error("a binary that failed its checksum replaced the running one")
	}
}

func TestKeepsTheBinaryWhenTheDownloadReportsAnotherRelease(t *testing.T) {
	wrong := script("20261017-03")
	binary := installed(t, releases(t, map[string]string{
		"/20261018-01/spotlight-linux-amd64":        wrong,
		"/20261018-01/spotlight-linux-amd64.sha256": sum(wrong),
	}))

	err := binary.To(context.Background(), "20261018-01")
	if err == nil || !strings.Contains(err.Error(), "20261017-03") {
		t.Fatalf("got %v", err)
	}
	if contents(t, binary) != old {
		t.Error("a binary of another release replaced the running one")
	}
}

func TestKeepsTheBinaryWhenTheReleaseIsMissing(t *testing.T) {
	binary := installed(t, releases(t, map[string]string{}))

	if err := binary.To(context.Background(), "20261018-01"); err == nil {
		t.Fatal("a missing release did not fail")
	}
	if contents(t, binary) != old {
		t.Error("the binary changed")
	}
}

func TestRefusesAReleaseNameThatIsNotOnePathSegment(t *testing.T) {
	binary := installed(t, "https://releases.test")

	for _, release := range []string{"", "../latest", "a/b", "-rf"} {
		if err := binary.To(context.Background(), release); err == nil {
			t.Errorf("%q was accepted", release)
		}
	}
}
