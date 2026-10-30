package control_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"usespotlight.ai/data-plane/control"
	"usespotlight.ai/data-plane/protocol"
)

func TestASandboxArchivesWithItsOwnToken(t *testing.T) {
	var seen []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.Method+" "+r.URL.Path+" "+r.Header.Get("Authorization"))
		switch {
		case r.Method == http.MethodGet:
			w.WriteHeader(http.StatusNoContent)
		case r.URL.Path == "/api/sandboxes/sandbox_1/workspace-archive":
			_ = json.NewEncoder(w).Encode(protocol.ArchiveGrant{ID: "archive_1", URL: "https://storage.test/put"})
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	t.Cleanup(server.Close)

	sandbox, err := control.ForSandbox(server.URL, "sandbox_1", "sandbox-token")
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	stored, err := sandbox.WorkspaceArchive(ctx)
	if err != nil || stored != nil {
		t.Fatalf("restores %+v, %v", stored, err)
	}
	grant, err := sandbox.GrantArchive(ctx, 1024, "abc")
	if err != nil || grant.ID != "archive_1" {
		t.Fatalf("granted %+v, %v", grant, err)
	}
	if err := sandbox.CompleteArchive(ctx, grant.ID); err != nil {
		t.Fatal(err)
	}

	want := []string{
		"GET /api/sandboxes/sandbox_1/workspace-archive Bearer sandbox-token",
		"POST /api/sandboxes/sandbox_1/workspace-archive Bearer sandbox-token",
		"POST /api/sandboxes/sandbox_1/workspace-archive/archive_1/complete Bearer sandbox-token",
	}
	if len(seen) != len(want) {
		t.Fatalf("called %v", seen)
	}
	for i := range want {
		if seen[i] != want[i] {
			t.Errorf("call %d was %q, want %q", i, seen[i], want[i])
		}
	}
}

func TestASandboxNeedsAnIdAndAToken(t *testing.T) {
	if _, err := control.ForSandbox("http://localhost", "", "token"); err == nil {
		t.Error("took a sandbox with no id")
	}
	if _, err := control.ForSandbox("http://localhost", "sandbox_1", ""); err == nil {
		t.Error("took a sandbox with no token")
	}
}
