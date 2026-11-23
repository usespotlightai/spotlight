package prepare_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestPreparesAtMostFourCheckoutsAtATime(t *testing.T) {
	requireHTTPBackend(t)
	f := setUp(t)
	backend := f.backend(t)

	var (
		mu             sync.Mutex
		inFlight, most int
	)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		inFlight++
		most = max(most, inFlight)
		mu.Unlock()
		defer func() {
			mu.Lock()
			inFlight--
			mu.Unlock()
		}()
		time.Sleep(200 * time.Millisecond)
		backend.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)

	remote := server.URL + "/" + filepath.Base(f.origin)
	checkouts := f.many(8, func(int) string { return remote })

	output, err := prepared(context.Background(), checkouts, f.options())
	if err != nil {
		t.Fatalf("prepare: %v\n%s", err, output)
	}

	mu.Lock()
	defer mu.Unlock()
	if most < 2 || most > 4 {
		t.Errorf("%d checkouts fetched at once, want 2 to 4", most)
	}
	var want []string
	for _, checkout := range checkouts {
		want = append(want, "cloning "+checkout.Path)
	}
	if output != strings.Join(want, "\n") {
		t.Errorf("output %q", output)
	}
}
