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

const old = "#!/bin/sh\necho v0.4.0\n"

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
	next := script("v0.7.0")
	binary := installed(t, releases(t, map[string]string{
		"/v0.7.0/spotlight-linux-amd64":        next,
		"/v0.7.0/spotlight-linux-amd64.sha256": sum(next) + "  spotlight-linux-amd64\n",
	}))

	if err := binary.To(context.Background(), "v0.7.0"); err != nil {
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
		"/v0.7.0/spotlight-linux-amd64":        script("v0.7.0"),
		"/v0.7.0/spotlight-linux-amd64.sha256": sum("something else"),
	}))

	err := binary.To(context.Background(), "v0.7.0")
	if err == nil || !strings.Contains(err.Error(), "checksum") {
		t.Fatalf("got %v", err)
	}
	if contents(t, binary) != old || binary.Replaced() {
		t.Error("a binary that failed its checksum replaced the running one")
	}
}

func TestKeepsTheBinaryWhenTheDownloadReportsAnotherRelease(t *testing.T) {
	wrong := script("v0.6.2")
	binary := installed(t, releases(t, map[string]string{
		"/v0.7.0/spotlight-linux-amd64":        wrong,
		"/v0.7.0/spotlight-linux-amd64.sha256": sum(wrong),
	}))

	err := binary.To(context.Background(), "v0.7.0")
	if err == nil || !strings.Contains(err.Error(), "v0.6.2") {
		t.Fatalf("got %v", err)
	}
	if contents(t, binary) != old {
		t.Error("a binary of another release replaced the running one")
	}
}

func TestReplacesTheBinaryWithACanaryThatReportsItsCommit(t *testing.T) {
	next := script("bb0b93862540")
	binary := installed(t, releases(t, map[string]string{
		"/canary/spotlight-linux-amd64":        next,
		"/canary/spotlight-linux-amd64.sha256": sum(next) + "  spotlight-linux-amd64\n",
	}))

	if err := binary.To(context.Background(), update.Canary); err != nil {
		t.Fatal(err)
	}
	if contents(t, binary) != next {
		t.Error("the binary was not replaced")
	}
}

func TestKeepsTheBinaryWhenTheCanaryFailsItsChecksum(t *testing.T) {
	binary := installed(t, releases(t, map[string]string{
		"/canary/spotlight-linux-amd64":        script("bb0b93862540"),
		"/canary/spotlight-linux-amd64.sha256": sum("something else"),
	}))

	err := binary.To(context.Background(), update.Canary)
	if err == nil || !strings.Contains(err.Error(), "checksum") {
		t.Fatalf("got %v", err)
	}
	if contents(t, binary) != old {
		t.Error("a canary that failed its checksum replaced the running one")
	}
}

func TestKeepsTheBinaryWhenTheReleaseIsMissing(t *testing.T) {
	binary := installed(t, releases(t, map[string]string{}))

	if err := binary.To(context.Background(), "v0.7.0"); err == nil {
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
