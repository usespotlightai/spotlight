package trust_test

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"usespotlight.ai/data-plane/host/internal/trust"
	"usespotlight.ai/data-plane/internal/protocol"
)

func TestReadsTheWorkloadTokenAfreshForEveryCall(t *testing.T) {
	file := filepath.Join(t.TempDir(), "token")
	workload := trust.Workload{Trust: "trust_1", TokenFile: file}

	for issued, want := range map[string]string{"first\n": "first", "rotated": "rotated"} {
		if err := os.WriteFile(file, []byte(issued), 0o600); err != nil {
			t.Fatal(err)
		}

		request, _ := http.NewRequest(http.MethodGet, "https://spotlight.test", nil)
		if err := workload.Authorize(request); err != nil {
			t.Fatalf("authorize: %v", err)
		}

		if got := request.Header.Get("Authorization"); got != "Bearer "+want {
			t.Errorf("authorization %q, want Bearer %s", got, want)
		}
		if got := request.Header.Get(protocol.TrustHeader); got != "trust_1" {
			t.Errorf("trust %q", got)
		}
	}
}

func TestRefusesToCallWithAnEmptyToken(t *testing.T) {
	file := filepath.Join(t.TempDir(), "token")
	if err := os.WriteFile(file, []byte("  \n"), 0o600); err != nil {
		t.Fatal(err)
	}

	request, _ := http.NewRequest(http.MethodGet, "https://spotlight.test", nil)
	if err := (trust.Workload{Trust: "trust_1", TokenFile: file}).Authorize(request); err == nil {
		t.Fatal("expected an empty token to be refused")
	}
}
