package hostsocket_test

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/runner/internal/hostsocket"
)

func serving(t *testing.T, handler http.HandlerFunc) string {
	t.Helper()

	dir, err := os.MkdirTemp("", "hs")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	socket := filepath.Join(dir, "host.sock")
	listener, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{Handler: handler}
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() { _ = server.Close() })

	return socket
}

func TestAsksTheHostForTheSnapshotByName(t *testing.T) {
	var asked protocol.HostSnapshotRequest
	socket := serving(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != protocol.HostSnapshotPath {
			http.NotFound(w, r)
			return
		}
		_ = json.NewDecoder(r.Body).Decode(&asked)
		w.WriteHeader(http.StatusNoContent)
	})

	if err := hostsocket.New(socket).Snapshot(context.Background(), "spotlight-archive_1"); err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	if asked.Snapshot != "spotlight-archive_1" {
		t.Errorf("the host was asked for %q", asked.Snapshot)
	}
}

func TestSaysWhyTheHostMadeNoSnapshot(t *testing.T) {
	socket := serving(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "the store did not hold every write", http.StatusServiceUnavailable)
	})

	err := hostsocket.New(socket).Snapshot(context.Background(), "spotlight-archive_1")

	if err == nil || !strings.Contains(err.Error(), "the store did not hold every write") {
		t.Errorf("the error was %v", err)
	}
}
